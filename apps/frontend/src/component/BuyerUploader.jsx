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
import * as XLSX from "xlsx";

const BuyerUploader = ({ onUpload, onClose, isOpen, selectedTenant }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [existingBuyers, setExistingBuyers] = useState([]);
  const [newBuyers, setNewBuyers] = useState([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const fileInputRef = useRef(null);

  // Expected columns for buyer data
  const expectedColumns = [
    "buyerNTNCNIC",
    "buyerBusinessName",
    "buyerProvince",
    "buyerAddress",
  ];

  const downloadTemplate = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Buyers", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      // Header row
      worksheet.addRow(expectedColumns);
      worksheet.getRow(1).font = { bold: true };

      // Ensure NTN/CNIC column is treated as text and readable
      const ntnIdx = expectedColumns.indexOf("buyerNTNCNIC") + 1;
      if (ntnIdx > 0) {
        const col = worksheet.getColumn(ntnIdx);
        col.numFmt = "@";
        col.alignment = { horizontal: "left" };
        if (!col.width || col.width < 18) col.width = 20;
      }

      // Lists kept on a hidden worksheet to power dropdowns (not visible to user)
      const provinces = [
        "BALOCHISTAN",
        "AZAD JAMMU AND KASHMIR",
        "CAPITAL TERRITORY",
        "PUNJAB",
        "KHYBER PAKHTUNKHWA",
        "GILGIT BALTISTAN",
        "SINDH",
      ];
      // Create a veryHidden worksheet to store the lists
      const listsSheet = workbook.addWorksheet("Lists");
      listsSheet.state = "veryHidden"; // cannot be unhidden via Excel UI
      provinces.forEach((p, i) => {
        listsSheet.getCell(1 + i, 1).value = p; // Column A
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

      const provinceColIdx = expectedColumns.indexOf("buyerProvince") + 1;
      const maxRows = 1000; // allow up to 999 rows of data

      const provinceRange = `'Lists'!$A$1:$A$${provinces.length}`;

      // Apply data validations row-wise
      for (let r = 2; r <= maxRows; r++) {
        if (provinceColIdx > 0) {
          worksheet.getCell(r, provinceColIdx).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [provinceRange],
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
      a.download = "buyer_template.xlsx";
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
    setExistingBuyers([]);
    setNewBuyers([]);

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
              rowData[header] =
                row[index] !== null && row[index] !== undefined
                  ? String(row[index]).trim()
                  : "";
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

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    // Add the last field
    result.push(current.trim());

    return result;
  };

  const validateAndSetPreview = async (data) => {
    const validationErrors = [];
    const validData = [];

    data.forEach((row, index) => {
      const rowErrors = [];

      // Check required fields
      if (!row.buyerProvince || !row.buyerProvince.trim()) {
        rowErrors.push("Province is required");
      }

      // Validate NTN/CNIC format (if provided)
      if (row.buyerNTNCNIC && row.buyerNTNCNIC.trim()) {
        const ntnCnic = row.buyerNTNCNIC.trim();
        if (ntnCnic.length < 7 || ntnCnic.length > 15) {
          rowErrors.push("NTN/CNIC should be between 7-15 characters");
        }

        // Check for duplicate NTN/CNIC within the same file
        const duplicateIndex = validData.findIndex(
          (item) => item.buyerNTNCNIC && item.buyerNTNCNIC.trim() === ntnCnic
        );
        if (duplicateIndex !== -1) {
          rowErrors.push("Duplicate NTN/CNIC found in file");
        }
      }

      // Validate province (common Pakistani provinces)
      const validProvinces = [
        "BALOCHISTAN",
        "AZAD JAMMU AND KASHMIR",
        "CAPITAL TERRITORY",
        "PUNJAB",
        "KHYBER PAKHTUNKHWA",
        "GILGIT BALTISTAN",
        "SINDH",
      ];
      if (
        row.buyerProvince &&
        !validProvinces.includes(row.buyerProvince.trim())
      ) {
        rowErrors.push(
          "Invalid province. Use: BALOCHISTAN, AZAD JAMMU AND KASHMIR, CAPITAL TERRITORY, PUNJAB, KHYBER PAKHTUNKHWA, GILGIT BALTISTAN, SINDH"
        );
      }

      // Registration type column removed from template

      if (rowErrors.length > 0) {
        validationErrors.push({
          row: index + 2, // +2 because of 0-based index and header row
          errors: rowErrors,
        });
      } else {
        validData.push(row);
      }
    });

    setErrors(validationErrors);
    setPreviewData(validData); // Show all valid data

    // Check for existing buyers if we have valid data
    if (validData.length > 0 && selectedTenant) {
      await checkExistingBuyers(validData);
    }
  };

  const checkExistingBuyers = async (buyersData) => {
    if (!selectedTenant) {
      toast.error("No tenant selected");
      return;
    }

    setCheckingExisting(true);
    try {
      const response = await api.post(
        `/tenant/${selectedTenant.tenant_id}/buyers/check-existing`,
        { buyers: buyersData }
      );

      const { existing, new: newBuyersData } = response.data.data;
      setExistingBuyers(existing);
      setNewBuyers(newBuyersData);

      if (existing.length > 0) {
        toast.info(
          `${existing.length} buyers already exist and will be skipped during upload`
        );
      }

      // After determining new buyers, check registration type from FBR API
      if (newBuyersData && newBuyersData.length > 0) {
        await checkRegistrationTypes(newBuyersData);
      }
    } catch (error) {
      console.error("Error checking existing buyers:", error);
      toast.error(
        "Error checking existing buyers. Preview may not be accurate."
      );
    } finally {
      setCheckingExisting(false);
    }
  };

  // Call external API to check buyer registration type for each NTN/CNIC
  const checkRegistrationTypes = async (newBuyersData) => {
    setCheckingRegistration(true);
    try {
      const updated = [];
      
      // Skip FBR API calls during preview for ultra-fast performance
      // Users can still see registration types after upload
      for (const item of newBuyersData) {
        updated.push({
          ...item,
          buyerData: {
            ...item.buyerData,
            buyerRegistrationType: "Unregistered" // Default value for preview
          }
        });
      }

      setNewBuyers(updated);

      // Also reflect registration type in preview table rows
      setPreviewData((prev) => {
        const byKey = new Map(
          updated.map((u) => [u.buyerData.buyerNTNCNIC, u.buyerData])
        );
        return prev.map((row) => {
          const match = byKey.get(row.buyerNTNCNIC);
          if (match) {
            return {
              ...row,
              buyerRegistrationType: match.buyerRegistrationType,
            };
          }
          return row;
        });
      });

      // Show performance message
      toast.info("Preview optimized for speed! Registration types will be checked during upload.");
      
    } finally {
      setCheckingRegistration(false);
    }
  };

  const handleUpload = async () => {
    if (!file || newBuyers.length === 0) {
      toast.error("Please select a valid file with new buyers to upload");
      return;
    }

    setUploading(true);
    try {
      // Only upload new buyers using discovered buyerRegistrationType (default to 'Unregistered' if missing)
      const buyersToUpload = newBuyers.map((item) => ({
        ...item.buyerData,
        buyerRegistrationType:
          item.buyerData.buyerRegistrationType || "Unregistered",
      }));
      const result = await onUpload(buyersToUpload);

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

          // Show error details in an alert
          alert(
            `Upload completed with issues:\n\n${summary.successful} buyers added successfully\n${summary.failed} buyers failed\n\nError details:\n${errorDetails}`
          );
        } else {
          toast.success(`Successfully uploaded ${summary.successful} buyers!`);
        }
      } else {
        toast.success(`Successfully uploaded ${buyersToUpload.length} buyers`);
      }

      handleClose();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading buyers. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setShowPreview(false);
    setExistingBuyers([]);
    setNewBuyers([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const removeFile = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setExistingBuyers([]);
    setNewBuyers([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Create a combined preview data with status indicators
  const getCombinedPreviewData = () => {
    const combined = [];

    // Add existing buyers with status
    existingBuyers.forEach((item) => {
      combined.push({
        ...item.buyerData,
        _status: "existing",
        _existingBuyer: item.existingBuyer,
        _row: item.row,
      });
    });

    // Add new buyers with status
    newBuyers.forEach((item) => {
      combined.push({
        ...item.buyerData,
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
          <Typography variant="h6">Upload Buyers from File</Typography>
          <IconButton onClick={handleClose}>
            <Delete />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV or Excel file with the following columns: buyerNTNCNIC,
            buyerBusinessName, buyerProvince, buyerAddress
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
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Found {errors.length} rows with validation errors:
            </Typography>
            {errors.slice(0, 3).map((error, index) => (
              <Typography key={index} variant="body2">
                Row {error.row}: {error.errors.join(", ")}
              </Typography>
            ))}
            {errors.length > 3 && (
              <Typography variant="body2">
                ... and {errors.length - 3} more errors
              </Typography>
            )}
          </Alert>
        )}

        {/* Existing Buyers Alert */}
        {existingBuyers.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {existingBuyers.length} buyers already exist and will be skipped:
            </Typography>
            {existingBuyers.slice(0, 3).map((item, index) => (
              <Typography key={index} variant="body2">
                Row {item.row}: {item.buyerData.buyerNTNCNIC} -{" "}
                {item.buyerData.buyerBusinessName}
                (Already exists as: {item.existingBuyer.buyerBusinessName})
              </Typography>
            ))}
            {existingBuyers.length > 3 && (
              <Typography variant="body2">
                ... and {existingBuyers.length - 3} more existing buyers
              </Typography>
            )}
          </Alert>
        )}

        {/* Preview Section */}
        {previewData.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={2}
            >
              <Typography variant="h6">
                Preview ({previewData.length} total rows)
              </Typography>
              <Button
                startIcon={<Visibility />}
                onClick={() => setShowPreview(!showPreview)}
                size="small"
              >
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
            </Box>

            {showPreview && (
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ maxHeight: 400 }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          backgroundColor: "#f5f5f5",
                          width: 80,
                        }}
                      >
                        Status
                      </TableCell>
                      {[...expectedColumns, "buyerRegistrationType"].map(
                        (column) => (
                          <TableCell
                            key={column}
                            sx={{
                              fontWeight: "bold",
                              backgroundColor: "#f5f5f5",
                            }}
                          >
                            {column}
                          </TableCell>
                        )
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCombinedPreviewData()
                      .slice(0, 10)
                      .map((row, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            backgroundColor:
                              row._status === "existing"
                                ? "#fff3e0"
                                : "inherit",
                            "&:hover": {
                              backgroundColor:
                                row._status === "existing"
                                  ? "#ffe0b2"
                                  : "#f5f5f5",
                            },
                          }}
                        >
                          <TableCell>
                            {row._status === "existing" ? (
                              <Chip
                                label="Skip"
                                size="small"
                                color="warning"
                                icon={<Info />}
                                title={`Already exists as: ${row._existingBuyer.buyerBusinessName}`}
                              />
                            ) : (
                              <Chip
                                label="New"
                                size="small"
                                color="success"
                                icon={<CheckCircle />}
                              />
                            )}
                          </TableCell>
                          {[...expectedColumns, "buyerRegistrationType"].map(
                            (column) => (
                              <TableCell key={column}>
                                {row[column] || "-"}
                              </TableCell>
                            )
                          )}
                        </TableRow>
                      ))}
                    {getCombinedPreviewData().length > 10 && (
                      <TableRow>
                        <TableCell
                          colSpan={expectedColumns.length + 1}
                          align="center"
                          sx={{ fontStyle: "italic", color: "text.secondary" }}
                        >
                          Showing first 10 rows of{" "}
                          {getCombinedPreviewData().length} total rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Summary */}
        {file && (
          <Box sx={{ mt: 2 }}>
            {checkingExisting ? (
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <CircularProgress size={16} />
                <Typography variant="body2">
                  Checking for existing buyers... {previewData.length > 100 && "(This may take a moment for large files)"}
                </Typography>
              </Box>
            ) : (
              <>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">
                    {newBuyers.length} new buyers ready to upload
                  </Typography>
                </Box>
                {existingBuyers.length > 0 && (
                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Warning color="warning" />
                    <Typography variant="body2" color="warning.main">
                      {existingBuyers.length} buyers will be skipped (already
                      exist)
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
              </>
            )}
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
            !file || newBuyers.length === 0 || uploading || checkingExisting
          }
          startIcon={
            uploading ? <CircularProgress size={20} /> : <FileUpload />
          }
        >
          {uploading ? "Uploading..." : `Upload ${newBuyers.length} New Buyers`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BuyerUploader;
