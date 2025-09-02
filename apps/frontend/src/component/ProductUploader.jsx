/**
 * ProductUploader Component
 *
 * This component handles bulk product uploads from CSV/Excel files.
 *
 * Features:
 * - File upload (CSV/Excel)
 * - Template download with validation
 * - Duplicate product detection
 * - Preview with validation status indicators
 * - Bulk upload with error handling
 */

import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Link,
} from "@mui/material";
import {
  CloudUpload,
  FileUpload,
  Delete,
  Visibility,
  CheckCircle,
  Error,
  Warning,
  Download,
  Info,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { api } from "../API/Api";
import hsCodeCache from "../utils/hsCodeCache";
import * as XLSX from "xlsx";

const ProductUploader = ({ onUpload, onClose, isOpen, selectedTenant }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [existingProducts, setExistingProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const fileInputRef = useRef(null);

  // Expected columns for product data
  const expectedColumns = ["name", "description", "hsCode", "uom"];

  const downloadTemplate = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Products", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      // Header row
      worksheet.addRow(expectedColumns);
      worksheet.getRow(1).font = { bold: true };

      // Ensure HS Code column is treated as text and readable
      const hsCodeIdx = expectedColumns.indexOf("hsCode") + 1;
      if (hsCodeIdx > 0) {
        const col = worksheet.getColumn(hsCodeIdx);
        col.numFmt = "@";
        col.alignment = { horizontal: "left" };
        if (!col.width || col.width < 18) col.width = 20;
      }

      // Fetch HS Codes and build HS list from API (limit for performance)
      let hsCodeValues = [];
      try {
        const res = await api.get(`/hs-codes?environment=sandbox`);
        console.log("HS Codes API response:", res);
        const codes = Array.isArray(res?.data?.data) ? res.data.data : [];
        const limited = codes.slice(0, 1000);
        hsCodeValues = limited
          .map((c) => {
            const code = c.hS_CODE || c.hs_code || c.code || "";
            const desc = c.description || "";
            return `${code} - ${desc}`.trim();
          })
          .filter(Boolean);
        console.log("Processed HS Codes:", hsCodeValues.length);
      } catch (e) {
        console.error("Error fetching HS codes:", e);
        // Fallback HS codes if API fails
        hsCodeValues = [
          "0101.10.00 - Live horses, pure-bred breeding animals",
          "0101.90.00 - Live horses, other",
          "0102.10.00 - Live asses, pure-bred breeding animals",
          "0102.90.00 - Live asses, other",
          "0103.10.00 - Live swine, pure-bred breeding animals",
          "0103.91.00 - Live swine, weighing less than 50 kg",
          "0103.92.00 - Live swine, weighing 50 kg or more",
          "0104.10.00 - Live sheep, pure-bred breeding animals",
          "0104.20.00 - Live sheep, other",
          "0105.11.00 - Live goats, pure-bred breeding animals",
          "0105.12.00 - Live goats, other",
        ];
      }

      // Fetch UOMs via hsCode cache for a subset of HS Codes, de-duplicate
      let uomOptions = [];
      try {
        const sampleCodes = hsCodeValues
          .map((v) => String(v).split(" - ")[0])
          .filter(Boolean)
          .slice(0, 50);
        const uomSet = new Set();
        for (const code of sampleCodes) {
          try {
            const uoms = await hsCodeCache.getUOM(code);
            if (Array.isArray(uoms)) {
              uoms.forEach((u) => {
                const desc = u?.description;
                if (desc) uomSet.add(desc);
              });
            }
          } catch (_) {}
        }
        uomOptions = Array.from(uomSet);
        console.log("UOM options from cache:", uomOptions.length);
      } catch (e) {
        console.error("Error fetching UOMs:", e);
        // Fallback UOM options if API fails
        uomOptions = [
          "KG",
          "TON",
          "LITRE",
          "PIECE",
          "METER",
          "SQUARE METER",
          "CUBIC METER",
          "DOZEN",
          "PAIR",
          "SET",
          "UNIT",
          "BOX",
          "BAG",
          "ROLL",
          "SHEET",
        ];
      }

      // Create a veryHidden worksheet to store the lists
      const listsSheet = workbook.addWorksheet("Lists");
      listsSheet.state = "veryHidden"; // cannot be unhidden via Excel UI

      console.log("Creating Excel with:", {
        uomCount: uomOptions.length,
        hsCount: hsCodeValues.length,
      });

      // Column A: UOM list
      uomOptions.forEach((uom, i) => {
        listsSheet.getCell(1 + i, 1).value = uom;
      });
      // Column B: HS Code list (with description)
      hsCodeValues.forEach((val, i) => {
        listsSheet.getCell(1 + i, 2).value = val;
      });

      // Helper to convert column index to Excel letter
      const getColLetter = (col) => {
        let temp = "";
        let n = col;
        while (n > 0) {
          const rem = (n - 1) % 26;
          temp = String.fromCharCode(65 + rem) + temp;
          n = Math.floor((n - 1) / 26);
        }
        return temp;
      };

      const uomColIdx = expectedColumns.indexOf("uom") + 1;
      const hsColIdx = expectedColumns.indexOf("hsCode") + 1;
      // No row limit - allow unlimited rows of data
      const maxRows = 100000; // allow up to 100,000 rows of data for template generation

      const uomRange = `'Lists'!$A$1:$A$${Math.max(1, uomOptions.length)}`;
      const hsRange = `'Lists'!$B$1:$B$${Math.max(1, hsCodeValues.length)}`;

      console.log("Data validation ranges:", { uomRange, hsRange });

      // Apply data validations row-wise (limited to reasonable number for template)
      for (let r = 2; r <= Math.min(maxRows, 10000); r++) {
        if (uomColIdx > 0) {
          worksheet.getCell(r, uomColIdx).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [uomRange],
            showErrorMessage: true,
          };
        }
        if (hsColIdx > 0) {
          worksheet.getCell(r, hsColIdx).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [hsRange],
            showErrorMessage: true,
          };
        }
      }

      // Start with empty body rows; users will fill data beneath the headers

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Excel template downloaded successfully!");
    } catch (err) {
      console.error("Error generating Excel template:", err);
      toast.error("Failed to generate Excel template.");
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const processFile = (selectedFile) => {
    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Please select a valid CSV or Excel file");
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    setPreviewData([]);
    setExistingProducts([]);
    setNewProducts([]);

    // Read and parse the file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const data = parseFileContent(content, selectedFile.type, selectedFile);
        validateAndSetPreview(data);
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error("Error parsing file. Please check the file format.");
      }
    };

    // Use different reading methods based on file type
    if (selectedFile.type === "text/csv") {
      reader.readAsText(selectedFile);
    } else {
      // For Excel files, read as ArrayBuffer
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const parseFileContent = (content, fileType, file) => {
    if (fileType === "text/csv") {
      // Improved CSV parsing with better handling of quoted fields
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error(
          "CSV file must have at least a header row and one data row"
        );
      }

      // Parse headers
      const headers = parseCSVLine(lines[0]);

      // Validate headers
      const missingHeaders = expectedColumns.filter(
        (col) => !headers.includes(col)
      );
      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required columns: ${missingHeaders.join(", ")}`
        );
      }

      const data = [];

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCSVLine(lines[i]);
          const row = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          // Only include expected columns
          const filteredRow = {};
          expectedColumns.forEach((col) => {
            filteredRow[col] = row[col] || "";
          });

          data.push(filteredRow);
        }
      }

      return data;
    } else {
      // Excel file parsing using xlsx library
      try {
        const workbook = XLSX.read(content, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          throw new Error(
            "Excel file must have at least a header row and one data row"
          );
        }

        // Get headers from first row
        const headers = jsonData[0].map((header) =>
          String(header || "").trim()
        );

        // Validate headers
        const missingHeaders = expectedColumns.filter(
          (col) => !headers.includes(col)
        );
        if (missingHeaders.length > 0) {
          throw new Error(
            `Missing required columns: ${missingHeaders.join(", ")}`
          );
        }

        const data = [];

        // Process data rows (skip header row)
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (
            row &&
            row.some(
              (cell) => cell !== null && cell !== undefined && cell !== ""
            )
          ) {
            const rowData = {};

            headers.forEach((header, index) => {
              rowData[header] = row[index] || "";
            });

            // Only include expected columns
            const filteredRow = {};
            expectedColumns.forEach((col) => {
              filteredRow[col] = rowData[col] || "";
            });

            data.push(filteredRow);
          }
        }

        return data;
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        throw new Error(
          "Error parsing Excel file. Please check the file format."
        );
      }
    }
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }

      i++;
    }

    result.push(current.trim());
    return result;
  };

  const validateAndSetPreview = (data) => {
    const validData = [];
    const validationErrors = [];

    data.forEach((row, index) => {
      const rowErrors = [];

      // Required field validation
      if (!row.name || row.name.trim() === "") {
        rowErrors.push("Product name is required");
      }

      if (!row.hsCode || row.hsCode.trim() === "") {
        rowErrors.push("HS Code is required");
      }

      if (!row.uom || row.uom.trim() === "") {
        rowErrors.push("Unit of Measurement is required");
      }

      // HS Code format validation (should be numeric)
      if (row.hsCode && row.hsCode.trim() !== "") {
        const hsCodeStr = String(row.hsCode).trim();
        if (!/^\d+$/.test(hsCodeStr)) {
          rowErrors.push("HS Code should contain only numbers");
        }
        if (hsCodeStr.length < 4 || hsCodeStr.length > 12) {
          rowErrors.push("HS Code should be between 4-12 digits");
        }
      }

      if (rowErrors.length > 0) {
        validationErrors.push({
          row: index + 1,
          errors: rowErrors,
        });
      } else {
        validData.push({
          ...row,
          _row: index + 1,
        });
      }
    });

    setPreviewData(validData);
    setErrors(validationErrors);

    if (validData.length > 0) {
      checkExistingProducts(validData);
    }
  };

  const checkExistingProducts = async (productsData) => {
    if (!selectedTenant) {
      toast.error("Please select a Company before checking existing products.");
      return;
    }

    setCheckingExisting(true);
    try {
      const response = await api.post(
        `/tenant/${selectedTenant.tenant_id}/products/check-existing`,
        { products: productsData }
      );

      const { existing, new: newProductsData } = response.data.data;
      setExistingProducts(existing);
      setNewProducts(newProductsData);

      if (existing.length > 0) {
        toast.info(
          `${existing.length} products already exist and will be skipped during upload`
        );
      }
    } catch (error) {
      console.error("Error checking existing products:", error);
      toast.error(
        "Error checking existing products. Preview may not be accurate."
      );
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleUpload = async () => {
    if (!file || newProducts.length === 0) {
      toast.error("Please select a valid file with new products to upload");
      return;
    }

    setUploading(true);
    try {
      // Only upload new products
      const productsToUpload = newProducts.map((item) => ({
        ...item.productData,
      }));
      const result = await onUpload(productsToUpload);

      // Check if there were any errors in the upload
      if (
        result &&
        result.data &&
        result.data.data &&
        result.data.data.summary
      ) {
        const { summary, errors } = result.data.data;

        if (summary.failed > 0) {
          // Show detailed error information
          let errorDetails = errors
            .slice(0, 10)
            .map((err) => `Row ${err.row}: ${err.error}`)
            .join("\n");

          if (errors.length > 10) {
            errorDetails += `\n... and ${errors.length - 10} more errors`;
          }

          // Show error details in a toast instead of alert
          toast.warning(
            `Upload completed with issues: ${summary.successful} products added successfully, ${summary.failed} products failed. Check console for error details.`,
            {
              autoClose: 8000,
              closeOnClick: false,
              pauseOnHover: true,
            }
          );
          console.error("Upload errors:", errors);
        } else {
          toast.success(
            `Successfully uploaded ${summary.successful} products!`
          );
        }
      } else {
        toast.success(
          `Successfully uploaded ${productsToUpload.length} products`
        );
      }

      handleClose();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading products. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setShowPreview(false);
    setExistingProducts([]);
    setNewProducts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const removeFile = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setExistingProducts([]);
    setNewProducts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Create a combined preview data with status indicators
  const getCombinedPreviewData = () => {
    const combined = [];

    // Add existing products with status
    existingProducts.forEach((item) => {
      combined.push({
        ...item.productData,
        _status: "existing",
        _existingProduct: item.existingProduct,
        _row: item.row,
      });
    });

    // Add new products with status
    newProducts.forEach((item) => {
      combined.push({
        ...item.productData,
        _status: "new",
        _row: item.row,
      });
    });

    // Sort by original row order
    return combined.sort((a, b) => a._row - b._row);
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Upload Products from File</Typography>
          <IconButton onClick={handleClose}>
            <Delete />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV or Excel file with the following columns: name,
            description, hsCode, uom.
            <br />
            <strong>Note:</strong> Products with duplicate names or HS codes
            will be skipped during upload.
          </Typography>

          {/* Download Template Button */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={downloadTemplate}
              size="small"
            >
              Download Excel Template
            </Button>
          </Box>

          {/* File Upload Area */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: "center",
              border: "2px dashed #ccc",
              backgroundColor: "#fafafa",
              cursor: "pointer",
              "&:hover": {
                borderColor: "primary.main",
                backgroundColor: "#f5f5f5",
              },
            }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            {!file ? (
              <Box>
                <CloudUpload
                  sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Drop your file here or click to browse
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supports CSV and Excel files
                </Typography>
              </Box>
            ) : (
              <Box>
                <FileUpload
                  sx={{ fontSize: 48, color: "primary.main", mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  {file.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  File size: {(file.size / 1024).toFixed(2)} KB
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Validation Results */}
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Validation Errors ({errors.length} rows):
            </Typography>
            {errors.slice(0, 5).map((error, index) => (
              <Typography key={index} variant="body2">
                Row {error.row}: {error.errors.join(", ")}
              </Typography>
            ))}
            {errors.length > 5 && (
              <Typography variant="body2">
                ... and {errors.length - 5} more errors
              </Typography>
            )}
          </Alert>
        )}

        {/* Preview Section */}
        {file && previewData.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">
                Preview ({previewData.length} rows)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowPreview(!showPreview)}
                startIcon={showPreview ? <Visibility /> : <Visibility />}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </Box>

            {showPreview && (
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>HS Code</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCombinedPreviewData().map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row._row}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>{row.hsCode}</TableCell>
                        <TableCell>{row.uom}</TableCell>
                        <TableCell>
                          {row._status === "existing" ? (
                            <Chip
                              icon={<Warning />}
                              label="Existing"
                              color="warning"
                              size="small"
                            />
                          ) : (
                            <Chip
                              icon={<CheckCircle />}
                              label="New"
                              color="success"
                              size="small"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Summary */}
            <Box sx={{ mt: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
              {existingProducts.length > 0 && (
                <Box display="flex" alignItems="center" gap={2}>
                  <Warning color="warning" />
                  <Typography variant="body2" color="warning.main">
                    {existingProducts.length} products already exist and will be
                    skipped
                  </Typography>
                </Box>
              )}
              {newProducts.length > 0 && (
                <Box display="flex" alignItems="center" gap={2}>
                  <CheckCircle color="success" />
                  <Typography variant="body2" color="success.main">
                    {newProducts.length} new products will be uploaded
                  </Typography>
                </Box>
              )}
              {errors.length > 0 && (
                <Box display="flex" alignItems="center" gap={2}>
                  <Error color="error" />
                  <Typography variant="body2" color="error.main">
                    {errors.length} rows skipped due to errors
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        {file && (
          <Button onClick={removeFile} disabled={uploading}>
            Remove File
          </Button>
        )}
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={
            !file || newProducts.length === 0 || uploading || checkingExisting
          }
          startIcon={
            uploading ? <CircularProgress size={20} /> : <FileUpload />
          }
        >
          {uploading
            ? "Uploading..."
            : `Upload ${newProducts.length} New Products`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductUploader;
