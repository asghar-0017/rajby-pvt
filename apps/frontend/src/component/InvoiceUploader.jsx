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
  Error as ErrorIcon,
  Warning,
  Download,
  Info,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { api } from "../API/Api";
import * as XLSX from "xlsx";

// Utility function to convert Excel date to YYYY-MM-DD format
const convertExcelDateToYYYYMMDD = (excelDate) => {
  if (!excelDate || excelDate === "") return "";

  // If it's already a string that looks like a date, try to parse it
  if (typeof excelDate === "string") {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
      return excelDate;
    }

    // Check if it's a numeric string that might be an Excel serial date
    if (/^\d+$/.test(excelDate)) {
      const numericValue = parseFloat(excelDate);
      // If it's a large number, treat it as Excel serial date
      if (numericValue > 1000) {
        // Excel dates are number of days since 1900-01-01
        // Excel incorrectly treats 1900 as a leap year, so we need to adjust
        const excelEpoch = new Date(1900, 0, 1);
        let daysToAdd = numericValue - 1;

        // Adjust for Excel's leap year bug (1900 is not a leap year but Excel treats it as one)
        if (numericValue > 59) {
          daysToAdd = daysToAdd - 1;
        }

        const date = new Date(
          excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000
        );
        return date.toISOString().split("T")[0];
      }
    }

    // Handle date strings with slashes (MM/DD/YYYY or DD/MM/YYYY)
    if (excelDate.includes("/")) {
      const parts = excelDate.split("/");
      if (parts.length === 3) {
        // Try MM/DD/YYYY format first (US format)
        let month = parseInt(parts[0], 10);
        let day = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);

        // If month > 12, it might be DD/MM/YYYY format
        if (month > 12 && day <= 12) {
          // Swap month and day
          [month, day] = [day, month];
        }

        // Validate the date
        if (
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31 &&
          year >= 1900 &&
          year <= 2100
        ) {
          // Format as YYYY-MM-DD
          return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        }
      }
    }

    // Try to parse various date formats using JavaScript Date
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  // If it's a number (Excel serial date), convert it
  if (typeof excelDate === "number") {
    // Excel dates are number of days since 1900-01-01
    // Excel incorrectly treats 1900 as a leap year, so we need to adjust
    const excelEpoch = new Date(1900, 0, 1);
    let daysToAdd = excelDate - 1;

    // Adjust for Excel's leap year bug (1900 is not a leap year but Excel treats it as one)
    if (excelDate > 59) {
      daysToAdd = daysToAdd - 1;
    }

    const date = new Date(
      excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000
    );
    return date.toISOString().split("T")[0];
  }

  return "";
};

