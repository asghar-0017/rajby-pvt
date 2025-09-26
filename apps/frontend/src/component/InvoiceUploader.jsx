import React, { useState, useRef, useEffect } from "react";
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
  LinearProgress,
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
  Cancel,
  Close,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { api } from "../API/Api";
import * as XLSX from "xlsx";
import { useFileProcessor } from "../hooks/useFileProcessor";
import { useStreamingUpload } from "../hooks/useStreamingUpload";

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
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Debug: Monitor uploadResults changes
  useEffect(() => {
    console.log("uploadResults state changed:", uploadResults);
    console.log("showResults state changed:", showResults);
  }, [uploadResults, showResults]);

  const fileInputRef = useRef(null);

  // Use Web Worker for file processing
  const {
    isProcessing,
    progress,
    progressMessage,
    error: processingError,
    processFile: processFileWithWorker,
    cancelProcessing,
    cleanup,
    reset: resetProcessor,
  } = useFileProcessor();

  // Use streaming upload for large uploads
  const {
    isUploading,
    uploadProgress,
    uploadResult,
    uploadError,
    startUpload,
    cancelUpload,
    resetUpload,
    estimateUploadTime,
    getUploadStats,
  } = useStreamingUpload();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Expected columns for invoice data (including buyer details) - now optional
  const expectedColumns = [
    // Invoice details
    "invoiceType",
    "invoiceDate",
    "invoiceRefNo",
    "companyInvoiceRefNo",
    // Buyer details (only NTN/CNIC kept)
    "buyerNTNCNIC",
    // Transaction and item details
    "transctypeId",
    "item_rate",
    "item_sroScheduleNo",
    "item_sroItemSerialNo",
    "item_saleType",
    "item_hsCode",
    "item_uoM",
    "item_productName",
    "item_valueSalesExcludingST",
    "item_quantity",
    "item_unitPrice",
    "item_salesTaxApplicable",
    "item_salesTaxWithheldAtSource",
    "item_extraTax",
    "item_furtherTax",
    "item_fedPayable",
    "item_discount",
    "item_totalValues",
  ];

  // Required columns (invoiceRefNo is optional)
  const requiredColumns = expectedColumns.filter(
    (col) => col !== "invoiceRefNo"
  );

  // Map display headers (as shown in Excel) back to internal keys
  const displayToInternalHeaderMap = {
    "Invoice Type": "invoiceType",
    "Invoice Date": "invoiceDate",
    "Invoice Ref No": "invoiceRefNo",
    "Company Invoice Ref No": "companyInvoiceRefNo",
    "Buyer NTN/CNIC": "buyerNTNCNIC",
    "Transaction Type": "transctypeId",
    Rate: "item_rate",
    "SRO Schedule No": "item_sroScheduleNo",
    "SRO Item No": "item_sroItemSerialNo",
    "Sale Type": "item_saleType",
    "HS Code": "item_hsCode",
    "Unit Of Measurement": "item_uoM",
    "Product Name": "item_productName",
    "Value Sales (Excl ST)": "item_valueSalesExcludingST",
    Quantity: "item_quantity",
    "Unit Cost": "item_unitPrice",
    "Sales Tax Applicable": "item_salesTaxApplicable",
    "ST Withheld at Source": "item_salesTaxWithheldAtSource",
    "Extra Tax": "item_extraTax",
    "Further Tax": "item_furtherTax",
    "FED Payable": "item_fedPayable",
    Discount: "item_discount",
    "Total Values": "item_totalValues",
    // Additional mappings for common variations
    "dn_invoice_ref_no": "invoiceRefNo",
    "invoice_ref_no": "invoiceRefNo",
    "invoice_ref_number": "invoiceRefNo",
    "invoice_number": "invoiceRefNo",
    "internal_invoice_no": "companyInvoiceRefNo",
    "internal_invoice_number": "companyInvoiceRefNo",
    "buyer_ntn_cnic": "buyerNTNCNIC",
    "buyer_ntn": "buyerNTNCNIC",
    "transaction_type": "transctypeId",
    "transctype_id": "transctypeId",
    "product_name": "item_productName",
    "hs_code": "item_hsCode",
    "hscode": "item_hsCode",
    "quantity": "item_quantity",
    "unit_price": "item_unitPrice",
    "unit_cost": "item_unitPrice",
    "total_values": "item_totalValues",
    "value_sales_excluding_st": "item_valueSalesExcludingST",
    "sales_tax_applicable": "item_salesTaxApplicable",
    "st_withheld_at_source": "item_salesTaxWithheldAtSource",
    "extra_tax": "item_extraTax",
    "further_tax": "item_furtherTax",
    "fed_payable": "item_fedPayable",
    "discount": "item_discount",
    "unit_of_measurement": "item_uoM",
    "uom": "item_uoM",
    "rate": "item_rate",
    "sro_schedule_no": "item_sroScheduleNo",
    "sro_item_serial_no": "item_sroItemSerialNo",
    "sale_type": "item_saleType",
  };

  const normalizeHeader = (h) => {
    const header = String(h || "").trim();

    // First try exact match
    if (displayToInternalHeaderMap[header]) {
      return displayToInternalHeaderMap[header];
    }

    // Try partial matches for truncated headers
    const partialMatches = {
      "Invoice Da": "invoiceDate",
      "Invoice Re": "invoiceRefNo",
      "Company I": "companyInvoiceRefNo",
      "Buyer NTN": "buyerNTNCNIC",
      Transactio: "transctypeId",
      "SRO Sched": "item_sroScheduleNo",
      "SRO Item": "item_sroItemSerialNo",
      "Product Na": "item_productName",
      "Value Sale": "item_valueSalesExcludingST",
      "Unit Of Me": "item_uoM",
      "Sales Tax": "item_salesTaxApplicable",
      "ST Withheld": "item_salesTaxWithheldAtSource",
      "FED Payab": "item_fedPayable",
      "Total Valu": "item_totalValues",
    };

    if (partialMatches[header]) {
      return partialMatches[header];
    }

    // Fallback to original header
    return header;
  };

  // Utility function to check if a row has meaningful data
  const hasMeaningfulData = (row, rowIndex) => {
    // Check for meaningful invoice-level data
    const hasInvoiceData =
      (row.invoiceType &&
        row.invoiceType.trim() !== "" &&
        row.invoiceType !== "Standard") ||
      (row.invoiceDate && row.invoiceDate.trim() !== "") ||
      (row.companyInvoiceRefNo &&
        row.companyInvoiceRefNo.trim() !== "" &&
        row.companyInvoiceRefNo !== `row_${rowIndex + 1}`) ||
      (row.buyerNTNCNIC && row.buyerNTNCNIC.trim() !== "");

    // Check for meaningful item-level data
    const hasItemData =
      (row.item_productName && row.item_productName.trim() !== "") ||
      (row.item_hsCode && row.item_hsCode.trim() !== "") ||
      (row.item_quantity &&
        row.item_quantity !== "" &&
        row.item_quantity !== "0" &&
        row.item_quantity !== 0) ||
      (row.item_unitPrice &&
        row.item_unitPrice !== "" &&
        row.item_unitPrice !== "0" &&
        row.item_unitPrice !== 0) ||
      (row.item_totalValues &&
        row.item_totalValues !== "" &&
        row.item_totalValues !== "0" &&
        row.item_totalValues !== 0) ||
      (row.item_valueSalesExcludingST &&
        row.item_valueSalesExcludingST !== "" &&
        row.item_valueSalesExcludingST !== "0" &&
        row.item_valueSalesExcludingST !== 0);

    const hasData = hasInvoiceData || hasItemData;

    // Debug logging for empty rows
    if (!hasData && rowIndex < 10) {
      // Only log first 10 for debugging
      console.log(`🚫 Row ${rowIndex + 1} filtered out as empty:`, {
        invoiceType: row.invoiceType,
        companyInvoiceRefNo: row.companyInvoiceRefNo,
        item_productName: row.item_productName,
        item_hsCode: row.item_hsCode,
        item_quantity: row.item_quantity,
        item_unitPrice: row.item_unitPrice,
      });
    }

    return hasData;
  };

  // Flexible meaningful data check that works with any column structure
  const hasMeaningfulDataFlexible = (row, headers, rowIndex) => {
    // Check if any cell has meaningful data (not empty, not just whitespace, not "0")
    const hasAnyData = Object.values(row).some((value) => {
      const strValue = String(value).trim();
      return (
        strValue !== "" &&
        strValue !== "0" &&
        strValue !== "null" &&
        strValue !== "undefined"
      );
    });

    // If no data at all, skip
    if (!hasAnyData) {
      return false;
    }

    // Check for instruction patterns in any field - if found, reject
    const instructionPatterns = [
      "auto-calculates",
      "enter ",
      "use the",
      "dropdown",
      "validated",
      "hardcoded",
      "fallback",
      "unit cost",
      "value sales",
      "sales tax",
      "computed",
      "computed as",
      "divided by",
    ];

    const hasInstructionPatterns = Object.values(row).some((value) => {
      const strValue = String(value).toLowerCase();
      return instructionPatterns.some((pattern) => strValue.includes(pattern));
    });

    if (hasInstructionPatterns) {
      return false;
    }

    // Check for numbered list patterns (1., 2., a., b., etc.)
    const hasNumberedListPattern = Object.values(row).some((value) => {
      const strValue = String(value).trim();
      return /^\d+\.\s/.test(strValue) || /^[a-z]\.\s/i.test(strValue);
    });

    if (hasNumberedListPattern) {
      return false;
    }

    // Check for common invoice-related keywords in any field
    const invoiceKeywords = [
      "invoice",
      "bill",
      "receipt",
      "order",
      "purchase",
      "sale",
      "product",
      "item",
      "quantity",
      "price",
      "amount",
      "total",
    ];
    const hasInvoiceKeywords = Object.values(row).some((value) => {
      const strValue = String(value).toLowerCase();
      return invoiceKeywords.some((keyword) => strValue.includes(keyword));
    });

    // Check for numeric values that might indicate quantities or prices
    const hasNumericData = Object.values(row).some((value) => {
      const strValue = String(value).trim();
      const numValue = parseFloat(strValue);
      return !isNaN(numValue) && numValue > 0;
    });

    // Check for date-like values
    const hasDateData = Object.values(row).some((value) => {
      const strValue = String(value).trim();
      // Simple date pattern check
      return (
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(strValue) ||
        /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(strValue)
      );
    });

    // Accept if it has any meaningful data and either invoice keywords, numeric data, or date data
    return hasAnyData && (hasInvoiceKeywords || hasNumericData || hasDateData);
  };

  // Buyer selection removed; buyer details should be provided in the sheet

  // Old function - commented out (was using backend API)
  // const downloadExistingTemplate = async () => {
  //   // ... implementation details ...
  // };

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

    console.log(
      "🔍 cleanHsCode input:",
      stringValue.substring(0, 100) + (stringValue.length > 100 ? "..." : "")
    );

    // If it contains " - ", extract the part before the first " - "
    if (stringValue.includes(" - ")) {
      const parts = stringValue.split(" - ");
      const codePart = parts[0].trim();
      console.log("🔍 cleanHsCode output:", codePart);
      // Return the code part if it's not empty
      return codePart;
    }

    // If no " - " found, assume the entire string is the code
    console.log("🔍 cleanHsCode output (no dash):", stringValue);
    return stringValue;
  };

  const processFile = async (selectedFile) => {
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
    resetProcessor();

    try {
      // Use Web Worker for file processing
      const result = await processFileWithWorker(selectedFile, expectedColumns);

      if (result.success) {
        const { invoices, errors: processingErrors, warnings } = result.data;
        setPreviewData(invoices);
        setErrors(processingErrors);

        if (processingErrors.length > 0) {
          toast.warning(
            `File processed with ${processingErrors.length} errors`
          );
        } else {
          toast.success(
            `File processed successfully: ${invoices.length} invoices found`
          );
        }

        // Check for existing invoices
        await checkExistingInvoices(invoices);
      } else {
        toast.error(`File processing failed: ${result.error}`);
        setErrors([{ message: result.error }]);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error processing file. Please try again.");
      setErrors([{ message: error.message }]);
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

      // Parse headers and normalize to internal keys
      const headers = parseCSVLine(lines[0]).map((h) => normalizeHeader(h));

      // Log missing headers but don't throw error - process whatever columns are available
      const missingHeaders = expectedColumns.filter(
        (col) => !headers.includes(col)
      );
      if (missingHeaders.length > 0) {
        console.warn(
          `Missing expected columns: ${missingHeaders.join(", ")}. Processing with available columns.`
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

            // Use utility function to check for meaningful data
            if (hasMeaningfulData(filteredRow, i - 1)) {
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

        // Get headers from first row and normalize
        const headers = jsonData[0].map((header) => normalizeHeader(header));

        // Log available headers for debugging
        console.log("Available headers in Excel file:", headers);
        console.log("Expected columns:", expectedColumns);

        // Log missing headers but don't throw error - process whatever columns are available
        const missingHeaders = expectedColumns.filter(
          (col) => !headers.includes(col)
        );
        if (missingHeaders.length > 0) {
          console.warn(
            `Missing expected columns: ${missingHeaders.join(", ")}. Processing with available columns.`
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

              // Debug: Log raw parsed data for first few rows
              if (i <= 3) {
                console.log(`🔍 Raw Excel Row ${i}:`, {
                  headers: headers,
                  rawRow: row,
                  parsedRowData: rowData,
                  companyInvoiceRefNo: rowData.companyInvoiceRefNo,
                  hasCompanyInvoiceRefNo: !!rowData.companyInvoiceRefNo,
                  internalInvoiceNo: rowData.internalInvoiceNo, // Still logged for reference
                  productName: rowData.item_productName,
                  hsCode: rowData.item_hsCode,
                  quantity: rowData.item_quantity,
                  unitPrice: rowData.item_unitPrice,
                });
              }

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

              // Skip special rows - check for instruction patterns
              if (
                invoiceType.includes("total") ||
                invoiceType.includes("instruction") ||
                invoiceType.includes("summary") ||
                invoiceType.includes("note") ||
                invoiceType.includes("auto-calculates") ||
                invoiceType.includes("enter ") ||
                invoiceType.includes("use the") ||
                invoiceType.includes("dropdown") ||
                invoiceType.includes("validated") ||
                invoiceType.includes("hardcoded") ||
                invoiceType.includes("fallback") ||
                /^\d+\.\s/.test(invoiceType) || // Starts with number followed by period and space
                /^[a-z]\.\s/i.test(invoiceType) // Starts with letter followed by period and space
              ) {
                continue;
              }

              // Use utility function to check for meaningful data
              // Also try with the raw row data in case the filtered row is empty
              if (
                hasMeaningfulData(filteredRow, i - 1) ||
                hasMeaningfulDataFlexible(rowData, headers, i - 1)
              ) {
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

        // Use utility function to check for meaningful data
        return hasMeaningfulData(row, index);
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

    // Log details about filtered rows for debugging
    const filteredOutCount = data.length - validData.length;
    if (filteredOutCount > 0) {
      console.log(`🚫 Filtered out ${filteredOutCount} empty/invalid rows`);
      console.log(`✅ Kept ${validData.length} rows with meaningful data`);
    }

    // Populate seller details from selected tenant
    if (selectedTenant) {
      // Validate that tenant has required seller information
      if (!selectedTenant.sellerNTNCNIC || !selectedTenant.sellerBusinessName) {
        toast.error(
          "Selected company is missing required seller information (NTN/CNIC or Business Name)"
        );
        setPreviewData([]);
        return;
      }

      validData = validData.map((row) => ({
        ...row,
        sellerNTNCNIC: selectedTenant.sellerNTNCNIC || "",
        sellerFullNTN: selectedTenant.sellerFullNTN || "",
        sellerBusinessName: selectedTenant.sellerBusinessName || "",
        sellerProvince: selectedTenant.sellerProvince || "",
        sellerAddress: selectedTenant.sellerAddress || "",
      }));
    } else {
      toast.error("Please select a tenant before uploading invoices");
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
      toast.error("No company selected");
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

      // Check all invoices for existing ones - no limit
      const limitedData = cleanedData; // Check all invoices

      // Skip API call if no data to check
      if (!limitedData || limitedData.length === 0) {
        console.log("No data to check for existing invoices, skipping API call");
        setExistingInvoices([]);
        setNewInvoices([]);
        return;
      }

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
    setUploadResults(null);
    setShowResults(false);
    try {
      // Check if previewData contains already-grouped invoices (from worker) or individual rows
      const isAlreadyGrouped =
        previewData.length > 0 &&
        previewData[0].items &&
        Array.isArray(previewData[0].items);

      let invoicesToUpload;

      if (isAlreadyGrouped) {
        // Data is already grouped by worker, use it directly
        console.log("🔍 Using already-grouped invoices from worker");
        invoicesToUpload = previewData.map((invoice) => ({
          ...invoice,
          // Ensure seller details are populated from selected tenant
          sellerNTNCNIC: selectedTenant?.sellerNTNCNIC || "",
          sellerFullNTN: selectedTenant?.sellerFullNTN || "",
          sellerBusinessName: selectedTenant?.sellerBusinessName || "",
          sellerProvince: selectedTenant?.sellerProvince || "",
          sellerAddress: selectedTenant?.sellerAddress || "",
        }));
      } else {
        // Data is individual rows, need to group them
        console.log("🔍 Grouping individual rows");
        const groupedInvoices = new Map();
        const groupingErrors = [];

        previewData.forEach((row, index) => {
          // Clean the row data before processing
          const cleanedItem = { ...row };

          // Clean transctypeId - extract only the ID part
          if (cleanedItem.transctypeId) {
            cleanedItem.transctypeId = cleanTransctypeId(
              cleanedItem.transctypeId
            );
          }

          // Clean item_hsCode - extract only the code part
          if (cleanedItem.item_hsCode) {
            cleanedItem.item_hsCode = cleanHsCode(cleanedItem.item_hsCode);
          }

          // Map Excel field names to backend expected field names
          // Backend expects productName or name, but Excel sends item_productName
          console.log("🔍 Frontend Debug: Before mapping:", {
            item_productName: cleanedItem.item_productName,
            name: cleanedItem.name,
            productName: cleanedItem.productName,
          });

          if (
            cleanedItem.item_productName &&
            cleanedItem.item_productName.trim() !== ""
          ) {
            cleanedItem.productName = cleanedItem.item_productName;
            cleanedItem.name = cleanedItem.item_productName;
            console.log(
              "✅ Frontend: Mapped product name:",
              cleanedItem.item_productName
            );
          } else {
            console.log("❌ Frontend: No valid item_productName found");
          }

          console.log("🔍 Frontend Debug: After mapping:", {
            name: cleanedItem.name,
            productName: cleanedItem.productName,
          });

          // Map other item fields to remove the 'item_' prefix
          if (cleanedItem.item_hsCode) {
            cleanedItem.hsCode = cleanedItem.item_hsCode;
          }
          if (cleanedItem.item_rate) {
            cleanedItem.rate = cleanedItem.item_rate;
          }
          if (cleanedItem.item_uoM) {
            cleanedItem.uoM = cleanedItem.item_uoM;
          }
          if (cleanedItem.item_quantity) {
            cleanedItem.quantity = cleanedItem.item_quantity;
          }
          if (cleanedItem.item_unitPrice) {
            cleanedItem.unitPrice = cleanedItem.item_unitPrice;
          }
          if (cleanedItem.item_totalValues) {
            cleanedItem.totalValues = cleanedItem.item_totalValues;
          }
          if (cleanedItem.item_valueSalesExcludingST) {
            cleanedItem.valueSalesExcludingST =
              cleanedItem.item_valueSalesExcludingST;
          }
          if (cleanedItem.item_fixedNotifiedValueOrRetailPrice) {
            cleanedItem.fixedNotifiedValueOrRetailPrice =
              cleanedItem.item_fixedNotifiedValueOrRetailPrice;
          }
          if (cleanedItem.item_salesTaxApplicable) {
            cleanedItem.salesTaxApplicable =
              cleanedItem.item_salesTaxApplicable;
          }
          if (cleanedItem.item_extraTax) {
            cleanedItem.extraTax = cleanedItem.item_extraTax;
          }
          if (cleanedItem.item_furtherTax) {
            cleanedItem.furtherTax = cleanedItem.item_furtherTax;
          }
          if (cleanedItem.item_sroScheduleNo) {
            cleanedItem.sroScheduleNo = cleanedItem.item_sroScheduleNo;
          }
          if (cleanedItem.item_fedPayable) {
            cleanedItem.fedPayable = cleanedItem.item_fedPayable;
          }
          if (cleanedItem.item_discount) {
            cleanedItem.discount = cleanedItem.item_discount;
          }
          if (cleanedItem.item_saleType) {
            cleanedItem.saleType = cleanedItem.item_saleType;
          }
          if (cleanedItem.item_sroItemSerialNo) {
            cleanedItem.sroItemSerialNo = cleanedItem.item_sroItemSerialNo;
          }

          // Get the companyInvoiceRefNo for grouping (changed from internalInvoiceNo)
          const companyInvoiceRefNo =
            cleanedItem.companyInvoiceRefNo?.trim() || `row_${index + 1}`;

          // Add row number for tracking
          cleanedItem._row = index + 1;

          if (groupedInvoices.has(companyInvoiceRefNo)) {
            // Add item to existing invoice group
            const existingInvoice = groupedInvoices.get(companyInvoiceRefNo);

            // Validate consistency of invoice-level data
            const consistencyErrors = [];

            if (existingInvoice.invoiceType !== cleanedItem.invoiceType) {
              consistencyErrors.push(
                `Invoice Type mismatch: ${existingInvoice.invoiceType} vs ${cleanedItem.invoiceType}`
              );
            }
            if (existingInvoice.invoiceDate !== cleanedItem.invoiceDate) {
              consistencyErrors.push(
                `Invoice Date mismatch: ${existingInvoice.invoiceDate} vs ${cleanedItem.invoiceDate}`
              );
            }
            if (existingInvoice.buyerNTNCNIC !== cleanedItem.buyerNTNCNIC) {
              consistencyErrors.push(
                `Buyer NTN/CNIC mismatch: ${existingInvoice.buyerNTNCNIC} vs ${cleanedItem.buyerNTNCNIC}`
              );
            }

            if (consistencyErrors.length > 0) {
              groupingErrors.push({
                row: index + 1,
                companyInvoiceRefNo: companyInvoiceRefNo,
                errors: consistencyErrors,
                message: `Row ${index + 1} has different invoice-level data than other rows with companyInvoiceRefNo: ${companyInvoiceRefNo}`,
              });
            }

            existingInvoice.items.push(cleanedItem);
          } else {
            // Create new invoice group
            groupedInvoices.set(companyInvoiceRefNo, {
              invoiceType: cleanedItem.invoiceType,
              invoiceDate: cleanedItem.invoiceDate,
              invoiceRefNo: cleanedItem.invoiceRefNo,
              companyInvoiceRefNo: cleanedItem.companyInvoiceRefNo,
              internalInvoiceNo: cleanedItem.internalInvoiceNo, // Keep this for reference
              // Seller details from selected tenant
              sellerNTNCNIC: selectedTenant?.sellerNTNCNIC || "",
              sellerFullNTN: selectedTenant?.sellerFullNTN || "",
              sellerBusinessName: selectedTenant?.sellerBusinessName || "",
              sellerProvince: selectedTenant?.sellerProvince || "",
              sellerAddress: selectedTenant?.sellerAddress || "",
              // Buyer details
              buyerNTNCNIC: cleanedItem.buyerNTNCNIC,
              items: [cleanedItem],
              _row: index + 1, // Track the first row for this invoice
            });
          }
        });

        // Check for grouping errors
        if (groupingErrors.length > 0) {
          console.error("Grouping validation errors:", groupingErrors);
          toast.error(
            `Found ${groupingErrors.length} grouping validation errors. Rows with the same Company Invoice Ref No must have consistent invoice-level data. Check console for details.`
          );
          setUploading(false);
          return;
        }

        // Ensure all invoice groups have seller details from selected tenant
        invoicesToUpload = Array.from(groupedInvoices.values()).map(
          (invoice) => ({
            ...invoice,
            sellerNTNCNIC: selectedTenant?.sellerNTNCNIC || "",
            sellerFullNTN: selectedTenant?.sellerFullNTN || "",
            sellerBusinessName: selectedTenant?.sellerBusinessName || "",
            sellerProvince: selectedTenant?.sellerProvince || "",
            sellerAddress: selectedTenant?.sellerAddress || "",
          })
        );
      }

      // Log seller details being populated
      console.log("🔍 Debug: Seller details populated from tenant:", {
        tenantName: selectedTenant?.sellerBusinessName,
        sellerNTNCNIC: selectedTenant?.sellerNTNCNIC,
        sellerProvince: selectedTenant?.sellerProvince,
        sellerAddress: selectedTenant?.sellerAddress,
        totalInvoices: invoicesToUpload.length,
      });

      console.log("🔍 Debug: Grouped invoices for backend:", {
        totalInvoices: invoicesToUpload.length,
        totalRows: previewData.length,
        sampleInvoice: invoicesToUpload[0],
        sampleInvoiceItems: invoicesToUpload[0]?.items?.length || 0,
        sampleCompanyInvoiceRefNo: invoicesToUpload[0]?.companyInvoiceRefNo,
        hasCompanyInvoiceRefNo: !!invoicesToUpload[0]?.companyInvoiceRefNo,
        sampleInternalInvoiceNo: invoicesToUpload[0]?.internalInvoiceNo, // Still logged for reference
        groupingSummary: invoicesToUpload.map((inv) => ({
          companyInvoiceRefNo: inv.companyInvoiceRefNo,
          internalInvoiceNo: inv.internalInvoiceNo, // Still included for reference
          itemCount: inv.items.length,
          rows: inv.items.map((item) => item._row),
        })),
      });

      // Use streaming upload for large files, regular upload for small files
      if (invoicesToUpload.length > 100) {
        // Estimate upload time
        const estimate = estimateUploadTime(invoicesToUpload.length);
        toast.info(
          `Starting upload of ${invoicesToUpload.length} invoices. Estimated time: ${estimate.estimatedTimeMinutes} minutes`
        );

        // Use streaming upload
        const result = await startUpload(invoicesToUpload, {
          tenantId: selectedTenant.tenant_id,
          chunkSize: 500,
        });

        if (result.success) {
          console.log("Streaming upload result:", result);
          const { successfulInvoices, failedInvoices, errors, summary } = result;

          // Store detailed results for display
          const detailedResults = {
            summary: summary || {
              successful: successfulInvoices,
              failed: failedInvoices,
              total: successfulInvoices + failedInvoices
            },
            errors: errors || [],
            performance: result.performance || null,
            successfulInvoices: [],
            failedInvoices: [],
          };

          // Process successful invoices - only show actually successful ones
          if (successfulInvoices > 0) {
            // Create a map of successful invoice indices
            const successfulIndices = new Set();
            const errorRows = new Set(errors.map(error => error.row));
            
            // Only include invoices that don't have errors
            invoicesToUpload.forEach((invoice, index) => {
              if (!errorRows.has(index + 1)) {
                successfulIndices.add(index);
              }
            });
            
            detailedResults.successfulInvoices = Array.from(successfulIndices).map((index) => {
              const invoice = invoicesToUpload[index];
              return {
                row: index + 1,
                invoiceNumber: invoice.internalInvoiceNo || `Invoice ${index + 1}`,
                buyerName: invoice.buyerNTNCNIC || '',
                status: 'success'
              };
            });
          }

          // Process failed invoices with detailed error information
          if (errors && errors.length > 0) {
            console.log("🔍 Processing errors:", errors);
            detailedResults.failedInvoices = errors.map((error, index) => {
              // Find the actual invoice data from the original upload
              const originalInvoice = invoicesToUpload.find((inv, idx) => idx + 1 === error.row) || 
                                     invoicesToUpload[error.row - 1] || 
                                     invoicesToUpload[index];
              
              const failedInvoice = {
                row: error.row || index + 1,
                invoiceNumber: originalInvoice?.internalInvoiceNo || `Invoice ${error.row || index + 1}`,
                buyerName: originalInvoice?.buyerBusinessName || '',
                error: error.error || error.errors?.join(', ') || 'Unknown error',
                status: 'failed'
              };
              
              console.log("🔍 Created failed invoice:", failedInvoice);
              return failedInvoice;
            });
            console.log("🔍 Final failedInvoices array:", detailedResults.failedInvoices);
          }

        // Set results and show them
        setUploadResults(detailedResults);
        setShowResults(true);
        console.log("Streaming upload results set:", detailedResults);
        console.log("showResults state set to true");
        console.log("uploadResults state:", detailedResults);
        
        // Force show results after a short delay to ensure state is updated
        setTimeout(() => {
          console.log("Timeout check - uploadResults:", uploadResults);
          console.log("Timeout check - showResults:", showResults);
          
          // Force re-render by updating state again
          setUploadResults(prev => {
            console.log("Force update uploadResults:", prev);
            return prev;
          });
          setShowResults(prev => {
            console.log("Force update showResults:", prev);
            return prev;
          });
        }, 100);

          // Check if there are any errors (including product validation errors)
          const hasErrors = errors && errors.length > 0;
          const actualSuccessfulCount = detailedResults.successfulInvoices.length;
          const actualFailedCount = detailedResults.failedInvoices.length;
          
          if (hasErrors) {
            toast.warning(
              `Upload completed with issues: ${actualSuccessfulCount} invoices added successfully, ${actualFailedCount} invoices failed due to validation errors.`,
              {
                autoClose: 8000,
                closeOnClick: false,
                pauseOnHover: true,
              }
            );
            console.error("Upload errors:", errors);
          } else {
            toast.success(
              `Successfully uploaded ${actualSuccessfulCount} invoices as drafts!`
            );
          }
        } else {
          // Handle streaming upload failure - check if it's a validation error
          if (result && result.error && result.error.response && result.error.response.status === 400) {
            const errorData = result.error.response.data;
            console.log("Streaming upload failed with validation errors:", errorData);
            
            // Process errors from the new fail-all validation structure
            const errors = errorData.data?.errors || [];
            
            // Group errors by invoice row to avoid counting duplicates
            const errorsByInvoice = {};
            errors.forEach(error => {
              const row = error.row || 1;
              if (!errorsByInvoice[row]) {
                errorsByInvoice[row] = [];
              }
              errorsByInvoice[row].push(error);
            });
            
            const uniqueFailedInvoices = Object.keys(errorsByInvoice).length;
            const summary = errorData.data?.summary || { 
              successful: 0, 
              failed: uniqueFailedInvoices, 
              total: uniqueFailedInvoices 
            };
            
            // Create detailed results for display - group errors by invoice
            const detailedResults = {
              summary,
              errors,
              performance: null,
              successfulInvoices: [],
              failedInvoices: Object.entries(errorsByInvoice).map(([row, invoiceErrors]) => ({
                row: parseInt(row),
                invoiceNumber: `Invoice ${row}`,
                buyerName: 'N/A',
                error: invoiceErrors.map(e => e.error).join('; '), // Combine multiple errors for same invoice
                status: 'failed',
                allErrors: invoiceErrors // Store all errors for detailed display
              })),
            };
            
            setUploadResults(detailedResults);
            setShowResults(true);
            
            // Show detailed error message with specific error types
            if (errors.length > 0) {
              const buyerErrors = errors.filter(e => e.error.includes('Buyer with NTN')).length;
              const productErrors = errors.filter(e => e.error.includes('Product')).length;
              const otherErrors = errors.length - buyerErrors - productErrors;
              
              let errorMessage = `Validation failed. ${uniqueFailedInvoices} invoice(s) have errors. No invoices will be created.`;
              if (buyerErrors > 0) errorMessage += ` (${buyerErrors} buyer validation errors)`;
              if (productErrors > 0) errorMessage += ` (${productErrors} product validation errors)`;
              if (otherErrors > 0) errorMessage += ` (${otherErrors} other errors)`;
              
              toast.error(errorMessage, { autoClose: 10000 });
            } else {
              toast.error(`Upload failed: ${errorData.message || 'Unknown error'}`);
            }
          } else {
            throw new Error("Streaming upload failed");
          }
        }
      } else {
        // Use regular upload for small files
        try {
          const result = await onUpload(invoicesToUpload);

          // Check if there were any errors in the upload
          if (
            result &&
            result.data &&
            result.data.data &&
            result.data.data.summary
          ) {
            const { summary, errors, performance } = result.data.data;

          // Store detailed results for display
          const detailedResults = {
            summary,
            errors: errors || [],
            performance,
            successfulInvoices: [],
            failedInvoices: [],
          };

          // Process successful invoices - only show actually successful ones
          if (summary.successful > 0) {
            // Create a map of successful invoice indices
            const successfulIndices = new Set();
            const errorRows = new Set(errors.map(error => error.row));
            
            // Only include invoices that don't have errors
            invoicesToUpload.forEach((invoice, index) => {
              if (!errorRows.has(index + 1)) {
                successfulIndices.add(index);
              }
            });
            
            detailedResults.successfulInvoices = Array.from(successfulIndices).map((index) => {
              const invoice = invoicesToUpload[index];
              return {
                row: index + 1,
                invoiceNumber: invoice.internalInvoiceNo || `Invoice ${index + 1}`,
                buyerName: invoice.buyerBusinessName || '',
                totalAmount: invoice.item_totalValues || invoice.totalValues || invoice.totalAmount || 0,
                status: 'success'
              };
            });
          }

          // Process failed invoices with detailed error information
          if (errors && errors.length > 0) {
            console.log("🔍 Regular upload - Processing errors:", errors);
            detailedResults.failedInvoices = errors.map((error, index) => {
              // Find the actual invoice data from the original upload
              const originalInvoice = invoicesToUpload.find((inv, idx) => idx + 1 === error.row) || 
                                     invoicesToUpload[error.row - 1] || 
                                     invoicesToUpload[index];
              
              const failedInvoice = {
                row: error.row || index + 1,
                invoiceNumber: originalInvoice?.internalInvoiceNo || `Invoice ${error.row || index + 1}`,
                buyerName: originalInvoice?.buyerBusinessName || '',
                error: error.error || error.errors?.join(', ') || 'Unknown error',
                status: 'failed'
              };
              
              console.log("🔍 Regular upload - Created failed invoice:", failedInvoice);
              return failedInvoice;
            });
            console.log("🔍 Regular upload - Final failedInvoices array:", detailedResults.failedInvoices);
          }

          setUploadResults(detailedResults);
          setShowResults(true);
          console.log("Upload results set:", detailedResults);

          // Check if there are any errors (including product validation errors)
          const hasErrors = errors && errors.length > 0;
          const actualSuccessfulCount = detailedResults.successfulInvoices.length;
          const actualFailedCount = detailedResults.failedInvoices.length;
          
          if (hasErrors) {
            toast.warning(
              `Upload completed with issues: ${actualSuccessfulCount} invoices added successfully, ${actualFailedCount} invoices failed due to validation errors.`,
              {
                autoClose: 8000,
                closeOnClick: false,
                pauseOnHover: true,
              }
            );
            console.error("Upload errors:", errors);
          } else {
            toast.success(
              `Successfully uploaded ${actualSuccessfulCount} invoices as drafts!`
            );
          }
        } else {
            // Fallback for when detailed results are not available
            const fallbackResults = {
              summary: { successful: invoicesToUpload.length, failed: 0 },
              errors: [],
              performance: null,
              successfulInvoices: invoicesToUpload.map((invoice, index) => ({
                row: index + 1,
                invoiceNumber: invoice.internalInvoiceNo || `Invoice ${index + 1}`,
                buyerName: invoice.buyerBusinessName || '',
                totalAmount: invoice.item_totalValues || invoice.totalValues || invoice.totalAmount || 0,
                status: 'success'
              })),
              failedInvoices: [],
            };
            setUploadResults(fallbackResults);
            setShowResults(true);
            console.log("Fallback upload results set:", fallbackResults);
            toast.success(
              `Successfully uploaded ${invoicesToUpload.length} invoices as drafts`
            );
          }
        } catch (uploadError) {
          // Handle 400 response with detailed errors (like validation failures)
          if (uploadError.response && uploadError.response.status === 400) {
            const errorData = uploadError.response.data;
            console.log("Upload failed with detailed errors:", errorData);
            
            // Process errors from the new fail-all validation structure
            const errors = errorData.data?.errors || [];
            
            // Group errors by invoice row to avoid counting duplicates
            const errorsByInvoice = {};
            errors.forEach(error => {
              const row = error.row || 1;
              if (!errorsByInvoice[row]) {
                errorsByInvoice[row] = [];
              }
              errorsByInvoice[row].push(error);
            });
            
            const uniqueFailedInvoices = Object.keys(errorsByInvoice).length;
            const summary = errorData.data?.summary || { 
              successful: 0, 
              failed: uniqueFailedInvoices, 
              total: uniqueFailedInvoices 
            };
            
            // Create detailed results for display - group errors by invoice
            const detailedResults = {
              summary,
              errors,
              performance: null,
              successfulInvoices: [],
              failedInvoices: Object.entries(errorsByInvoice).map(([row, invoiceErrors]) => ({
                row: parseInt(row),
                invoiceNumber: `Invoice ${row}`,
                buyerName: 'N/A',
                error: invoiceErrors.map(e => e.error).join('; '), // Combine multiple errors for same invoice
                status: 'failed',
                allErrors: invoiceErrors // Store all errors for detailed display
              })),
            };
            
            setUploadResults(detailedResults);
            setShowResults(true);
            
            // Show detailed error message with specific error types
            if (errors.length > 0) {
              const buyerErrors = errors.filter(e => e.error.includes('Buyer with NTN')).length;
              const productErrors = errors.filter(e => e.error.includes('Product')).length;
              const otherErrors = errors.length - buyerErrors - productErrors;
              
              let errorMessage = `Validation failed. ${uniqueFailedInvoices} invoice(s) have errors. No invoices will be created.`;
              if (buyerErrors > 0) errorMessage += ` (${buyerErrors} buyer validation errors)`;
              if (productErrors > 0) errorMessage += ` (${productErrors} product validation errors)`;
              if (otherErrors > 0) errorMessage += ` (${otherErrors} other errors)`;
              
              toast.error(errorMessage, { autoClose: 10000 });
            } else {
              toast.error(`Upload failed: ${errorData.message || 'Unknown error'}`);
            }
          } else {
            // Handle other errors
            console.error("Upload error:", uploadError);
            toast.error("Error uploading invoices. Please try again.");
          }
        }
      }

      // Don't close immediately if there are failed invoices to show
      console.log("Checking modal closing logic...");
      console.log("uploadResults:", uploadResults);
      console.log("uploadResults.summary:", uploadResults?.summary);
      console.log("uploadResults.summary.failed:", uploadResults?.summary?.failed);
      
      // Don't close the modal automatically - let the user decide when to close
      console.log("Upload completed - keeping modal open to show results");
      console.log("Final uploadResults:", uploadResults);
      console.log("Final showResults:", showResults);

    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading invoices. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (forceClose = false) => {
    // Only clear results if we're force closing or if there are no results to show
    if (forceClose || !uploadResults || !showResults) {
      setFile(null);
      setPreviewData([]);
      setErrors([]);
      setShowPreview(false);
      setExistingInvoices([]);
      setNewInvoices([]);
      setUploadResults(null);
      setShowResults(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    } else {
      console.log("Preventing modal close - results are being displayed");
    }
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
    <Dialog 
      open={isOpen} 
      onClose={(event, reason) => {
        console.log("Dialog onClose called with reason:", reason);
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          // Don't close if there are results to show
          if (uploadResults && showResults) {
            console.log("Preventing dialog close - results are being displayed");
            return;
          }
        }
        handleClose();
      }} 
      maxWidth="md" 
      fullWidth
    >
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
            automatically by the system.
            <br />
            <br />
            <strong>Seller Details:</strong> All seller information (NTN/CNIC,
            Business Name, Province, Address) will be automatically populated
            from the selected company:{" "}
            <strong>
              {selectedTenant?.sellerBusinessName || "No company selected"}
            </strong>
            <br />
            <br />
            <strong>Buyer Details:</strong> Fill buyer NTN/CNIC in the sheet. 
            All buyers must exist in the system before uploading invoices.
            <br />
            <br />
            <strong>Product Validation:</strong> All products must exist in the system. 
            Products with names that don't match existing products will cause upload errors.
            <br />
            <br />
            <strong>New Feature:</strong> Rows with the same{" "}
            <code>internalInvoiceNo</code> will be automatically combined into
            single invoices with multiple line items.
          </Typography>

          {/* Tenant Selection Warning */}
          {!selectedTenant && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Please select a comapny before uploading invoices. Seller details
              will be populated from the selected company.
            </Alert>
          )}

          {/* Download Template Button - Download from API */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              onClick={async () => {
                try {
                  setDownloadingTemplate(true);
                  
                  if (!selectedTenant) {
                    toast.error("Please select a company before downloading the template");
                    return;
                  }
                  
                  // Download template from API endpoint
                  const response = await api.get(
                    `/tenant/${selectedTenant.tenant_id}/invoices/template.xlsx`,
                    {
                      responseType: 'blob',
                      headers: {
                        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      }
                    }
                  );
                  
                  // Create blob and download
                  const blob = new Blob([response.data], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  });
                  
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "invoice_template.xlsx";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                  
                  toast.success("Excel template downloaded successfully!");
                } catch (error) {
                  console.error("Error downloading template:", error);
                  toast.error("Could not download Excel template. Please try again.");
                } finally {
                  setDownloadingTemplate(false);
                }
              }}
              size="small"
              disabled={downloadingTemplate || !selectedTenant}
              startIcon={downloadingTemplate ? <CircularProgress size={16} /> : <Download />}
            >
              {downloadingTemplate ? "Downloading..." : "Download Excel Template"}
            </Button>
          </Box>

          {/* File Processing Progress */}
          {isProcessing && (
            <Box sx={{ mb: 2 }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {progressMessage}
                </Typography>
                <Button
                  size="small"
                  startIcon={<Cancel />}
                  onClick={cancelProcessing}
                  color="error"
                >
                  Cancel
                </Button>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                {Math.round(progress)}% complete
              </Typography>
            </Box>
          )}

          {/* Processing Error */}
          {processingError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {processingError}
            </Alert>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <Box sx={{ mb: 2 }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {uploadProgress.message}
                </Typography>
                <Button
                  size="small"
                  startIcon={<Cancel />}
                  onClick={cancelUpload}
                  color="error"
                >
                  Cancel Upload
                </Button>
              </Box>
              <LinearProgress
                variant="determinate"
                value={uploadProgress.percentage}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Box display="flex" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {uploadProgress.completedInvoices} /{" "}
                  {uploadProgress.totalInvoices} invoices
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Chunk {uploadProgress.currentChunk} /{" "}
                  {uploadProgress.totalChunks}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(uploadProgress.percentage)}% complete
                </Typography>
              </Box>
            </Box>
          )}

          {/* Upload Error */}
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Upload failed: {uploadError.message}
            </Alert>
          )}

          {/* File Upload Area */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: "center",
              border: "2px dashed #ccc",
              backgroundColor: "#fafafa",
              cursor: isProcessing ? "not-allowed" : "pointer",
              opacity: isProcessing ? 0.6 : 1,
              "&:hover": {
                borderColor: isProcessing ? "#ccc" : "primary.main",
                backgroundColor: isProcessing ? "#fafafa" : "#f5f5f5",
              },
            }}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDrop={!isProcessing ? handleDrop : undefined}
            onDragOver={!isProcessing ? handleDragOver : undefined}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              disabled={isProcessing}
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

        {/* Grouping Preview - Show how rows will be grouped */}
        {/* {file && previewData.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: "info.light", borderRadius: 1 }}>
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ color: "info.dark" }}
            >
              📋 Row Grouping Preview (by Company Invoice Ref No)
            </Typography>
            {(() => {
              const groupedPreview = new Map();
              previewData.forEach((row, index) => {
                const companyInvoiceRefNo =
                  row.companyInvoiceRefNo?.trim() || `row_${index + 1}`;
                if (!groupedPreview.has(companyInvoiceRefNo)) {
                  groupedPreview.set(companyInvoiceRefNo, []);
                }
                groupedPreview.get(companyInvoiceRefNo).push(index + 1);
              });

              return (
                <Box sx={{ mt: 1 }}>
                  {Array.from(groupedPreview.entries()).map(
                    ([companyInvoiceRefNo, rows], idx) => (
                      <Box
                        key={idx}
                        sx={{
                          mb: 1,
                          p: 1,
                          bgcolor: "white",
                          borderRadius: 0.5,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                          Invoice {idx + 1}:{" "}
                          {companyInvoiceRefNo === `row_${rows[0]}`
                            ? "No Company Invoice Ref No"
                            : companyInvoiceRefNo}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Rows: {rows.join(", ")} ({rows.length} item
                          {rows.length > 1 ? "s" : ""})
                        </Typography>
                      </Box>
                    )
                  )}
                </Box>
              );
            })()}
          </Box>
        )} */}

        {/* Buyer selection removed */}

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

        {/* Buyer Validation Info Alert */}
        {file && previewData.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              👥 Buyer Validation Required
            </Typography>
            <Typography variant="body2">
              All buyers in your CSV must exist in the system. Buyers with NTN/CNIC that don't match 
              existing buyers will cause upload errors. Please ensure all buyer NTN/CNIC in your CSV 
              exactly match the buyers in the system.
            </Typography>
          </Alert>
        )}

        {/* Product Validation Info Alert */}
        {file && previewData.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              📋 Product Validation Required
            </Typography>
            <Typography variant="body2">
              All products in your CSV must exist in the system. Products with names that don't match 
              existing products will cause upload errors. Please ensure all product names in your CSV 
              exactly match the product names in the system.
            </Typography>
          </Alert>
        )}

        {/* Upload Errors Display */}
        {errors && errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ❌ Upload Errors
            </Typography>
            {errors.slice(0, 3).map((error, index) => {
              const isBuyerError = error.error.includes('Buyer with NTN');
              const isProductError = error.error.includes('Product');
              return (
                <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace' }}>
                  Row {error.row}: {isBuyerError ? '👥 ' : isProductError ? '📋 ' : ''}{error.error}
                </Typography>
              );
            })}
            {errors.length > 3 && (
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                ... and {errors.length - 3} more errors
              </Typography>
            )}
          </Alert>
        )}

        {/* Preview Section - Commented Out */}
        {/*
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
                    {previewData
                      .slice(0, 10)
                      .map((row, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            backgroundColor: "#f0f8ff",
                            "&:hover": {
                              backgroundColor: "#e6f3ff",
                            },
                          }}
                        >
                          <TableCell>
                            <Chip
                              label={`Row ${index + 1}`}
                              size="small"
                              color="primary"
                              icon={<Info />}
                            />
                          </TableCell>
                          <TableCell>
                            {row.invoiceType || "-"}
                          </TableCell>
                          <TableCell>
                            {row.invoiceDate || "-"}
                          </TableCell>
                          <TableCell>
                            {row.invoiceRefNo || "-"}
                          </TableCell>
                          <TableCell>
                            {row.companyInvoiceRefNo || "-"}
                          </TableCell>
                          <TableCell>
                            {row.buyerNTNCNIC || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_productName || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_hsCode || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_rate || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_quantity || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_unitPrice || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_totalValues || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_valueSalesExcludingST || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_salesTaxApplicable || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_salesTaxWithheldAtSource || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_extraTax || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_furtherTax || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_sroScheduleNo || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_fedPayable || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_discount || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_saleType || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_sroItemSerialNo || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    {previewData.length > 10 && (
                      <TableRow>
                        <TableCell
                          colSpan={expectedColumns.length + 1}
                          align="center"
                          sx={{ fontStyle: "italic", color: "text.secondary" }}
                        >
                          Showing first 10 rows of{" "}
                          {previewData.length} total rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
        */}

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
                    {(() => {
                      // Count unique invoices after grouping by companyInvoiceRefNo
                      const uniqueInvoices = new Set();
                      previewData.forEach((row) => {
                        const companyInvoiceRefNo =
                          row.companyInvoiceRefNo?.trim() ||
                          `row_${row._row || "unknown"}`;
                        uniqueInvoices.add(companyInvoiceRefNo);
                      });
                      return `${uniqueInvoices.size} invoices (${previewData.length} total rows) ready to upload as drafts`;
                    })()}
                  </Typography>
                </Box>
                {/* Buyer summary removed */}
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

        {/* Upload Results Section */}
        
        
        {uploadResults && showResults && (
          <Box sx={{ mt: 3 }}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">
                Upload Results
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowResults(!showResults)}
                  startIcon={showResults ? <Visibility /> : <Visibility />}
                  sx={{ mr: 1 }}
                >
                  {showResults ? "Hide Results" : "Show Results"}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleClose(true)}
                  startIcon={<Close />}
                >
                  Close Modal
                </Button>
              </Box>
            </Box>

            {showResults && (
              <Box>
                {/* Summary Cards */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <Paper sx={{ 
                    p: 3, 
                    minWidth: 150, 
                    textAlign: 'center', 
                    bgcolor: 'success.main', 
                    color: 'white',
                    borderRadius: 2,
                    boxShadow: 2
                  }}>
                    <Typography variant="h3" color="inherit" sx={{ fontWeight: 'bold' }}>
                      {uploadResults.successfulInvoices.length}
                    </Typography>
                    <Typography variant="h6" color="inherit" sx={{ mt: 1 }}>
                      Invoices Created
                    </Typography>
                  </Paper>
                  {uploadResults.failedInvoices && uploadResults.failedInvoices.length > 0 && (
                    <Paper sx={{ 
                      p: 3, 
                      minWidth: 150, 
                      textAlign: 'center', 
                      bgcolor: 'error.main', 
                      color: 'white',
                      borderRadius: 2,
                      boxShadow: 2
                    }}>
                      <Typography variant="h3" color="inherit" sx={{ fontWeight: 'bold' }}>
                        {uploadResults.failedInvoices.length}
                      </Typography>
                      <Typography variant="h6" color="inherit" sx={{ mt: 1 }}>
                        Failed Invoices
                      </Typography>
                    </Paper>
                  )}
                </Box>


                {/* Detailed Results Table */}
                <TableContainer component={Paper} sx={{ maxHeight: 400, borderRadius: 2, boxShadow: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Row</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice Number</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', bgcolor: 'black' }}>Error Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Successful Invoices */}
                      {uploadResults.successfulInvoices.map((invoice, index) => (
                        <TableRow 
                          key={`success-${index}`} 
                          sx={{ 
                            bgcolor: 'success.light',
                            '&:hover': { bgcolor: 'success.main', color: 'white' },
                            borderLeft: '4px solid #4caf50'
                          }}
                        >
                        <TableCell sx={{ fontWeight: 'bold' }}>{invoice.row}</TableCell>
                        <TableCell sx={{ fontWeight: 'medium' }}>{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <Chip
                            icon={<CheckCircle />}
                            label="Success"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>
                        <TableCell sx={{ bgcolor: 'black' }}>
                          <Typography variant="body2" color="white" sx={{ fontStyle: 'italic' }}>
                            ✓ Uploaded successfully
                          </Typography>
                        </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Failed Invoices */}
                      {uploadResults.failedInvoices.map((invoice, index) => (
                        <TableRow 
                          key={`failed-${index}`} 
                          sx={{ 
                            bgcolor: 'error.light',
                            '&:hover': { bgcolor: 'error.main', color: 'white' },
                            borderLeft: '4px solid #f44336'
                          }}
                        >
                          <TableCell sx={{ fontWeight: 'bold' }}>{invoice.row}</TableCell>
                          <TableCell sx={{ fontWeight: 'medium' }}>{invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            <Chip
                              icon={<ErrorIcon />}
                              label="Failed"
                              color="error"
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell sx={{ bgcolor: 'black' }}>
                            <Box>
                              {invoice.allErrors && invoice.allErrors.length > 1 ? (
                                // Show multiple errors for the same invoice
                                invoice.allErrors.map((error, errorIndex) => {
                                  const isBuyerError = error.error.includes('Buyer with NTN');
                                  const isProductError = error.error.includes('Product');
                                  const errorType = isBuyerError ? '👥 Buyer' : isProductError ? '📋 Product' : '❓ Other';
                                  
                                  return (
                                    <Typography 
                                      key={errorIndex} 
                                      variant="body2" 
                                      color="white" 
                                      sx={{ 
                                        fontWeight: 'medium',
                                        mb: errorIndex < invoice.allErrors.length - 1 ? 1 : 0,
                                        display: 'block'
                                      }}
                                    >
                                      {errorType}: {error.error}
                                    </Typography>
                                  );
                                })
                              ) : (
                                // Show single error
                                <Typography variant="body2" color="white" sx={{ fontWeight: 'medium' }}>
                                  {invoice.error}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
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
        {uploadResults && (
          <Button 
            onClick={() => {
              setUploadResults(null);
              setShowResults(false);
            }} 
            disabled={uploading}
            variant="outlined"
          >
            Clear Results
          </Button>
        )}
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={
            !file || 
            previewData.length === 0 || 
            uploading || 
            checkingExisting
          }
          startIcon={
            uploading ? <CircularProgress size={20} /> : <FileUpload />
          }
        >
          {uploading
            ? "Uploading..."
            : uploadResults && uploadResults.summary && uploadResults.summary.successful > 0
            ? `Upload Again (${(() => {
                const uniqueInvoices = new Set();
                previewData.forEach((row) => {
                  const companyInvoiceRefNo =
                    row.companyInvoiceRefNo?.trim() ||
                    `row_${row._row || "unknown"}`;
                  uniqueInvoices.add(companyInvoiceRefNo);
                });
                return uniqueInvoices.size;
              })()} Invoices)`
            : (() => {
                // Count unique invoices after grouping by companyInvoiceRefNo
                const uniqueInvoices = new Set();
                previewData.forEach((row) => {
                  const companyInvoiceRefNo =
                    row.companyInvoiceRefNo?.trim() ||
                    `row_${row._row || "unknown"}`;
                  uniqueInvoices.add(companyInvoiceRefNo);
                });
                return `Upload ${uniqueInvoices.size} Invoices as Drafts`;
              })()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceUploader;
