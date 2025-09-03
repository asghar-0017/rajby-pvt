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
// Remove static XLSX import to fix compatibility issues

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

  // Internal keys for product data
  const expectedColumns = [
    "productName",
    "productDescription",
    "hsCode",
    "uom",
  ];

  // Map display headers (as shown in Excel) back to internal keys
  const displayToInternalHeaderMap = {
    "Product Name": "productName",
    "Product Description": "productDescription",
    "HS Code": "hsCode",
    "Unit Of Measurement": "uom",
  };

  const downloadTemplate = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Products", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      // Header row with visual labels
      const visualHeaders = [
        "Product Name",
        "Product Description",
        "HS Code",
        "Unit Of Measurement",
      ];
      worksheet.addRow(visualHeaders);
      worksheet.getRow(1).font = { bold: true };

      // Ensure HS Code column is treated as text and readable
      const hsCodeIdx = visualHeaders.indexOf("HS Code") + 1;
      if (hsCodeIdx > 0) {
        const col = worksheet.getColumn(hsCodeIdx);
        col.numFmt = "@"; // Force string format for entire column
        col.alignment = { horizontal: "left" };
        if (!col.width || col.width < 18) col.width = 20;

        // Also set string format for the header row to ensure consistency
        const headerCell = worksheet.getCell(1, hsCodeIdx);
        headerCell.numFmt = "@";
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

      // Hardcoded UOM options from API response
      const uomOptions = [
        "MT",
        "Bill of lading",
        "SET",
        "KWH",
        "40KG",
        "Liter",
        "SqY",
        "Bag",
        "KG",
        "MMBTU",
        "Meter",
        "Pcs",
        "Carat",
        "Cubic Metre",
        "Dozen",
        "Gram",
        "Gallon",
        "Kilogram",
        "Pound",
        "Timber Logs",
        "Numbers, pieces, units",
        "Packs",
        "Pair",
        "Square Foot",
        "Square Metre",
        "Thousand Unit",
        "Mega Watt",
        "Foot",
        "Barrels",
        "NO",
        "Others",
        "1000 kWh",
      ];

      console.log(
        "UOM dropdown enabled with",
        uomOptions.length,
        "hardcoded options"
      );

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
      // Column B: HS Code list (with description) - No longer used for dropdown validation
      // Users can now input their own HS Code values
      // Ensure HS Codes are stored as strings to prevent Excel from treating them as numbers
      hsCodeValues.forEach((val, i) => {
        const cell = listsSheet.getCell(1 + i, 2);
        cell.value = val;
        cell.numFmt = "@"; // Force string format
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

      const uomColIdx = visualHeaders.indexOf("Unit Of Measurement") + 1;
      const hsColIdx = visualHeaders.indexOf("HS Code") + 1;
      // No row limit - allow unlimited rows of data
      const maxRows = 100000; // allow up to 100,000 rows of data for template generation

      const uomRange = `'Lists'!$A$1:$A$${Math.max(1, uomOptions.length)}`;
      const hsRange = `'Lists'!$B$1:$B$${Math.max(1, hsCodeValues.length)}`;

      console.log("Data validation ranges:", {
        uomRange,
        hsRange:
          "HS Code range no longer used for validation - users input free text",
      });

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
        // HS Code dropdown removed - users can now input their own values
        // if (hsColIdx > 0) {
        //   worksheet.getCell(r, hsColIdx).dataValidation = {
        //     type: "list",
        //     allowBlank: true,
        //     formulae: [hsRange],
        //     showErrorMessage: true,
        //   };
        // }
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
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const data = await parseFileContent(content, selectedFile.type, selectedFile);
        validateAndSetPreview(data);
              } catch (error) {
          console.error("Error parsing file:", error);
          
          // Provide helpful error message with CSV conversion suggestion
          if (error.message.includes("Excel parsing error") || error.message.includes("oi is not a constructor")) {
            toast.error(
              "Excel file parsing failed. Please convert your file to CSV format or try a different Excel file.",
              { autoClose: 8000 }
            );
          } else {
            toast.error("Error parsing file. Please check the file format.");
          }
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

  const parseFileContent = async (content, fileType, file) => {
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

      // Validate headers - check if visual labels are present
      const visualHeaders = Object.keys(displayToInternalHeaderMap);
      const missingHeaders = visualHeaders.filter(
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

          // Map visual headers to internal keys (force hsCode to string)
          const mappedRow = {};
          Object.entries(displayToInternalHeaderMap).forEach(
            ([visualHeader, internalKey]) => {
              const value = row[visualHeader] || "";
              mappedRow[internalKey] =
                internalKey === "hsCode" ? String(value) : value;
            }
          );

          data.push(mappedRow);
        }
      }

      return data;
    } else {
      // Excel file parsing using dynamic xlsx import to avoid compatibility issues
      try {
        // Dynamic import to avoid XLSX constructor issues
        const XLSX = await import("xlsx");
        
        const workbook = XLSX.read(content, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert worksheet to JSON and get formatted values as strings
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
        });

        if (jsonData.length < 2) {
          throw new Error(
            "Excel file must have at least a header row and one data row"
          );
        }

        // Get headers from first row
        const headers = jsonData[0].map((header) =>
          String(header || "").trim()
        );

        // Validate headers - check if visual labels are present
        const visualHeaders = Object.keys(displayToInternalHeaderMap);
        const missingHeaders = visualHeaders.filter(
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

            // Map visual headers to internal keys (force hsCode to string)
            const mappedRow = {};
            Object.entries(displayToInternalHeaderMap).forEach(
              ([visualHeader, internalKey]) => {
                const value = rowData[visualHeader] || "";
                mappedRow[internalKey] =
                  internalKey === "hsCode" ? String(value) : value;
              }
            );

            data.push(mappedRow);
          }
        }

        return data;
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        
        // Provide more specific error messages
        if (error.message.includes("oi is not a constructor")) {
          throw new Error(
            "Excel parsing error: Please try converting your Excel file to CSV format, or contact support if the issue persists."
          );
        } else if (error.message.includes("Cannot read properties")) {
          throw new Error(
            "Excel file format not supported. Please ensure you're using a valid Excel file (.xlsx or .xls) or convert to CSV format."
          );
        } else {
          throw new Error(
            `Error parsing Excel file: ${error.message}. Please check the file format and try again.`
          );
        }
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

    // Hardcoded UOM options for validation
    const validUOMs = [
      "MT",
      "Bill of lading",
      "SET",
      "KWH",
      "40KG",
      "Liter",
      "SqY",
      "Bag",
      "KG",
      "MMBTU",
      "Meter",
      "Pcs",
      "Carat",
      "Cubic Metre",
      "Dozen",
      "Gram",
      "Gallon",
      "Kilogram",
      "Pound",
      "Timber Logs",
      "Numbers, pieces, units",
      "Packs",
      "Pair",
      "Square Foot",
      "Square Metre",
      "Thousand Unit",
      "Mega Watt",
      "Foot",
      "Barrels",
      "NO",
      "Others",
      "1000 kWh",
    ];

    data.forEach((row, index) => {
      const rowErrors = [];

      // Required field validation
      if (!row.productName || row.productName.trim() === "") {
        rowErrors.push("Product name is required");
      }

      if (!row.hsCode || row.hsCode.trim() === "") {
        rowErrors.push("HS Code is required");
      }

      if (!row.uom || row.uom.trim() === "") {
        rowErrors.push("Unit of Measurement is required");
      }

      // UOM validation using hardcoded options
      if (row.uom && row.uom.trim() !== "") {
        const uomValue = String(row.uom).trim();
        const isValidUOM = validUOMs.some(
          (validUom) =>
            validUom.toLowerCase() === uomValue.toLowerCase() ||
            validUom.toLowerCase().includes(uomValue.toLowerCase()) ||
            uomValue.toLowerCase().includes(validUom.toLowerCase())
        );

        if (!isValidUOM) {
          rowErrors.push(
            `Unit of Measurement "${row.uom}" is not valid. Please select from the dropdown.`
          );
        }
      }

      // HS Code format validation (now more flexible for user input)
      if (row.hsCode && row.hsCode.trim() !== "") {
        const hsCodeStr = String(row.hsCode).trim();
        // Allow alphanumeric HS Codes (e.g., "0101.10.00", "ABC123")
        if (!/^[A-Za-z0-9.\-\s]+$/.test(hsCodeStr)) {
          rowErrors.push(
            "HS Code should contain only letters, numbers, dots, hyphens, and spaces"
          );
        }
        if (hsCodeStr.length < 2 || hsCodeStr.length > 20) {
          rowErrors.push("HS Code should be between 2-20 characters");
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

    console.log("Starting checkExistingProducts with", productsData.length, "products");
    setCheckingExisting(true);
    try {
      const response = await api.post(
        `/tenant/${selectedTenant.tenant_id}/products/check-existing`,
        { products: productsData }
      );

      console.log("API response received:", response.data);

      const { existing, new: newProductsData } = response.data.data;
      console.log("Setting existing products:", existing.length);
      console.log("Setting new products:", newProductsData.length);
      
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

    const normalize = (data) => ({
      // Ensure preview consistently uses productName/description keys
      productName: data.productName || data.name || "",
      productDescription: data.productDescription || data.description || "",
      hsCode: data.hsCode || "",
      uom: data.uom || "",
    });

    // Add existing products with status
    existingProducts.forEach((item) => {
      combined.push({
        ...normalize(item.productData),
        _status: "existing",
        _existingProduct: item.existingProduct,
        _row: item.row,
      });
    });

    // Add new products with status
    newProducts.forEach((item) => {
      combined.push({
        ...normalize(item.productData),
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
            Upload a CSV or Excel file with the following columns: Product Name,
            Product Description, HS Code, Unit Of Measurement.
            <br />
            <strong>Note:</strong> Products with duplicate names or HS codes
            will be skipped during upload.
            <br />
            <strong>Tip:</strong> If you encounter issues with Excel files, try converting them to CSV format for better compatibility.
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
                      <TableCell>Product Name</TableCell>
                      <TableCell>Product Description</TableCell>
                      <TableCell>HS Code</TableCell>
                      <TableCell>Unit Of Measurement</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCombinedPreviewData().map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row._row}</TableCell>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell>{row.productDescription}</TableCell>
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
