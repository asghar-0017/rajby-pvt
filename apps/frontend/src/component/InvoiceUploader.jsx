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

  const fileInputRef = useRef(null);

  // Expected columns for invoice data (including buyer details)
  const expectedColumns = [
    "invoiceType",
    "invoiceDate",
    "invoiceRefNo",
    "companyInvoiceRefNo",
    "internalInvoiceNo",
    // Buyer details
    "buyerNTNCNIC",
    "buyerBusinessName",
    "buyerProvince",
    "buyerAddress",
    "buyerRegistrationType",
    // Transaction and item details
    "transctypeId",
    "item_hsCode",
    "item_productDescription",
    "item_productName",
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

              // Debug: Log raw parsed data for first few rows
              if (i <= 3) {
                console.log(`🔍 Raw Excel Row ${i}:`, {
                  headers: headers,
                  rawRow: row,
                  parsedRowData: rowData,
                  internalInvoiceNo: rowData.internalInvoiceNo,
                  hasInternalInvoiceNo: !!rowData.internalInvoiceNo,
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
          "https://signs-now.inplsoftwares.online/api/buyer-check",
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

  // NEW: Function to automatically create missing products from invoice data
  const createMissingProducts = async (invoicesData) => {
    try {
      // Extract all unique products from invoice items
      const allProducts = new Set();
      const productDetails = new Map(); // Store product details for creation

      invoicesData.forEach((invoice) => {
        if (invoice.items && Array.isArray(invoice.items)) {
          invoice.items.forEach((item) => {
            // Create a unique key for each product
            const productKey = `${item.item_productName || item.item_name || item.name || ""}-${item.item_hsCode || item.hsCode || ""}`;

            if (productKey && productKey !== "-") {
              allProducts.add(productKey);

              // Store product details for creation
              if (!productDetails.has(productKey)) {
                productDetails.set(productKey, {
                  name:
                    item.item_productName || item.item_name || item.name || "",
                  hsCode: item.item_hsCode || item.hsCode || "",
                  description:
                    item.item_productDescription || item.description || "",
                  uom: item.item_uoM || item.billOfLadingUoM || item.uom || "",
                  // Add other product fields as needed
                });
              }
            }
          });
        }
      });

      if (allProducts.size === 0) {
        console.log("No products found in invoice data");
        return;
      }

      console.log(`Found ${allProducts.size} unique products in invoice data`);

      // Get existing products to check which ones need to be created
      const existingProductsResponse = await api.get(
        `/tenant/${selectedTenant.tenant_id}/products`
      );

      if (!existingProductsResponse.data.success) {
        console.error("Failed to fetch existing products");
        return;
      }

      const existingProducts = existingProductsResponse.data.data || [];
      const existingProductKeys = new Set();

      existingProducts.forEach((product) => {
        const key = `${product.name}-${product.hsCode}`;
        existingProductKeys.add(key);
      });

      // Find products that don't exist
      const missingProducts = [];
      productDetails.forEach((details, key) => {
        if (!existingProductKeys.has(key) && details.name && details.hsCode) {
          missingProducts.push(details);
        }
      });

      if (missingProducts.length === 0) {
        console.log("All products already exist in the system");
        return;
      }

      console.log(
        `Found ${missingProducts.length} missing products to create:`,
        missingProducts
      );

      // Create missing products
      const createdProducts = [];
      const failedProducts = [];

      for (const product of missingProducts) {
        try {
          const productData = {
            name: product.name,
            hsCode: product.hsCode,
            description: product.description || product.name,
            uom: product.uom || "PCS", // Default UOM if not specified
            // Add other required fields with defaults
            category: "Auto-Created",
            isActive: true,
            // You can add more fields as needed
          };

          const createResponse = await api.post(
            `/tenant/${selectedTenant.tenant_id}/products`,
            productData
          );

          if (createResponse.data.success) {
            createdProducts.push(product.name);
            console.log(`Successfully created product: ${product.name}`);
          } else {
            failedProducts.push(product.name);
            console.error(
              `Failed to create product ${product.name}:`,
              createResponse.data.message
            );
          }
        } catch (error) {
          failedProducts.push(product.name);
          console.error(`Error creating product ${product.name}:`, error);
        }
      }

      // Show results
      if (createdProducts.length > 0) {
        toast.success(
          `Successfully created ${createdProducts.length} new products: ${createdProducts.slice(0, 3).join(", ")}${createdProducts.length > 3 ? "..." : ""}`,
          { autoClose: 5000 }
        );
        console.log(
          `Created ${createdProducts.length} products:`,
          createdProducts
        );
      }

      if (failedProducts.length > 0) {
        toast.warning(
          `Failed to create ${failedProducts.length} products: ${failedProducts.slice(0, 3).join(", ")}${failedProducts.length > 3 ? "..." : ""}`,
          { autoClose: 5000 }
        );
        console.log(
          `Failed to create ${failedProducts.length} products:`,
          failedProducts
        );
      }
    } catch (error) {
      console.error("Error in createMissingProducts:", error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!file || previewData.length === 0) {
      toast.error("Please select a valid file with invoice data to upload");
      return;
    }

    setUploading(true);
    try {
      // Group rows by internalInvoiceNo to combine multiple items into single invoices
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
        if (cleanedItem.item_productDescription) {
          cleanedItem.productDescription = cleanedItem.item_productDescription;
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
          cleanedItem.salesTaxApplicable = cleanedItem.item_salesTaxApplicable;
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

        // Get the internalInvoiceNo for grouping
        const internalInvoiceNo =
          cleanedItem.internalInvoiceNo?.trim() || `row_${index + 1}`;

        // Add row number for tracking
        cleanedItem._row = index + 1;

        if (groupedInvoices.has(internalInvoiceNo)) {
          // Add item to existing invoice group
          const existingInvoice = groupedInvoices.get(internalInvoiceNo);

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
          if (
            existingInvoice.buyerBusinessName !== cleanedItem.buyerBusinessName
          ) {
            consistencyErrors.push(
              `Buyer Business Name mismatch: ${existingInvoice.buyerBusinessName} vs ${cleanedItem.buyerBusinessName}`
            );
          }
          if (existingInvoice.buyerProvince !== cleanedItem.buyerProvince) {
            consistencyErrors.push(
              `Buyer Province mismatch: ${existingInvoice.buyerProvince} vs ${cleanedItem.buyerProvince}`
            );
          }
          if (existingInvoice.buyerAddress !== cleanedItem.buyerAddress) {
            consistencyErrors.push(
              `Buyer Address mismatch: ${existingInvoice.buyerAddress} vs ${cleanedItem.buyerAddress}`
            );
          }
          if (
            existingInvoice.buyerRegistrationType !==
            cleanedItem.buyerRegistrationType
          ) {
            consistencyErrors.push(
              `Buyer Registration Type mismatch: ${existingInvoice.buyerRegistrationType} vs ${cleanedItem.buyerRegistrationType}`
            );
          }

          if (consistencyErrors.length > 0) {
            groupingErrors.push({
              row: index + 1,
              internalInvoiceNo: internalInvoiceNo,
              errors: consistencyErrors,
              message: `Row ${index + 1} has different invoice-level data than other rows with internalInvoiceNo: ${internalInvoiceNo}`,
            });
          }

          existingInvoice.items.push(cleanedItem);
        } else {
          // Create new invoice group
          groupedInvoices.set(internalInvoiceNo, {
            invoiceType: cleanedItem.invoiceType,
            invoiceDate: cleanedItem.invoiceDate,
            invoiceRefNo: cleanedItem.invoiceRefNo,
            companyInvoiceRefNo: cleanedItem.companyInvoiceRefNo,
            internalInvoiceNo: internalInvoiceNo,
            // Seller details from selected tenant
            sellerNTNCNIC: selectedTenant?.sellerNTNCNIC || "",
            sellerFullNTN: selectedTenant?.sellerFullNTN || "",
            sellerBusinessName: selectedTenant?.sellerBusinessName || "",
            sellerProvince: selectedTenant?.sellerProvince || "",
            sellerAddress: selectedTenant?.sellerAddress || "",
            // Buyer details
            buyerNTNCNIC: cleanedItem.buyerNTNCNIC,
            buyerBusinessName: cleanedItem.buyerBusinessName,
            buyerProvince: cleanedItem.buyerProvince,
            buyerAddress: cleanedItem.buyerAddress,
            buyerRegistrationType: cleanedItem.buyerRegistrationType,
            items: [cleanedItem],
            _row: index + 1, // Track the first row for this invoice
          });
        }
      });

      // Check for grouping errors
      if (groupingErrors.length > 0) {
        console.error("Grouping validation errors:", groupingErrors);
        toast.error(
          `Found ${groupingErrors.length} grouping validation errors. Rows with the same internalInvoiceNo must have consistent invoice-level data. Check console for details.`
        );
        setUploading(false);
        return;
      }

      // Ensure all invoice groups have seller details from selected tenant
      const invoicesToUpload = Array.from(groupedInvoices.values()).map(
        (invoice) => ({
          ...invoice,
          sellerNTNCNIC: selectedTenant?.sellerNTNCNIC || "",
          sellerFullNTN: selectedTenant?.sellerFullNTN || "",
          sellerBusinessName: selectedTenant?.sellerBusinessName || "",
          sellerProvince: selectedTenant?.sellerProvince || "",
          sellerAddress: selectedTenant?.sellerAddress || "",
        })
      );

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
        sampleInternalInvoiceNo: invoicesToUpload[0]?.internalInvoiceNo,
        hasInternalInvoiceNo: !!invoicesToUpload[0]?.internalInvoiceNo,
        groupingSummary: invoicesToUpload.map((inv) => ({
          internalInvoiceNo: inv.internalInvoiceNo,
          itemCount: inv.items.length,
          rows: inv.items.map((item) => item._row),
        })),
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

          // Show error details in a toast instead of alert
          toast.warning(
            `Upload completed with issues: ${summary.successful} invoices added successfully, ${summary.failed} invoices failed. Check console for error details.`,
            {
              autoClose: 8000,
              closeOnClick: false,
              pauseOnHover: true,
            }
          );
          console.error("Upload errors:", errors);
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

      // NEW: Automatically create products that don't exist
      try {
        await createMissingProducts(invoicesToUpload);
      } catch (productError) {
        console.error("Error creating missing products:", productError);
        // Don't fail the upload if product creation fails
        toast.warning(
          "Invoices uploaded successfully, but some products could not be created automatically."
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
            <strong>Buyer Details:</strong> Fill buyer details in the sheet
            (NTN/CNIC, Business Name, Province, Address, Registration Type).
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

          {/* Download Template Button - Downloads from public folder */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => {
                try {
                  // Create a link to the existing template file in public folder
                  const link = document.createElement("a");
                  link.href = "/invoiceTemplate/invoice_template.xlsx";
                  link.download = "invoice_template.xlsx";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success("Excel template downloaded successfully!");
                } catch (error) {
                  console.error("Error downloading template:", error);
                  toast.error(
                    "Could not download Excel template. Please try again."
                  );
                }
              }}
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

        {/* Grouping Preview - Show how rows will be grouped */}
        {/* {file && previewData.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: "info.light", borderRadius: 1 }}>
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ color: "info.dark" }}
            >
              📋 Row Grouping Preview (by internalInvoiceNo)
            </Typography>
            {(() => {
              const groupedPreview = new Map();
              previewData.forEach((row, index) => {
                const internalInvoiceNo =
                  row.internalInvoiceNo?.trim() || `row_${index + 1}`;
                if (!groupedPreview.has(internalInvoiceNo)) {
                  groupedPreview.set(internalInvoiceNo, []);
                }
                groupedPreview.get(internalInvoiceNo).push(index + 1);
              });

              return (
                <Box sx={{ mt: 1 }}>
                  {Array.from(groupedPreview.entries()).map(
                    ([internalInvoiceNo, rows], idx) => (
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
                          {internalInvoiceNo === `row_${rows[0]}`
                            ? "No internalInvoiceNo"
                            : internalInvoiceNo}
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
                            {row.buyerBusinessName || "-"}
                          </TableCell>
                          <TableCell>
                            {row.buyerProvince || "-"}
                          </TableCell>
                          <TableCell>
                            {row.buyerAddress || "-"}
                          </TableCell>
                          <TableCell>
                            {row.buyerRegistrationType || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_productName || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_hsCode || "-"}
                          </TableCell>
                          <TableCell>
                            {row.item_productDescription || "-"}
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
                      // Count unique invoices after grouping
                      const uniqueInvoices = new Set();
                      previewData.forEach((row) => {
                        const internalInvoiceNo =
                          row.internalInvoiceNo?.trim() ||
                          `row_${row._row || "unknown"}`;
                        uniqueInvoices.add(internalInvoiceNo);
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
            : (() => {
                // Count unique invoices after grouping
                const uniqueInvoices = new Set();
                previewData.forEach((row) => {
                  const internalInvoiceNo =
                    row.internalInvoiceNo?.trim() ||
                    `row_${row._row || "unknown"}`;
                  uniqueInvoices.add(internalInvoiceNo);
                });
                return `Upload ${uniqueInvoices.size} Invoices as Drafts`;
              })()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceUploader;