const InvoiceUploader = ({ onUpload, onClose, isOpen, selectedTenant }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [existingInvoices, setExistingInvoices] = useState([]);
  const [newInvoices, setNewInvoices] = useState([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [downloadButtonDisabled, setDownloadButtonDisabled] = useState(false);
  const fileInputRef = useRef(null);

  // Expected columns for invoice data (including items)
  const expectedColumns = [
    "invoiceType",
    "invoiceDate",
    "buyerNTNCNIC",
    "buyerBusinessName",
    "buyerProvince",
    "buyerAddress",
    "buyerRegistrationType",
    "invoiceRefNo",
    "companyInvoiceRefNo",
    "transctypeId",
    "item_hsCode",
    "item_productDescription",
    "item_rate",
    "item_uoM",
    "item_quantity",
    "item_unitPrice",
    "item_totalValues",
    "item_valueSalesExcludingST",
    "item_fixedNotifiedValueOrRetailPrice",
    "item_salesTaxApplicable",
    "item_salesTaxWithheldAtSource",
    "item_extraTax",
    "item_furtherTax",
    "item_sroScheduleNo",
    "item_fedPayable",
    "item_discount",
    "item_saleType",
    "item_sroItemSerialNo",
  ];

  const downloadTemplate = async () => {
    try {
      if (!selectedTenant) {
        toast.error("Please select a tenant first");
        return;
      }

      // Disable the button for 10 seconds
      setDownloadButtonDisabled(true);

      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/invoices/template.xlsx`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoice_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Excel template downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Could not download Excel template");
    } finally {
      // Re-enable the button after 10 seconds
      setTimeout(() => {
        setDownloadButtonDisabled(false);
      }, 5000);
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

  // Utility functions to clean data for preview display
  const cleanTransctypeId = (value) => {
    if (!value || String(value).trim() === "" || String(value).trim() === "N/A")
      return "";

    const stringValue = String(value).trim();

    // If it contains " - ", extract the part before the first " - "
    if (stringValue.includes(" - ")) {
      const parts = stringValue.split(" - ");
      const idPart = parts[0].trim();
      // Return the ID part if it's not empty
      return idPart;
    }

    // If no " - " found, assume the entire string is the ID
    return stringValue;
  };

  const cleanHsCode = (value) => {
    if (!value || String(value).trim() === "" || String(value).trim() === "N/A")
      return "";

    const stringValue = String(value).trim();

    // If it contains " - ", extract the part before the first " - "
    if (stringValue.includes(" - ")) {
      const parts = stringValue.split(" - ");
      const codePart = parts[0].trim();
      // Return the code part if it's not empty
      return codePart;
    }

    // If no " - " found, assume the entire string is the code
    return stringValue;
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
    setExistingInvoices([]);
    setNewInvoices([]);

    // Read and parse the file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const data = processFileContent(
          content,
          selectedFile.type,
          selectedFile
        );
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

  const processFileContent = (content, fileType, file) => {
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

          // Check if this row has any meaningful data in the first few columns
          const hasData = values
            .slice(0, 5)
            .some((value) => value && value.trim() !== "");

          if (hasData) {
            const row = {};

            headers.forEach((header, index) => {
              let value = values[index] || "";

              // Convert date format if this is the invoiceDate field
              if (header === "invoiceDate" && value) {
                value = convertExcelDateToYYYYMMDD(value);
              }

              row[header] = value;
            });

            // Only include expected columns
            const filteredRow = {};
            expectedColumns.forEach((col) => {
              filteredRow[col] = row[col] || "";
            });

            // Additional check: exclude rows that are clearly not invoice data
            const invoiceType = String(filteredRow.invoiceType || "")
              .trim()
              .toLowerCase();
            const invoiceDate = String(filteredRow.invoiceDate || "").trim();

            // Skip special rows
            if (
              invoiceType.includes("total") ||
              invoiceType.includes("instruction") ||
              invoiceType.includes("summary") ||
              invoiceType.includes("note")
            ) {
              continue;
            }

            // Must have valid invoice data
            const hasValidInvoiceType =
              invoiceType &&
              invoiceType !== "" &&
              (invoiceType.includes("sale") ||
                invoiceType.includes("purchase"));

            // Validate date format (YYYY-MM-DD)
            const hasValidDate =
              invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate);

            if (hasValidInvoiceType && hasValidDate) {
              data.push(filteredRow);
            }
          }
        }
      }

      return data;
    } else {
      // Excel file parsing using xlsx library
      try {
        const workbook = XLSX.read(content, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert worksheet to JSON with better date handling
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false, // Set to false to get formatted values
          dateNF: "yyyy-mm-dd",
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

          // Check if row exists and has any meaningful data
          if (row && Array.isArray(row)) {
            // Check if the row has any non-empty cells in the first few columns (key fields)
            const hasData = row
              .slice(0, 5)
              .some(
                (cell) =>
                  cell !== null &&
                  cell !== undefined &&
                  String(cell).trim() !== ""
              );

            if (hasData) {
              const rowData = {};

              headers.forEach((header, index) => {
                let value =
                  row[index] !== null && row[index] !== undefined
                    ? String(row[index]).trim()
                    : "";

                // Convert date format if this is the invoiceDate field
                if (
                  header === "invoiceDate" &&
                  row[index] !== null &&
                  row[index] !== undefined
                ) {
                  // Handle different types that xlsx might return for dates
                  if (row[index] instanceof Date) {
                    // If it's already a Date object, format it
                    value = row[index].toISOString().split("T")[0];
                  } else {
                    // Convert the value to string and then process it
                    const dateValue = String(row[index]).trim();
                    value = convertExcelDateToYYYYMMDD(dateValue);
                  }
                }

                rowData[header] = value;
              });

              // Only include expected columns
              const filteredRow = {};
              expectedColumns.forEach((col) => {
                filteredRow[col] = rowData[col] || "";
              });

              // Additional check: exclude rows that are clearly not invoice data
              const invoiceType = String(filteredRow.invoiceType || "")
                .trim()
                .toLowerCase();
              const invoiceDate = String(filteredRow.invoiceDate || "").trim();

              // Skip special rows
              if (
                invoiceType.includes("total") ||
                invoiceType.includes("instruction") ||
                invoiceType.includes("summary") ||
                invoiceType.includes("note")
              ) {
                continue;
              }

              // Must have valid invoice data
              const hasValidInvoiceType =
                invoiceType &&
                invoiceType !== "" &&
                (invoiceType.includes("sale") ||
                  invoiceType.includes("purchase"));

              // Validate date format (YYYY-MM-DD)
              const hasValidDate =
                invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate);

              if (hasValidInvoiceType && hasValidDate) {
                data.push(filteredRow);
              }
            }
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
    console.log(`Raw data rows received: ${data.length}`);

    // Filter out completely empty rows and special rows
    let validData = data
      .filter((row, index) => {
        // Skip rows that are clearly not invoice data
        const invoiceType = String(row.invoiceType || "")
          .trim()
          .toLowerCase();
        const invoiceDate = String(row.invoiceDate || "").trim();

        // Exclude special rows
        if (
          invoiceType.includes("total") ||
          invoiceType.includes("instruction") ||
          invoiceType.includes("summary") ||
          invoiceType.includes("note")
        ) {
          return false;
        }

        // Must have meaningful data in key invoice fields
        const hasValidInvoiceType =
          invoiceType &&
          invoiceType !== "" &&
          (invoiceType.includes("sale") || invoiceType.includes("purchase"));

        // Validate date format (YYYY-MM-DD)
        const hasValidDate =
          invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate);

        return hasValidInvoiceType && hasValidDate;
      })
      .map((row, index) => {
        // Ensure all expected columns exist with default values if missing
        const processedRow = {};
        expectedColumns.forEach((col) => {
          let value = row[col] || "";

          // Ensure date format is correct
          if (col === "invoiceDate" && value) {
            value = convertExcelDateToYYYYMMDD(value);
          }

          // Clean transctypeId and hsCode for preview display
          if (col === "transctypeId" && value) {
            value = cleanTransctypeId(value);
          }

          if (col === "item_hsCode" && value) {
            value = cleanHsCode(value);
          }

          processedRow[col] = value;
        });
        return processedRow;
      });

    console.log(`Valid data rows after filtering: ${validData.length}`);

    // Populate seller details from selected tenant
    if (selectedTenant) {
      validData = validData.map((row) => ({
        ...row,
        sellerNTNCNIC: selectedTenant.seller_ntn_cnic || "",
        sellerFullNTN: selectedTenant.seller_full_ntn || "",
        sellerBusinessName: selectedTenant.seller_business_name || "",
        sellerProvince: selectedTenant.seller_province || "",
        sellerAddress: selectedTenant.seller_address || "",
      }));
    }

    // Pre-check buyer registration via backend proxy and validate against sheet selection
    const precheckErrors = [];
    const checkedRows = [];
    for (let i = 0; i < validData.length; i++) {
      const row = validData[i];
      const ntn = String(row.buyerNTNCNIC || "").trim();
      const regType = String(row.buyerRegistrationType || "").trim();
      if (!ntn) {
        checkedRows.push(row);
        continue;
      }
      try {
        const resp = await fetch(
          "https://biomedics.inplsoftwares.online/api/buyer-check",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registrationNo: ntn }),
          }
        );
        const data = await resp.json().catch(() => ({}));
        let derived = "";
        if (data && typeof data.REGISTRATION_TYPE === "string") {
          derived =
            data.REGISTRATION_TYPE.toLowerCase() === "registered"
              ? "Registered"
              : "Unregistered";
        } else {
          let isRegistered = false;
          if (typeof data === "boolean") {
            isRegistered = data;
          } else if (data) {
            isRegistered =
              data.isRegistered === true ||
              data.registered === true ||
              (typeof data.status === "string" &&
                data.status.toLowerCase() === "registered") ||
              (typeof data.registrationType === "string" &&
                data.registrationType.toLowerCase() === "registered");
          }
          derived = isRegistered ? "Registered" : "Unregistered";
        }

        // If user marked Unregistered but FBR says Registered, block
        if (regType === "Unregistered" && derived === "Registered") {
          precheckErrors.push({
            row: i + 1,
            error:
              "Buyer ki Registration Type correct nahi hai (FBR: Registered)",
          });
        }
        checkedRows.push(row);
      } catch (e) {
        // Non-blocking: if precheck fails, allow but note warning
        checkedRows.push(row);
      }
    }

    if (precheckErrors.length > 0) {
      setErrors(precheckErrors);
      toast.error(
        `Buyer registration issues found in ${precheckErrors.length} rows. Fix before upload.`
      );
      setPreviewData([]);
      return;
    }

    setErrors([]);
    setPreviewData(validData);

    // Check for existing invoices if we have data
    if (validData.length > 0 && selectedTenant) {
      await checkExistingInvoices(validData);
    }
  };

  const checkExistingInvoices = async (invoicesData) => {
    if (!selectedTenant) {
      toast.error("No tenant selected");
      return;
    }

    setCheckingExisting(true);
    try {
      // Clean the data before checking - extract only IDs for transctypeId and hsCode
      const cleanedData = invoicesData.map((invoice) => {
        const cleanedInvoice = { ...invoice };

        // Clean transctypeId - extract only the ID part
        if (cleanedInvoice.transctypeId) {
          cleanedInvoice.transctypeId = cleanTransctypeId(
            cleanedInvoice.transctypeId
          );
        }

        // Clean item_hsCode - extract only the code part
        if (cleanedInvoice.item_hsCode) {
          cleanedInvoice.item_hsCode = cleanHsCode(cleanedInvoice.item_hsCode);
        }

        return cleanedInvoice;
      });

      // Limit the number of invoices sent for checking to avoid payload size issues
      const limitedData = cleanedData.slice(0, 100); // Only check first 100 invoices

      const response = await api.post(
        `/tenant/${selectedTenant.tenant_id}/invoices/check-existing`,
        { invoices: limitedData }
      );

      const { existing, new: newInvoicesData } = response.data.data;
      setExistingInvoices(existing);
      setNewInvoices(newInvoicesData);

      if (existing.length > 0) {
        toast.info(
          `${existing.length} invoices already exist and will be skipped during upload`
        );
      }
    } catch (error) {
      console.error("Error checking existing invoices:", error);
      // Don't show error toast, just log it and continue
      // This allows the upload to proceed even if checking fails
      setExistingInvoices([]);
      setNewInvoices([]);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleUpload = async () => {
    if (!file || previewData.length === 0) {
      toast.error("Please select a valid file with invoice data to upload");
      return;
    }

    setUploading(true);
    try {
      // Clean the data before uploading - extract only IDs for transctypeId and hsCode
      const invoicesToUpload = previewData.map((invoice) => {
        const cleanedInvoice = { ...invoice };

        // Clean transctypeId - extract only the ID part
        if (cleanedInvoice.transctypeId) {
          cleanedInvoice.transctypeId = cleanTransctypeId(
            cleanedInvoice.transctypeId
          );
        }

        // Clean item_hsCode - extract only the code part
        if (cleanedInvoice.item_hsCode) {
          cleanedInvoice.item_hsCode = cleanHsCode(cleanedInvoice.item_hsCode);
        }

        return cleanedInvoice;
      });

      const result = await onUpload(invoicesToUpload);

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
            `Upload completed with issues:\n\n${summary.successful} invoices added successfully\n${summary.failed} invoices failed\n\nError details:\n${errorDetails}`
          );
        } else {
          toast.success(
            `Successfully uploaded ${summary.successful} invoices as drafts!`
          );
        }
      } else {
        toast.success(
          `Successfully uploaded ${invoicesToUpload.length} invoices as drafts`
        );
      }

      handleClose();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading invoices. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setShowPreview(false);
    setExistingInvoices([]);
    setNewInvoices([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const removeFile = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setExistingInvoices([]);
    setNewInvoices([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Create a combined preview data with status indicators
  const getCombinedPreviewData = () => {
    const combined = [];

    // Add existing invoices with status
    existingInvoices.forEach((item) => {
      combined.push({
        ...item.invoiceData,
        _status: "existing",
        _existingInvoice: item.existingInvoice,
        _row: item.row,
      });
    });

    // Add new invoices with status
    newInvoices.forEach((item) => {
      combined.push({
        ...item.invoiceData,
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
          <Typography variant="h6">
            Upload Invoices from File (Draft Status)
          </Typography>
          <IconButton onClick={handleClose}>
            <Delete />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV or Excel file with invoice data. All invoices will be
            saved with "draft" status. Invoice numbers will be generated
            automatically by the system. Seller details will be automatically
            populated from the selected tenant. All data from the file will be
            accepted.
          </Typography>

          {/* Download Template Button */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={downloadTemplate}
              disabled={downloadButtonDisabled}
              size="small"
            >
              {downloadButtonDisabled
                ? "Downloading..."
                : "Download Excel Template"}
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

        {/* Existing Invoices Alert */}
        {existingInvoices.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {existingInvoices.length} invoices already exist and will be
              skipped:
            </Typography>
            {existingInvoices.slice(0, 3).map((item, index) => (
              <Typography key={index} variant="body2">
                Row {item.row}: {item.invoiceData.invoice_number} -{" "}
                {item.invoiceData.sellerBusinessName}
                (Already exists as: {item.existingInvoice.sellerBusinessName})
              </Typography>
            ))}
            {existingInvoices.length > 3 && (
              <Typography variant="body2">
                ... and {existingInvoices.length - 3} more existing invoices
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
                      {expectedColumns.map((column) => (
                        <TableCell
                          key={column}
                          sx={{
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          {column}
                        </TableCell>
                      ))}
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
                                title={`Already exists as: ${row._existingInvoice.sellerBusinessName}`}
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
                          {expectedColumns.map((column) => (
                            <TableCell key={column}>
                              {column === "transctypeId"
                                ? cleanTransctypeId(row[column]) || "-"
                                : column === "item_hsCode"
                                  ? cleanHsCode(row[column]) || "-"
                                  : row[column] || "-"}
                            </TableCell>
                          ))}
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
                  Checking for existing invoices...
                </Typography>
              </Box>
            ) : (
              <>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">
                    {previewData.length} invoices ready to upload as drafts
                  </Typography>
                </Box>
                {existingInvoices.length > 0 && (
                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Warning color="warning" />
                    <Typography variant="body2" color="warning.main">
                      {existingInvoices.length} invoices will be skipped
                      (already exist)
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
            !file || previewData.length === 0 || uploading || checkingExisting
          }
          startIcon={
            uploading ? <CircularProgress size={20} /> : <FileUpload />
          }
        >
          {uploading
            ? "Uploading..."
            : `Upload ${previewData.length} Invoices as Drafts`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceUploader;
