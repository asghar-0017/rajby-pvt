import fs from "fs";

import path from "path";

import QRCode from "qrcode";

import ejs from "ejs";

import puppeteer from "puppeteer";

import PerformanceOptimizationService from "../../service/PerformanceOptimizationService.js";
import DatabaseOptimizationService from "../../service/DatabaseOptimizationService.js";
import MemoryManagementService from "../../service/MemoryManagementService.js";

import numberToWords from "number-to-words";

import TenantDatabaseService from "../../service/TenantDatabaseService.js";

import Tenant from "../../model/mysql/Tenant.js";

import hsCodeCacheService from "../../service/HSCodeCacheService.js";

const { toWords } = numberToWords;

// Helper function to generate system invoice ID

const generateSystemInvoiceId = async (Invoice) => {
  try {
    // Get the highest existing system invoice ID for this tenant

    const lastInvoice = await Invoice.findOne({
      where: {
        system_invoice_id: {
          [Invoice.sequelize.Sequelize.Op.like]: "INV-%",
        },
      },

      order: [["system_invoice_id", "DESC"]],

      attributes: ["system_invoice_id"],
    });

    let nextNumber = 1;

    if (lastInvoice && lastInvoice.system_invoice_id) {
      // Extract the number from the last invoice ID (e.g., "INV-0005" -> 5)

      const match = lastInvoice.system_invoice_id.match(/INV-(\d+)/);

      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Format as INV-0001, INV-0002, etc.

    return `INV-${nextNumber.toString().padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating system invoice ID:", error);

    // Fallback to timestamp-based ID if there's an error

    return `INV-${Date.now().toString().slice(-4)}`;
  }
};

// Helper function to generate short 6-digit IDs for draft and saved invoices

const generateShortInvoiceId = async (Invoice, prefix) => {
  try {
    // Get the highest existing invoice ID with this prefix for this tenant

    const lastInvoice = await Invoice.findOne({
      where: {
        invoice_number: {
          [Invoice.sequelize.Sequelize.Op.like]: `${prefix}_%`,
        },
      },

      order: [["invoice_number", "DESC"]],

      attributes: ["invoice_number"],
    });

    let nextNumber = 1;

    if (lastInvoice && lastInvoice.invoice_number) {
      // Extract the number from the last invoice ID (e.g., "DRAFT_123456" -> 123456)

      const match = lastInvoice.invoice_number.match(
        new RegExp(`${prefix}_(\\d+)`)
      );

      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Format as DRAFT_000001, DRAFT_000002, etc. or SAVED_000001, SAVED_000002, etc.

    return `${prefix}_${nextNumber.toString().padStart(6, "0")}`;
  } catch (error) {
    console.error(`Error generating short ${prefix} invoice ID:`, error);

    // Fallback to random 6-digit number if there's an error

    const randomNum = Math.floor(Math.random() * 900000) + 100000; // 100000 to 999999

    return `${prefix}_${randomNum}`;
  }
};

export const createInvoice = async (req, res) => {
  try {
    const { Invoice, InvoiceItem, Buyer } = req.tenantModels;

    const {
      invoice_number,

      invoiceType,

      invoiceDate,

      sellerNTNCNIC,

      sellerFullNTN,

      sellerBusinessName,

      sellerProvince,

      sellerAddress,

      sellerCity,

      buyerNTNCNIC,

      buyerBusinessName,

      buyerProvince,

      buyerAddress,

      buyerRegistrationType,

      invoiceRefNo,

      companyInvoiceRefNo,

      internalInvoiceNo,

      transctypeId,

      items,

      status = "posted",

      fbr_invoice_number = null,
    } = req.body;

    // Debug: Log internal invoice number
    console.log("🔍 Backend Debug: Internal Invoice No:", {
      internalInvoiceNo: internalInvoiceNo,
      hasValue: !!internalInvoiceNo,
      trimmedValue: internalInvoiceNo?.trim(),
      reqBodyKeys: Object.keys(req.body),
    });

    // Use fbr_invoice_number as invoice_number if invoice_number is not provided

    const finalInvoiceNumber = invoice_number || fbr_invoice_number;

    // Debug: Log the received items data

    console.log("Received items data:", JSON.stringify(items, null, 2));

    // Enforce allowed statuses only

    const allowedStatuses = ["draft", "posted"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid status. Allowed: 'draft', or 'posted'",
      });
    }

    // Check if invoice number already exists (only if provided)

    let existingInvoice = null;

    if (finalInvoiceNumber) {
      existingInvoice = await Invoice.findOne({
        where: { invoice_number: finalInvoiceNumber },
      });
    }

    if (existingInvoice) {
      return res.status(409).json({
        success: false,

        message: "Invoice with this number already exists",
      });
    }

    // Auto-create/validate buyer before creating invoice
    try {
      if (buyerNTNCNIC && String(buyerNTNCNIC).trim()) {
        const existingBuyer = await Buyer.findOne({
          where: { buyerNTNCNIC: String(buyerNTNCNIC).trim() },
        });
        if (existingBuyer) {
          if (
            buyerBusinessName &&
            String(buyerBusinessName).trim() &&
            String(existingBuyer.buyerBusinessName || "")
              .trim()
              .toLowerCase() !== String(buyerBusinessName).trim().toLowerCase()
          ) {
            return res.status(409).json({
              success: false,
              message: "This Buyer already exists",
            });
          }
        } else {
          await Buyer.create({
            buyerNTNCNIC: String(buyerNTNCNIC).trim(),
            buyerBusinessName: buyerBusinessName || null,
            buyerProvince: buyerProvince || "",
            buyerAddress: buyerAddress || null,
            buyerRegistrationType: buyerRegistrationType || "Unregistered",
          });
        }
      }
    } catch (e) {
      console.error("Buyer check/create error:", e);
      return res.status(500).json({
        success: false,
        message: "Error validating/creating buyer",
        error: e.message,
      });
    }

    // Server-side FBR registration mismatch check
    try {
      if (
        buyerNTNCNIC &&
        String(buyerNTNCNIC).trim() &&
        buyerRegistrationType &&
        String(buyerRegistrationType).trim()
      ) {
        const selectedType = String(buyerRegistrationType).trim().toLowerCase();
        if (selectedType === "unregistered") {
          const axios = (await import("axios")).default;
          const upstream = await axios.post(
            "https://buyercheckapi.inplsoftwares.online/checkbuyer.php",
            {
              token: "89983e4a-c009-3f9b-bcd6-a605c3086709",
              registrationNo: String(buyerNTNCNIC).trim(),
            },
            { headers: { "Content-Type": "application/json" }, timeout: 10000 }
          );
          const data = upstream.data;
          let derived = "Unregistered";
          if (data && typeof data.REGISTRATION_TYPE === "string") {
            derived =
              data.REGISTRATION_TYPE.toLowerCase() === "registered"
                ? "Registered"
                : "Unregistered";
          } else {
            let isRegistered = false;
            if (typeof data === "boolean") {
              isRegistered = data === true;
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
          if (derived === "Registered") {
            return res.status(400).json({
              success: false,
              message:
                "Buyer Registration Type is not correct (FBR: Registered)",
            });
          }
        }
      }
    } catch (fbrErr) {
      console.error("FBR registration check failed:", fbrErr);
      // If the upstream fails, proceed rather than hard-blocking; comment next line to block on failure
      // return res.status(502).json({ success: false, message: "FBR registration check failed", error: fbrErr.message });
    }

    // Create invoice with transaction

    const result = await req.tenantDb.transaction(async (t) => {
      // Generate system invoice ID

      const systemInvoiceId = await generateSystemInvoiceId(Invoice);

      // Create invoice with posted status

      const invoice = await Invoice.create(
        {
          invoice_number: finalInvoiceNumber,

          system_invoice_id: systemInvoiceId,

          invoiceType,

          invoiceDate,

          sellerNTNCNIC,

          sellerFullNTN,

          sellerBusinessName,

          sellerProvince,

          sellerAddress,

          sellerCity,

          buyerNTNCNIC,

          buyerBusinessName,

          buyerProvince,

          buyerAddress,

          buyerRegistrationType,

          invoiceRefNo,

          companyInvoiceRefNo,

          internal_invoice_no: internalInvoiceNo,

          transctypeId,

          status: "posted", // Always set as posted when using createInvoice

          fbr_invoice_number,
        },

        { transaction: t }
      );

      // Create invoice items if provided

      if (items && Array.isArray(items) && items.length > 0) {
        const invoiceItems = items.map((item) => {
          // Debug: Log the incoming item data
          console.log("🔍 Backend Debug: Incoming item data:", {
            productName: item.productName,
            name: item.name,
            item_productName: item.item_productName,
            hsCode: item.hsCode,
          });

          // Helper function to convert empty strings to null

          const cleanValue = (value) => {
            if (
              value === "" ||
              value === "N/A" ||
              value === null ||
              value === undefined
            ) {
              return null;
            }

            return value;
          };

          // Helper function to convert numeric strings to numbers

          const cleanNumericValue = (value) => {
            const cleaned = cleanValue(value);

            if (cleaned === null) return null;

            const num = parseFloat(cleaned);

            return isNaN(num) ? null : num;
          };

          // Helper function to clean hsCode with length validation
          const cleanHsCode = (value) => {
            const cleaned = cleanValue(value);
            if (cleaned === null) return null;

            const stringValue = String(cleaned);

            // Extract HS code from description if it contains a dash separator
            // Format: "8432.1010 - NUCLEAR REACTOR, BOILERS, MACHINERY AN"
            let hsCode = stringValue;
            if (stringValue.includes(" - ")) {
              hsCode = stringValue.split(" - ")[0].trim();
            }

            // Truncate to 50 characters to match database field length
            return hsCode.substring(0, 50);
          };

          const mappedItem = {
            invoice_id: invoice.id,

            hsCode: cleanHsCode(item.hsCode),

            name: cleanValue(item.productName || item.name),

            productDescription: cleanValue(item.productDescription),

            rate: cleanValue(item.rate),

            uoM: cleanValue(item.uoM),

            quantity: cleanNumericValue(item.quantity),

            unitPrice: cleanNumericValue(item.unitPrice),

            totalValues: cleanNumericValue(item.totalValues),

            valueSalesExcludingST: cleanNumericValue(
              item.valueSalesExcludingST
            ),

            fixedNotifiedValueOrRetailPrice: cleanNumericValue(
              item.fixedNotifiedValueOrRetailPrice
            ),

            salesTaxApplicable: cleanNumericValue(item.salesTaxApplicable),

            salesTaxWithheldAtSource: cleanNumericValue(
              item.salesTaxWithheldAtSource
            ),

            furtherTax: cleanNumericValue(item.furtherTax),

            sroScheduleNo: cleanValue(item.sroScheduleNo),

            fedPayable: cleanNumericValue(item.fedPayable),

            advanceIncomeTax: cleanNumericValue(item.advanceIncomeTax),

            discount: cleanNumericValue(item.discount),

            saleType: cleanValue(item.saleType),

            sroItemSerialNo: cleanValue(item.sroItemSerialNo),
          };

          // Only include extraTax when it's a positive value (> 0)

          const extraTaxValue = cleanNumericValue(item.extraTax);

          if (extraTaxValue !== null && Number(extraTaxValue) > 0) {
            mappedItem.extraTax = extraTaxValue;
          }

          // Debug: Log the mapped item
          console.log("🔍 Backend Debug: Product name mapping details:", {
            originalProductName: item.productName,
            originalName: item.name,
            finalName: mappedItem.name,
            cleanValueResult: cleanValue(item.productName || item.name),
          });

          console.log(
            "Mapped invoice item:",

            JSON.stringify(mappedItem, null, 2)
          );

          return mappedItem;
        });

        console.log(
          "About to create invoice items:",

          JSON.stringify(invoiceItems, null, 2)
        );

        // Debug: Check each item before insertion
        invoiceItems.forEach((item, index) => {
          console.log(`🔍 Backend Debug: Item ${index} before insertion:`, {
            name: item.name,
            productName: item.productName,
            hsCode: item.hsCode,
          });
        });

        const createdItems = await InvoiceItem.bulkCreate(invoiceItems, {
          transaction: t,
        });

        console.log(
          "🔍 Backend Debug: Items created successfully:",
          createdItems.length
        );

        // Debug: Check what was actually inserted
        if (createdItems && createdItems.length > 0) {
          console.log("🔍 Backend Debug: First created item:", {
            id: createdItems[0].id,
            name: createdItems[0].name,
            hsCode: createdItems[0].hsCode,
          });
        }
      }

      return invoice;
    });

    res.status(200).json({
      success: true,

      message: "Invoice created successfully with FBR invoice number",

      data: {
        invoice_id: result.id,

        invoice_number: result.invoice_number,

        system_invoice_id: result.system_invoice_id,

        status: result.status,

        fbr_invoice_number: result.fbr_invoice_number,
      },
    });
  } catch (error) {
    console.error("Error creating invoice:", error);

    res.status(500).json({
      success: false,

      message: "Error creating invoice",

      error: error.message,
    });
  }
};

// Save invoice as draft

export const saveInvoice = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const {
      id,

      invoiceType,

      invoiceDate,

      sellerNTNCNIC,

      sellerFullNTN,

      sellerBusinessName,

      sellerProvince,

      sellerAddress,

      sellerCity,

      buyerNTNCNIC,

      buyerBusinessName,

      buyerProvince,

      buyerAddress,

      buyerRegistrationType,

      invoiceRefNo,

      companyInvoiceRefNo,

      internalInvoiceNo,

      transctypeId,

      items,
    } = req.body;

    // Create or update draft invoice in a transaction

    const result = await req.tenantDb.transaction(async (t) => {
      let invoice = null;

      if (id) {
        invoice = await Invoice.findByPk(id, { transaction: t });

        if (!invoice) {
          throw new Error("Invoice not found");
        }

        if (invoice.status !== "draft") {
          throw new Error("Only draft invoices can be updated");
        }

        // Check if the current invoice number already has DRAFT_ prefix

        let updatedInvoiceNumber = invoice.invoice_number;

        if (
          !updatedInvoiceNumber ||
          !updatedInvoiceNumber.startsWith("DRAFT_")
        ) {
          // Generate a new DRAFT_ invoice number if it doesn't have the right prefix

          updatedInvoiceNumber = await generateShortInvoiceId(Invoice, "DRAFT");
        }

        // Update invoice header

        await invoice.update(
          {
            invoice_number: updatedInvoiceNumber,

            invoiceType,

            invoiceDate,

            sellerNTNCNIC,

            sellerFullNTN,

            sellerBusinessName,

            sellerProvince,

            sellerAddress,

            sellerCity,

            buyerNTNCNIC,

            buyerBusinessName,

            buyerProvince,

            buyerAddress,

            buyerRegistrationType,

            invoiceRefNo,

            companyInvoiceRefNo,

            internal_invoice_no: internalInvoiceNo,

            transctypeId,

            status: "draft",

            fbr_invoice_number: null,
          },

          { transaction: t }
        );

        // Replace items

        await InvoiceItem.destroy({
          where: { invoice_id: invoice.id },

          transaction: t,
        });
      } else {
        // Generate a temporary invoice number for draft

        const tempInvoiceNumber = await generateShortInvoiceId(
          Invoice,

          "DRAFT"
        );

        // Generate system invoice ID

        const systemInvoiceId = await generateSystemInvoiceId(Invoice);

        invoice = await Invoice.create(
          {
            invoice_number: tempInvoiceNumber,

            system_invoice_id: systemInvoiceId,

            invoiceType,

            invoiceDate,

            sellerNTNCNIC,

            sellerFullNTN,

            sellerBusinessName,

            sellerProvince,

            sellerAddress,

            sellerCity,

            buyerNTNCNIC,

            buyerBusinessName,

            buyerProvince,

            buyerAddress,

            buyerRegistrationType,

            invoiceRefNo,

            companyInvoiceRefNo,

            internal_invoice_no: internalInvoiceNo,

            transctypeId,

            status: "draft",

            fbr_invoice_number: null,
          },

          { transaction: t }
        );
      }

      // Create invoice items if provided

      if (items && Array.isArray(items) && items.length > 0) {
        const invoiceItems = items.map((item) => {
          const cleanValue = (value) => {
            if (
              value === "" ||
              value === "N/A" ||
              value === null ||
              value === undefined
            ) {
              return null;
            }

            return value;
          };

          const cleanNumericValue = (value) => {
            const cleaned = cleanValue(value);

            if (cleaned === null) return null;

            const num = parseFloat(cleaned);

            return isNaN(num) ? null : num;
          };

          // Helper function to clean hsCode with length validation
          const cleanHsCode = (value) => {
            const cleaned = cleanValue(value);
            if (cleaned === null) return null;

            const stringValue = String(cleaned);

            // Extract HS code from description if it contains a dash separator
            // Format: "8432.1010 - NUCLEAR REACTOR, BOILERS, MACHINERY AN"
            let hsCode = stringValue;
            if (stringValue.includes(" - ")) {
              hsCode = stringValue.split(" - ")[0].trim();
            }

            // Truncate to 50 characters to match database field length
            return hsCode.substring(0, 50);
          };

          const mappedItem = {
            invoice_id: invoice.id,

            hsCode: cleanHsCode(item.hsCode),

            name: cleanValue(item.productName || item.name),

            productDescription: cleanValue(item.productDescription),

            rate: cleanValue(item.rate),

            uoM: cleanValue(item.uoM),

            quantity: cleanNumericValue(item.quantity),

            unitPrice: cleanNumericValue(item.unitPrice),

            totalValues: cleanNumericValue(item.totalValues),

            valueSalesExcludingST: cleanNumericValue(
              item.valueSalesExcludingST
            ),

            fixedNotifiedValueOrRetailPrice: cleanNumericValue(
              item.fixedNotifiedValueOrRetailPrice
            ),

            salesTaxApplicable: cleanNumericValue(item.salesTaxApplicable),

            salesTaxWithheldAtSource: cleanNumericValue(
              item.salesTaxWithheldAtSource
            ),

            furtherTax: cleanNumericValue(item.furtherTax),

            sroScheduleNo: cleanValue(item.sroScheduleNo),

            fedPayable: cleanNumericValue(item.fedPayable),

            advanceIncomeTax: cleanNumericValue(item.advanceIncomeTax),

            discount: cleanNumericValue(item.discount),

            saleType: cleanValue(item.saleType),

            sroItemSerialNo: cleanValue(item.sroItemSerialNo),
          };

          // Only include extraTax when it's a positive value (> 0)

          const extraTaxValue = cleanNumericValue(item.extraTax);

          if (extraTaxValue !== null && Number(extraTaxValue) > 0) {
            mappedItem.extraTax = extraTaxValue;
          }

          return mappedItem;
        });

        await InvoiceItem.bulkCreate(invoiceItems, { transaction: t });
      }

      return invoice;
    });

    res.status(201).json({
      success: true,

      message: "Invoice saved as draft successfully",

      data: {
        invoice_id: result.id,

        invoice_number: result.invoice_number,

        system_invoice_id: result.system_invoice_id,

        status: result.status,
      },
    });
  } catch (error) {
    console.error("Error saving invoice:", error);

    res.status(500).json({
      success: false,

      message: "Error saving invoice",

      error: error.message,
    });
  }
};

// Save and validate invoice

export const saveAndValidateInvoice = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const {
      id,

      invoiceType,

      invoiceDate,

      sellerNTNCNIC,

      sellerFullNTN,

      sellerBusinessName,

      sellerProvince,

      sellerAddress,

      sellerCity,

      buyerNTNCNIC,

      buyerBusinessName,

      buyerProvince,

      buyerAddress,

      buyerRegistrationType,

      invoiceRefNo,

      companyInvoiceRefNo,

      internalInvoiceNo,

      transctypeId,

      items,
    } = req.body;

    // Generate a temporary invoice number for saved invoice

    const tempInvoiceNumber = await generateShortInvoiceId(Invoice, "SAVED");

    // Validate the data first (basic validation)

    const validationErrors = [];

    // Validate seller fields

    if (
      !sellerNTNCNIC ||
      !sellerBusinessName ||
      !sellerProvince ||
      !sellerAddress
    ) {
      validationErrors.push("Seller information is incomplete");
    }

    // Validate buyer fields

    if (
      !buyerNTNCNIC ||
      !buyerBusinessName ||
      !buyerProvince ||
      !buyerAddress
    ) {
      validationErrors.push("Buyer information is incomplete");
    }

    // Validate items

    if (!items || items.length === 0) {
      validationErrors.push("At least one item is required");
    } else {
      items.forEach((item, index) => {
        if (!item.hsCode || !item.rate || !item.uoM) {
          validationErrors.push(`Item ${index + 1} has incomplete information`);
        }
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,

        message: "Validation failed",

        errors: validationErrors,
      });
    }

    // Save as draft (validated) - upsert behavior like saveInvoice

    const result = await req.tenantDb.transaction(async (t) => {
      let invoice = null;

      if (id) {
        invoice = await Invoice.findByPk(id, { transaction: t });

        if (!invoice) {
          throw new Error("Invoice not found");
        }

        if (invoice.status !== "draft") {
          throw new Error("Only draft invoices can be updated");
        }

        await invoice.update(
          {
            invoice_number: tempInvoiceNumber,

            invoiceType,

            invoiceDate,

            sellerNTNCNIC,

            sellerFullNTN,

            sellerBusinessName,

            sellerProvince,

            sellerAddress,

            sellerCity,

            buyerNTNCNIC,

            buyerBusinessName,

            buyerProvince,

            buyerAddress,

            buyerRegistrationType,

            invoiceRefNo,

            companyInvoiceRefNo,

            internal_invoice_no: internalInvoiceNo,

            transctypeId,

            status: "draft",

            fbr_invoice_number: null,
          },

          { transaction: t }
        );

        await InvoiceItem.destroy({
          where: { invoice_id: invoice.id },

          transaction: t,
        });
      } else {
        // Generate system invoice ID

        const systemInvoiceId = await generateSystemInvoiceId(Invoice);

        invoice = await Invoice.create(
          {
            invoice_number: tempInvoiceNumber,

            system_invoice_id: systemInvoiceId,

            invoiceType,

            invoiceDate,

            sellerNTNCNIC,

            sellerFullNTN,

            sellerBusinessName,

            sellerProvince,

            sellerAddress,

            sellerCity,

            buyerNTNCNIC,

            buyerBusinessName,

            buyerProvince,

            buyerAddress,

            buyerRegistrationType,

            invoiceRefNo,

            companyInvoiceRefNo,

            internal_invoice_no: internalInvoiceNo,

            transctypeId,

            status: "draft",

            fbr_invoice_number: null,
          },

          { transaction: t }
        );
      }

      if (items && Array.isArray(items) && items.length > 0) {
        const invoiceItems = items.map((item) => {
          const cleanValue = (value) => {
            if (
              value === "" ||
              value === "N/A" ||
              value === null ||
              value === undefined
            ) {
              return null;
            }

            return value;
          };

          const cleanNumericValue = (value) => {
            const cleaned = cleanValue(value);

            if (cleaned === null) return null;

            const num = parseFloat(cleaned);

            return isNaN(num) ? null : num;
          };

          // Helper function to clean hsCode with length validation
          const cleanHsCode = (value) => {
            const cleaned = cleanValue(value);
            if (cleaned === null) return null;

            const stringValue = String(cleaned);

            // Extract HS code from description if it contains a dash separator
            // Format: "8432.1010 - NUCLEAR REACTOR, BOILERS, MACHINERY AN"
            let hsCode = stringValue;
            if (stringValue.includes(" - ")) {
              hsCode = stringValue.split(" - ")[0].trim();
            }

            // Truncate to 50 characters to match database field length
            return hsCode.substring(0, 50);
          };

          const mappedItem = {
            invoice_id: invoice.id,

            hsCode: cleanHsCode(item.hsCode),

            name: cleanValue(item.productName || item.name),

            productDescription: cleanValue(item.productDescription),

            rate: cleanValue(item.rate),

            uoM: cleanValue(item.uoM),

            quantity: cleanNumericValue(item.quantity),

            unitPrice: cleanNumericValue(item.unitPrice),

            totalValues: cleanNumericValue(item.totalValues),

            valueSalesExcludingST: cleanNumericValue(
              item.valueSalesExcludingST
            ),

            fixedNotifiedValueOrRetailPrice: cleanNumericValue(
              item.fixedNotifiedValueOrRetailPrice
            ),

            salesTaxApplicable: cleanNumericValue(item.salesTaxApplicable),

            salesTaxWithheldAtSource: cleanNumericValue(
              item.salesTaxWithheldAtSource
            ),

            furtherTax: cleanNumericValue(item.furtherTax),

            sroScheduleNo: cleanValue(item.sroScheduleNo),

            fedPayable: cleanNumericValue(item.fedPayable),

            advanceIncomeTax: cleanNumericValue(item.advanceIncomeTax),

            discount: cleanNumericValue(item.discount),

            saleType: cleanValue(item.saleType),

            sroItemSerialNo: cleanValue(item.sroItemSerialNo),
          };

          // Only include extraTax when it's a positive value (> 0)

          const extraTaxValue = cleanNumericValue(item.extraTax);

          if (extraTaxValue !== null && Number(extraTaxValue) > 0) {
            mappedItem.extraTax = extraTaxValue;
          }

          return mappedItem;
        });

        await InvoiceItem.bulkCreate(invoiceItems, { transaction: t });
      }

      return invoice;
    });

    res.status(201).json({
      success: true,

      message: "Invoice validated and saved as draft successfully",

      data: {
        invoice_id: result.id,

        invoice_number: result.invoice_number,

        system_invoice_id: result.system_invoice_id,

        status: result.status,
      },
    });
  } catch (error) {
    console.error("Error saving and validating invoice:", error);

    res.status(500).json({
      success: false,

      message: "Error saving and validating invoice",

      error: error.message,
    });
  }
};

// Get all invoices

export const getAllInvoices = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const {
      page = 1,
      limit = 10,
      search,
      start_date,
      end_date,
      sale_type,
      status,
    } = req.query;

    // Ensure numeric pagination params
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality

    if (search) {
      whereClause[req.tenantDb.Sequelize.Op.or] = [
        { invoice_number: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },

        {
          fbr_invoice_number: {
            [req.tenantDb.Sequelize.Op.like]: `%${search}%`,
          },
        },

        {
          buyerBusinessName: {
            [req.tenantDb.Sequelize.Op.like]: `%${search}%`,
          },
        },

        {
          sellerBusinessName: {
            [req.tenantDb.Sequelize.Op.like]: `%${search}%`,
          },
        },
      ];
    }

    // Add sale type filter

    if (sale_type && sale_type !== "All") {
      whereClause.invoiceType = sale_type;
    }

    // Add status filter - show all invoices by default

    if (status && status !== "All") {
      whereClause.status = status;
    }

    // Removed default filter to show all invoices (draft, saved, validated, posted, etc.)

    // Add date range filter

    if (start_date && end_date) {
      whereClause.created_at = {
        [req.tenantDb.Sequelize.Op.between]: [
          new Date(start_date),

          new Date(end_date),
        ],
      };
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where: whereClause,

      include: [
        {
          model: InvoiceItem,

          as: "InvoiceItems",
        },
      ],

      // Fix incorrect counts and pagination when using includes
      distinct: true,

      limit: limitNumber,

      offset: offset,

      order: [["created_at", "DESC"]],
    });

    // Transform the data to match frontend expectations

    const transformedInvoices = rows.map((invoice) => {
      const plainInvoice = invoice.get({ plain: true });

      plainInvoice.items = plainInvoice.InvoiceItems || []; // 👈 normalize for EJS

      // Use FBR invoice number if available, otherwise use the original invoice number

      const displayInvoiceNumber =
        plainInvoice.fbr_invoice_number || plainInvoice.invoice_number;

      // Debug logging for invoice numbers

      console.log("Invoice display logic:", {
        id: plainInvoice.id,

        original_invoice_number: plainInvoice.invoice_number,

        fbr_invoice_number: plainInvoice.fbr_invoice_number,

        display_invoice_number: displayInvoiceNumber,

        status: plainInvoice.status,
      });

      return {
        id: plainInvoice.id,

        invoiceNumber: displayInvoiceNumber,

        systemInvoiceId: plainInvoice.system_invoice_id,

        invoiceType: plainInvoice.invoiceType,

        invoiceDate: plainInvoice.invoiceDate,

        sellerNTNCNIC: plainInvoice.sellerNTNCNIC,

        sellerFullNTN:
          req.tenant?.seller_full_ntn || plainInvoice.sellerFullNTN,

        sellerBusinessName: plainInvoice.sellerBusinessName,

        sellerProvince: plainInvoice.sellerProvince,

        sellerAddress: plainInvoice.sellerAddress,

        sellerCity: plainInvoice.sellerCity,

        buyerNTNCNIC: plainInvoice.buyerNTNCNIC,

        buyerBusinessName: plainInvoice.buyerBusinessName,

        buyerProvince: plainInvoice.buyerProvince,

        buyerAddress: plainInvoice.buyerAddress,

        buyerRegistrationType: plainInvoice.buyerRegistrationType,

        invoiceRefNo: plainInvoice.invoiceRefNo,

        transctypeId: plainInvoice.transctypeId,

        status: plainInvoice.status,

        companyInvoiceRefNo: plainInvoice.companyInvoiceRefNo,

        fbr_invoice_number: plainInvoice.fbr_invoice_number,

        items: (plainInvoice.InvoiceItems || []).map((item) => ({
          ...item,

          retailPrice:
            item.fixedNotifiedValueOrRetailPrice || item.retailPrice || "0",
        })),

        created_at: plainInvoice.created_at,

        updated_at: plainInvoice.updated_at,
      };
    });

    res.status(200).json({
      success: true,

      data: {
        invoices: transformedInvoices,

        pagination: {
          current_page: pageNumber,
          total_pages: Math.ceil(count / limitNumber),
          total_records: count,
          records_per_page: limitNumber,
        },
      },
    });
  } catch (error) {
    console.error("Error getting invoices:", error);

    res.status(500).json({
      success: false,

      message: "Error retrieving invoices",

      error: error.message,
    });
  }
};

// Get invoice by ID with items

export const getInvoiceById = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const { id } = req.params;

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: InvoiceItem,

          as: "InvoiceItems",
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,

        message: "Invoice not found",
      });
    }

    // Transform the data to match frontend expectations

    const plainInvoice = invoice.get({ plain: true });

    plainInvoice.items = plainInvoice.InvoiceItems || []; // 👈 normalize for EJS

    const transformedInvoice = {
      id: plainInvoice.id,

      invoiceNumber: plainInvoice.invoice_number,

      systemInvoiceId: plainInvoice.system_invoice_id,

      invoiceType: plainInvoice.invoiceType,

      invoiceDate: plainInvoice.invoiceDate,

      sellerNTNCNIC: plainInvoice.sellerNTNCNIC,

      sellerFullNTN: req.tenant?.seller_full_ntn || plainInvoice.sellerFullNTN,

      sellerBusinessName: plainInvoice.sellerBusinessName,

      sellerProvince: plainInvoice.sellerProvince,

      sellerAddress: plainInvoice.sellerAddress,

      sellerCity: plainInvoice.sellerCity,

      buyerNTNCNIC: plainInvoice.buyerNTNCNIC,

      buyerBusinessName: plainInvoice.buyerBusinessName,

      buyerProvince: plainInvoice.buyerProvince,

      buyerAddress: plainInvoice.buyerAddress,

      buyerRegistrationType: plainInvoice.buyerRegistrationType,

      invoiceRefNo: plainInvoice.invoiceRefNo,

      transctypeId: plainInvoice.transctypeId,

      status: plainInvoice.status,

      companyInvoiceRefNo: plainInvoice.companyInvoiceRefNo,

      fbr_invoice_number: plainInvoice.fbr_invoice_number,

      items: (plainInvoice.InvoiceItems || []).map((item) => ({
        ...item,

        retailPrice:
          item.fixedNotifiedValueOrRetailPrice || item.retailPrice || "0",
      })),

      created_at: plainInvoice.created_at,

      updated_at: plainInvoice.updated_at,
    };

    res.status(200).json({
      success: true,

      data: transformedInvoice,
    });
  } catch (error) {
    console.error("Error getting invoice:", error);

    res.status(500).json({
      success: false,

      message: "Error retrieving invoice",

      error: error.message,
    });
  }
};

// Get invoice by invoice number

export const getInvoiceByNumber = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const { invoiceNumber } = req.params;

    const invoice = await Invoice.findOne({
      where: { invoice_number: invoiceNumber },

      include: [
        {
          model: InvoiceItem,

          as: "InvoiceItems",
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,

        message: "Invoice not found",
      });
    }

    // Transform the data to match frontend expectations

    const plainInvoice = invoice.get({ plain: true });

    const transformedInvoice = {
      ...plainInvoice,

      sellerCity: plainInvoice.sellerCity,

      items: (plainInvoice.InvoiceItems || []).map((item) => ({
        ...item,

        retailPrice:
          item.fixedNotifiedValueOrRetailPrice || item.retailPrice || "0",
      })),
    };

    res.status(200).json({
      success: true,

      data: transformedInvoice,
    });
  } catch (error) {
    console.error("Error getting invoice by number:", error);

    res.status(500).json({
      success: false,

      message: "Error retrieving invoice",

      error: error.message,
    });
  }
};

// Print invoice

export const printInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // Find invoice across all tenant databases

    const result = await TenantDatabaseService.findInvoiceAcrossTenants(id);

    if (!result) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const { invoice, tenantDb, tenant } = result;

    const { InvoiceItem } = tenantDb.models;

    // Fetch invoice with items using the already found invoice

    const invoiceWithItems = await invoice.constructor.findOne({
      where: { id: invoice.id },

      include: [{ model: InvoiceItem, as: "InvoiceItems" }],
    });

    if (!invoiceWithItems) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Base64 encode logos

    const fbrLogoBase64 = fs

      .readFileSync(path.join(process.cwd(), "public", "fbr_logo.png"))

      .toString("base64");

    const companyLogoBase64 = fs

      .readFileSync(path.join(process.cwd(), "public", "fbr-logo-1.png"))

      .toString("base64");

    const pakistanGumLogoBase64 = fs

      .readFileSync(
        path.join(process.cwd(), "public", "images", "Pakprogressive.png")
      )

      .toString("base64");

    // Prepare paths

    const pdfFileName = `${invoiceWithItems.invoice_number}.pdf`;

    const invoiceDir = path.join(process.cwd(), "public", "invoices");

    const pdfPath = path.join(invoiceDir, pdfFileName);

    // Ensure output directory exists

    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    // Generate QR code

    const qrUrl = invoiceWithItems.invoice_number;

    const qrData = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: "M",

      width: 96,
    });

    const plainInvoice = invoiceWithItems.get({ plain: true });

    plainInvoice.items = plainInvoice.InvoiceItems || []; // 👈 normalize for EJS

    // Format date to dd-mm-yyyy

    const formatDate = (dateString) => {
      if (!dateString) return "N/A";

      try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) return "N/A";

        const day = String(date.getDate()).padStart(2, "0");

        const month = String(date.getMonth() + 1).padStart(2, "0");

        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
      } catch (error) {
        return "N/A";
      }
    };

    // Format the invoice date

    plainInvoice.invoiceDate = formatDate(plainInvoice.invoiceDate);

    // Ensure latest seller details from master tenant record are used
    if (tenant) {
      // When coming from findInvoiceAcrossTenants, tenant fields are camelCase
      plainInvoice.sellerBusinessName =
        tenant.sellerBusinessName || plainInvoice.sellerBusinessName;
      plainInvoice.sellerAddress =
        tenant.sellerAddress || plainInvoice.sellerAddress;
      plainInvoice.sellerProvince =
        tenant.sellerProvince || plainInvoice.sellerProvince;
      plainInvoice.sellerFullNTN =
        tenant.sellerFullNTN || plainInvoice.sellerFullNTN;
      // Some templates read underscore variant
      plainInvoice.seller_full_ntn =
        tenant.sellerFullNTN || plainInvoice.seller_full_ntn;
    }

    // Render EJS HTML

    const html = await ejs.renderFile(
      path.join(process.cwd(), "src", "views", "invoiceTemplate.ejs"),

      {
        invoice: plainInvoice,

        qrData,

        fbrLogoBase64,

        companyLogoBase64,

        pakistanGumLogoBase64,

        showFbrLogo: invoiceWithItems.status === "posted", // Only show FBR logo for posted invoices

        showQRCode: invoiceWithItems.status === "posted", // Only show QR code for posted invoices

        convertToWords: (amount) => {
          if (!amount || isNaN(amount)) return "Zero Rupees Only";

          const rupees = Math.floor(amount);

          const paisa = Math.round((amount - rupees) * 100);

          let result = "";

          if (rupees > 0) {
            const rupeesWords = toWords(rupees);

            result =
              rupeesWords.replace(/,/g, "").charAt(0).toUpperCase() +
              rupeesWords.replace(/,/g, "").slice(1) +
              " Rupees";
          }

          if (paisa > 0) {
            if (result) result += " and ";

            const paisaWords = toWords(paisa);

            result +=
              paisaWords.replace(/,/g, "").charAt(0).toLowerCase() +
              paisaWords.replace(/,/g, "").slice(1) +
              " Paisa";
          }

          if (!result) result = "Zero Rupees";

          result += " Only";

          return result;
        },
      }
    );

    // Generate PDF using Puppeteer

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });

    await browser.close();

    // Stream PDF to browser

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `inline; filename=${pdfFileName}`);

    fs.createReadStream(pdfPath).pipe(res);
  } catch (error) {
    console.error("PDF generation failed:", error);

    res.status(500).json({
      message: "Error generating invoice",

      error: error.message,
    });
  }
};

// Update invoice

export const updateInvoice = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;

    const { id } = req.params;

    const updateData = req.body;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,

        message: "Invoice not found",
      });
    }

    await invoice.update(updateData);

    res.status(200).json({
      success: true,

      message: "Invoice updated successfully",

      data: invoice,
    });
  } catch (error) {
    console.error("Error updating invoice:", error);

    res.status(500).json({
      success: false,

      message: "Error updating invoice",

      error: error.message,
    });
  }
};

// Delete invoice

export const deleteInvoice = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;

    const { id } = req.params;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,

        message: "Invoice not found",
      });
    }

    await invoice.destroy();

    res.status(200).json({
      success: true,

      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);

    res.status(500).json({
      success: false,

      message: "Error deleting invoice",

      error: error.message,
    });
  }
};

// Get invoice statistics

export const getInvoiceStats = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;

    const { start_date, end_date } = req.query;

    const whereClause = {};

    if (start_date && end_date) {
      whereClause.created_at = {
        [req.tenantDb.Sequelize.Op.between]: [
          new Date(start_date),

          new Date(end_date),
        ],
      };
    }

    const totalInvoices = await Invoice.count({ where: whereClause });

    const totalAmount = await Invoice.sum("totalValues", {
      where: whereClause,
    });

    // Get invoices by month

    const monthlyStats = await Invoice.findAll({
      attributes: [
        [
          req.tenantDb.Sequelize.fn(
            "DATE_FORMAT",

            req.tenantDb.Sequelize.col("created_at"),

            "%Y-%m"
          ),

          "month",
        ],

        [
          req.tenantDb.Sequelize.fn("COUNT", req.tenantDb.Sequelize.col("id")),

          "count",
        ],

        [
          req.tenantDb.Sequelize.fn(
            "SUM",

            req.tenantDb.Sequelize.col("totalValues")
          ),

          "total_amount",
        ],
      ],

      where: whereClause,

      group: [
        req.tenantDb.Sequelize.fn(
          "DATE_FORMAT",

          req.tenantDb.Sequelize.col("created_at"),

          "%Y-%m"
        ),
      ],

      order: [
        [
          req.tenantDb.Sequelize.fn(
            "DATE_FORMAT",

            Sequelize.col("created_at"),

            "%Y-%m"
          ),

          "DESC",
        ],
      ],
    });

    res.status(200).json({
      success: true,

      data: {
        total_invoices: totalInvoices,

        total_amount: totalAmount || 0,

        monthly_stats: monthlyStats,
      },
    });
  } catch (error) {
    console.error("Error getting invoice stats:", error);

    res.status(500).json({
      success: false,

      message: "Error retrieving invoice statistics",

      error: error.message,
    });
  }
};

// Submit saved invoice to FBR

export const submitSavedInvoice = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const { id } = req.params;

    // Find the invoice

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: InvoiceItem,

          as: "InvoiceItems",
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,

        message: "Invoice not found",
      });
    }

    if (invoice.status !== "draft") {
      return res.status(400).json({
        success: false,

        message: "Only draft invoices can be posted to FBR",
      });
    }

    // Check if transctypeId is provided

    if (!invoice.transctypeId) {
      return res.status(400).json({
        success: false,

        message:
          "Transaction Type ID is required. Please select a transaction type before submitting to FBR.",
      });
    }

    // Helper functions for data cleaning

    const cleanValue = (value) => {
      if (value === null || value === undefined || value === "") return null;

      return String(value).trim();
    };

    const cleanNumericValue = (value) => {
      const cleaned = cleanValue(value);

      if (cleaned === null) return null;

      const num = parseFloat(cleaned);

      return isNaN(num) ? null : num;
    };

    // Prepare data for FBR submission

    const fbrData = {
      invoiceType: cleanValue(invoice.invoiceType),

      invoiceDate: cleanValue(invoice.invoiceDate),

      sellerNTNCNIC: cleanValue(invoice.sellerNTNCNIC),

      sellerBusinessName: cleanValue(invoice.sellerBusinessName),

      sellerProvince: cleanValue(invoice.sellerProvince),

      sellerAddress: cleanValue(invoice.sellerAddress),

      buyerNTNCNIC: cleanValue(invoice.buyerNTNCNIC),

      buyerBusinessName: cleanValue(invoice.buyerBusinessName),

      buyerProvince: cleanValue(invoice.buyerProvince),

      buyerAddress: cleanValue(invoice.buyerAddress),

      buyerRegistrationType: cleanValue(invoice.buyerRegistrationType),

      invoiceRefNo: cleanValue(invoice.invoiceRefNo),

      // FBR expects camelCase key: transctypeId

      transctypeId: cleanValue(invoice.transctypeId),

      items: invoice.InvoiceItems.map((item) => {
        // Handle RS. rate format for FBR submission

        let processedRate = cleanValue(item.rate);

        console.log(
          `Processing rate for item ${item.id}: Original="${item.rate}", Cleaned="${processedRate}"`
        );

        if (
          processedRate &&
          (processedRate.includes("RS.") ||
            processedRate.includes("rs.") ||
            processedRate.includes("Rs."))
        ) {
          // For RS. format, we need to convert it to a format FBR accepts

          // Extract the numeric value and set it as a standard rate

          const numericValue =
            parseFloat(processedRate.replace(/RS\./i, "").trim()) || 0;

          // Check the sales type to determine the appropriate rate

          const saleType = cleanValue(item.saleType) || "";

          if (saleType.includes("Reduced Rate")) {
            processedRate = 12; // Use reduced rate for FBR
          } else if (
            saleType.includes("zero-rate") ||
            saleType.includes("Zero")
          ) {
            processedRate = 0; // Use zero rate for FBR
          } else {
            processedRate = 17; // Use standard rate for FBR
          }

          console.log(
            `RS. rate detected and converted: "${item.rate}" -> "${processedRate}" (using ${saleType} rate for FBR, fixed amount: ${numericValue})`
          );
        }

        const baseItem = {
          hsCode: cleanValue(item.hsCode).substring(0, 50),

          productDescription: cleanValue(item.productDescription),

          rate: processedRate,

          uoM: cleanValue(item.uoM),

          quantity: cleanNumericValue(item.quantity),

          unitPrice: cleanNumericValue(item.unitPrice),

          totalValues: cleanNumericValue(item.totalValues),

          valueSalesExcludingST: cleanNumericValue(item.valueSalesExcludingST),

          fixedNotifiedValueOrRetailPrice: cleanNumericValue(
            item.fixedNotifiedValueOrRetailPrice
          ),

          salesTaxApplicable: cleanNumericValue(item.salesTaxApplicable),

          salesTaxWithheldAtSource: cleanNumericValue(
            item.salesTaxWithheldAtSource
          ),

          furtherTax: cleanNumericValue(item.furtherTax),

          sroScheduleNo: cleanValue(item.sroScheduleNo),

          fedPayable: cleanNumericValue(item.fedPayable),

          discount: cleanNumericValue(item.discount),

          saleType: cleanValue(item.saleType),

          sroItemSerialNo: cleanValue(item.sroItemSerialNo),
        };

        // Only include extraTax when it's a positive value (> 0) and not applicable for reduced/exempt

        const extraTaxValue = cleanNumericValue(item.extraTax);

        const isReduced =
          (cleanValue(item.saleType) || "").trim() === "Goods at Reduced Rate";

        const rateValue = cleanValue(item.rate) || "";

        const isExempt =
          typeof rateValue === "string" && rateValue.toLowerCase() === "exempt";

        if (
          extraTaxValue !== null &&
          Number(extraTaxValue) > 0 &&
          !isReduced &&
          !isExempt
        ) {
          baseItem.extraTax = extraTaxValue;
        }

        return baseItem;
      }),
    };

    // Debug: Log the cleaned data being sent to FBR

    console.log(
      "Cleaned FBR data being sent:",

      JSON.stringify(fbrData, null, 2)
    );

    // Additional debug: Log rate processing summary

    console.log("Rate processing summary:");

    fbrData.items.forEach((item, index) => {
      console.log(
        `  Item ${index + 1}: rate="${item.rate}", salesTaxApplicable="${item.salesTaxApplicable}", saleType="${item.saleType}"`
      );
    });

    // Get tenant FBR token from the tenant middleware

    if (!req.tenant || !req.tenant.sandboxTestToken) {
      return res.status(400).json({
        success: false,

        message: "FBR token not found for this tenant",
      });
    }

    // Import FBR API functions

    const { postData } = await import("../../service/FBRService.js");

    // Submit directly to FBR (skipping validation)

    const postRes = await postData(
      "di_data/v1/di/postinvoicedata",

      fbrData,

      "sandbox",

      req.tenant.sandboxTestToken
    );

    console.log("FBR Response:", JSON.stringify(postRes.data, null, 2));

    console.log("FBR Response Type:", typeof postRes.data);

    const dataSizeInfo = Array.isArray(postRes.data)
      ? postRes.data.length
      : typeof postRes.data === "object" && postRes.data !== null
        ? Object.keys(postRes.data).length
        : typeof postRes.data === "string"
          ? postRes.data.length
          : 0;

    console.log("FBR Response Data Size:", dataSizeInfo);

    // Handle different FBR response structures

    let isSuccess = false;

    let fbrInvoiceNumber = null;

    let errorDetails = null;

    if (postRes.status === 200) {
      // Check for validationResponse structure (old format)

      if (postRes.data && postRes.data.validationResponse) {
        const validation = postRes.data.validationResponse;

        isSuccess = validation.statusCode === "00";

        fbrInvoiceNumber = postRes.data.invoiceNumber;

        console.log("FBR Response - validationResponse format:", {
          statusCode: validation.statusCode,

          isSuccess,

          fbrInvoiceNumber,
        });

        if (!isSuccess) {
          errorDetails = validation;
        }
      }

      // Check for direct response structure (new format)
      else if (
        postRes.data &&
        (postRes.data.invoiceNumber || postRes.data.success)
      ) {
        isSuccess = true;

        fbrInvoiceNumber = postRes.data.invoiceNumber;

        console.log("FBR Response - direct format:", {
          isSuccess,

          fbrInvoiceNumber,

          success: postRes.data.success,
        });
      }

      // Check for error response structure
      else if (postRes.data && postRes.data.error) {
        isSuccess = false;

        errorDetails = postRes.data;

        console.log("FBR Response - error format:", postRes.data.error);
      }

      // Check for empty response - this might be a successful submission
      else if (!postRes.data || postRes.data === "") {
        console.log(
          "FBR returned empty response with 200 status - treating as successful submission"
        );

        isSuccess = true;

        // For empty responses, we'll use the original invoice number as FBR invoice number

        fbrInvoiceNumber = req.body.invoice_number || `FBR_${Date.now()}`;

        console.log(
          "Using original invoice number as FBR invoice number:",

          fbrInvoiceNumber
        );
      }

      // If response is unexpected, treat as success if status is 200
      else {
        isSuccess = true;

        console.log(
          "FBR returned 200 status with unexpected response structure, treating as success"
        );

        console.log("Unexpected response structure:", postRes.data);
      }
    } else {
      console.log("FBR returned non-200 status:", postRes.status);
    }

    if (!isSuccess) {
      const details = errorDetails || {
        raw: postRes.data ?? null,

        note: "Unexpected FBR response structure",

        status: postRes.status,
      };

      const collectErrorMessages = (det) => {
        const messages = [];

        if (det && typeof det === "object") {
          if (det.error) messages.push(det.error);

          if (Array.isArray(det.invoiceStatuses)) {
            det.invoiceStatuses.forEach((s) => {
              if (s?.error) messages.push(`Item ${s.itemSNo}: ${s.error}`);
            });
          }

          if (det.validationResponse) {
            const v = det.validationResponse;

            if (v?.error) messages.push(v.error);

            if (Array.isArray(v?.invoiceStatuses)) {
              v.invoiceStatuses.forEach((s) => {
                if (s?.error) messages.push(`Item ${s.itemSNo}: ${s.error}`);
              });
            }
          }
        }

        return messages.filter(Boolean);
      };

      const errorMessages = collectErrorMessages(details);

      const message = errorMessages.length
        ? `FBR submission failed: ${errorMessages.join("; ")}`
        : "FBR submission failed";

      return res.status(400).json({
        success: false,

        message,

        code:
          details?.statusCode ||
          details?.errorCode ||
          details?.validationResponse?.statusCode,

        details,
      });
    }

    // Ensure we have a valid FBR invoice number before updating

    if (!fbrInvoiceNumber || fbrInvoiceNumber.trim() === "") {
      console.log("FBR invoice number validation failed:", {
        fbrInvoiceNumber,

        type: typeof fbrInvoiceNumber,

        length: fbrInvoiceNumber ? fbrInvoiceNumber.length : 0,
      });

      return res.status(400).json({
        success: false,

        message: "FBR submission failed: No invoice number received from FBR",

        details: errorDetails || {
          raw: postRes.data ?? null,

          note: "No invoice number in FBR response",

          status: postRes.status,
        },
      });
    }

    // Update invoice status to 'posted' and replace draft number with FBR number when successfully submitted to FBR

    // This ensures that posted invoices show the official FBR invoice number instead of the draft number

    const updateData = {
      status: "posted",

      fbr_invoice_number: fbrInvoiceNumber,
    };

    // Only update invoice_number if we have a valid FBR invoice number

    if (fbrInvoiceNumber) {
      updateData.invoice_number = fbrInvoiceNumber;
    }

    console.log("Updating invoice with data:", updateData);

    console.log("FBR Response received:", {
      invoiceNumber: postRes.data.invoiceNumber,

      validationResponse: postRes.data.validationResponse,

      statusCode: postRes.data.validationResponse?.statusCode,
    });

    await invoice.update(updateData);

    // Verify the update was successful

    const updatedInvoice = await Invoice.findByPk(invoice.id);

    console.log("Invoice updated successfully:", {
      id: updatedInvoice.id,

      original_invoice_number: updatedInvoice.invoice_number,

      fbr_invoice_number: updatedInvoice.fbr_invoice_number,

      status: updatedInvoice.status,
    });

    res.status(200).json({
      success: true,

      message: "Invoice posted successfully to FBR",

      data: {
        invoice_id: invoice.id,

        fbr_invoice_number: fbrInvoiceNumber,

        status: "posted",
      },
    });
  } catch (error) {
    console.error("Error submitting invoice to FBR:", error);

    res.status(500).json({
      success: false,

      message: "Error submitting invoice to FBR",

      error: error.message,
    });
  }
};

// Bulk create invoices with items (draft status) - CHUNKED OPTIMIZED VERSION
export const bulkCreateInvoices = async (req, res) => {
  const startTime = process.hrtime.bigint();

  try {
    const { Invoice, InvoiceItem, Buyer } = req.tenantModels;
    const sequelize = req.tenantDb;
    const { invoices, chunkSize = 500 } = req.body; // Default chunk size of 500

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invoices array is required and must not be empty",
      });
    }

    console.log(
      `🚀 Starting chunked bulk upload for ${invoices.length} grouped invoices (chunk size: ${chunkSize})...`
    );

    // Debug: Log tenant information
    console.log(`🔍 Debug: Tenant information:`, {
      hasTenant: !!req.tenant,
      tenantKeys: req.tenant ? Object.keys(req.tenant) : [],
      seller_business_name: req.tenant?.seller_business_name,
      seller_province: req.tenant?.seller_province,
      seller_address: req.tenant?.seller_address,
    });

    // Optimize database for bulk operations - do this before any database operations
    try {
      await DatabaseOptimizationService.optimizeForBulkOperations(sequelize, {
        pool: {
          max: 50, // Increased pool size for bulk operations
          min: 20,
          acquire: 120000, // Increased timeout for bulk operations
          idle: 60000,
        },
      });

      console.log("✅ Database optimized for bulk operations");
    } catch (optimizationError) {
      console.warn(
        "⚠️ Database optimization failed, continuing without optimization:",
        optimizationError.message
      );
    }
    console.log("🔍 Debug: Backend received:", {
      totalInvoices: invoices.length,
      sampleInvoice: invoices[0]
        ? {
            invoiceType: invoices[0].invoiceType,
            invoiceDate: invoices[0].invoiceDate,
            companyInvoiceRefNo: invoices[0].companyInvoiceRefNo,
            internalInvoiceNo: invoices[0].internalInvoiceNo,
            buyerBusinessName: invoices[0].buyerBusinessName,
            itemsCount: invoices[0].items?.length || 0,
          }
        : null,
      sampleInternalInvoiceNo: invoices[0]?.internalInvoiceNo,
      hasInternalInvoiceNo: !!invoices[0]?.internalInvoiceNo,
      internalInvoiceNoType: typeof invoices[0]?.internalInvoiceNo,
    });

    // PHASE 1: Data Preparation & Validation (Parallel)
    const validationStart = process.hrtime.bigint();

    // Extract unique buyer NTN/CNIC for batch validation
    const uniqueBuyerNTNs = [
      ...new Set(
        invoices
          .map((inv) => inv.buyerNTNCNIC)
          .filter((ntn) => ntn && ntn.trim())
      ),
    ];

    // Batch fetch existing buyers to avoid individual queries
    const existingBuyers =
      uniqueBuyerNTNs.length > 0
        ? await Buyer.findAll({
            where: { buyerNTNCNIC: uniqueBuyerNTNs },
            attributes: [
              "buyerNTNCNIC",
              "buyerBusinessName",
              "buyerProvince",
              "buyerAddress",
              "buyerRegistrationType",
            ],
          })
        : [];

    // Create lookup maps for O(1) access
    const existingBuyerMap = new Map(
      existingBuyers.map((buyer) => [buyer.buyerNTNCNIC, buyer])
    );

    // Determine starting system invoice number for bulk to match form logic (INV-0001, INV-0002, ...)
    let nextSystemIdNumber = 1;
    try {
      const lastInvoiceForSystemId = await Invoice.findOne({
        where: {
          system_invoice_id: {
            [Invoice.sequelize.Sequelize.Op.like]: "INV-%",
          },
        },
        order: [["system_invoice_id", "DESC"]],
        attributes: ["system_invoice_id"],
      });

      if (
        lastInvoiceForSystemId &&
        lastInvoiceForSystemId.system_invoice_id &&
        typeof lastInvoiceForSystemId.system_invoice_id === "string"
      ) {
        const match =
          lastInvoiceForSystemId.system_invoice_id.match(/INV-(\d+)/);
        if (match) {
          nextSystemIdNumber = parseInt(match[1], 10) + 1;
        }
      }
    } catch (e) {
      // If anything goes wrong, keep nextSystemIdNumber at 1
    }

    // PHASE 2: Batch Data Processing
    const processingStart = process.hrtime.bigint();

    const invoiceBatches = [];
    const invoiceItemBatches = [];
    const newBuyers = [];
    const errors = [];
    const warnings = [];
    const usedSystemIds = new Set(); // Track used system invoice IDs to ensure uniqueness

    console.log(`📊 Processing ${invoices.length} grouped invoices...`);

    // Process all grouped invoices in memory (no database calls yet)
    for (let i = 0; i < invoices.length; i++) {
      const invoiceData = invoices[i];

      // Progress indicator for large files
      if (i % 100 === 0 && i > 0) {
        console.log(`📈 Processed ${i}/${invoices.length} invoices...`);
      }

      try {
        // Quick validation for invoice-level data
        if (
          !invoiceData.invoiceType?.trim() ||
          !invoiceData.invoiceDate?.trim() ||
          !invoiceData.buyerBusinessName?.trim() ||
          !invoiceData.buyerProvince?.trim()
        ) {
          errors.push({
            index: i,
            row: i + 1,
            error: "Missing required invoice fields",
          });
          continue;
        }

        // Additional validation to filter out empty rows with default values
        // But allow invoices with internal invoice numbers even if other fields seem empty
        const hasInternalInvoiceNo = invoiceData.internalInvoiceNo?.trim();
        const hasEmptyData =
          (!hasInternalInvoiceNo &&
            invoiceData.buyerBusinessName?.trim() === "Unknown Buyer") ||
          (!hasInternalInvoiceNo &&
            invoiceData.companyInvoiceRefNo?.trim() === `row_${i + 1}`) ||
          !invoiceData.items ||
          !Array.isArray(invoiceData.items) ||
          invoiceData.items.length === 0 ||
          (invoiceData.items &&
            invoiceData.items.every(
              (item) =>
                (!item.item_productName ||
                  item.item_productName.trim() === "") &&
                (!item.name || item.name.trim() === "") &&
                (!item.productName || item.productName.trim() === "") &&
                (!item.item_quantity ||
                  item.item_quantity === "0" ||
                  item.item_quantity === 0) &&
                (!item.item_unitPrice ||
                  item.item_unitPrice === "0" ||
                  item.item_unitPrice === 0) &&
                (!item.item_totalValues ||
                  item.item_totalValues === "0" ||
                  item.item_totalValues === 0)
            ));

        if (hasEmptyData) {
          console.log(`🚫 Skipping empty row ${i + 1}:`, {
            buyerBusinessName: invoiceData.buyerBusinessName,
            companyInvoiceRefNo: invoiceData.companyInvoiceRefNo,
            itemsCount: invoiceData.items?.length || 0,
            hasProductData: invoiceData.items?.some(
              (item) =>
                item.item_productName?.trim() ||
                item.name?.trim() ||
                item.productName?.trim()
            ),
          });
          continue; // Skip this invoice without adding to errors
        }

        // Validate invoice type
        if (
          !["Sale Invoice", "Debit Note"].includes(
            invoiceData.invoiceType.trim()
          )
        ) {
          errors.push({
            index: i,
            row: i + 1,
            error: 'Invoice type must be "Sale Invoice" or "Debit Note"',
          });
          continue;
        }

        // Validate date format - handle both Excel serial dates and YYYY-MM-DD format
        const dateValue = invoiceData.invoiceDate?.trim();
        if (!dateValue) {
          errors.push({
            index: i,
            row: i + 1,
            error: "Invoice date is required",
          });
          continue;
        }

        // Check if it's an Excel serial date (numeric)
        if (/^\d+$/.test(dateValue)) {
          // Convert Excel serial date to YYYY-MM-DD format
          const excelDate = parseInt(dateValue);
          const date = new Date((excelDate - 25569) * 86400 * 1000);
          if (isNaN(date.getTime())) {
            errors.push({
              index: i,
              row: i + 1,
              error: "Invalid Excel date format",
            });
            continue;
          }
          // Update the invoice data with converted date
          invoiceData.invoiceDate = date.toISOString().split("T")[0];
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          errors.push({
            index: i,
            row: i + 1,
            error:
              "Invoice date must be in YYYY-MM-DD format or Excel serial date",
          });
          continue;
        }

        // Validate province
        const validProvinces = [
          "Balochistan",
          "Azad Jammu and Kashmir",
          "Capital Territory",
          "Punjab",
          "Khyber Pakhtunkhwa",
          "Gilgit Baltistan",
          "Sindh",
          "BALOCHISTAN",
          "AZAD JAMMU AND KASHMIR",
          "CAPITAL TERRITORY",
          "PUNJAB",
          "KHYBER PAKHTUNKHWA",
          "GILGIT BALTISTAN",
          "SINDH",
        ];

        if (!validProvinces.includes(invoiceData.buyerProvince.trim())) {
          errors.push({
            index: i,
            row: i + 1,
            error: "Invalid buyer province",
          });
          continue;
        }

        // Validate items array
        if (
          !Array.isArray(invoiceData.items) ||
          invoiceData.items.length === 0
        ) {
          errors.push({
            index: i,
            row: i + 1,
            error: "Invoice must have at least one item",
          });
          continue;
        }

        // Debug: Log invoice structure
        console.log(`🔍 Debug: Invoice ${i + 1} structure:`, {
          hasItems: !!invoiceData.items,
          itemsLength: invoiceData.items?.length,
          itemsType: typeof invoiceData.items,
          isArray: Array.isArray(invoiceData.items),
          firstItem: invoiceData.items?.[0],
        });

        // Handle buyer creation/validation
        if (invoiceData.buyerNTNCNIC?.trim()) {
          const ntnTrimmed = invoiceData.buyerNTNCNIC.trim();
          const existingBuyer = existingBuyerMap.get(ntnTrimmed);

          if (existingBuyer) {
            // Validate business name consistency
            const providedName = invoiceData.buyerBusinessName?.trim();
            const existingName = existingBuyer.buyerBusinessName?.trim();

            if (
              providedName &&
              existingName &&
              existingName.toLowerCase() !== providedName.toLowerCase()
            ) {
              errors.push({
                index: i,
                row: i + 1,
                error: "Buyer business name mismatch with existing record",
              });
              continue;
            }
          } else {
            // Queue new buyer for batch creation
            newBuyers.push({
              buyerNTNCNIC: ntnTrimmed,
              buyerBusinessName: invoiceData.buyerBusinessName || null,
              buyerProvince: invoiceData.buyerProvince || "",
              buyerAddress: invoiceData.buyerAddress || null,
              buyerRegistrationType:
                invoiceData.buyerRegistrationType || "Unregistered",
            });
          }
        }

        // Generate system invoice ID matching form logic (sequential INV-XXXX)
        let systemInvoiceId = `INV-${String(nextSystemIdNumber).padStart(4, "0")}`;
        // Ensure uniqueness within this batch (extra safety)
        while (usedSystemIds.has(systemInvoiceId)) {
          nextSystemIdNumber += 1;
          systemInvoiceId = `INV-${String(nextSystemIdNumber).padStart(4, "0")}`;
        }
        usedSystemIds.add(systemInvoiceId);
        nextSystemIdNumber += 1;

        // Debug: Log company invoice ref number for bulk create
        console.log(
          `🔍 Backend Debug: Invoice ${i + 1} Company Invoice Ref No:`,
          {
            companyInvoiceRefNo: invoiceData.companyInvoiceRefNo,
            hasValue: !!invoiceData.companyInvoiceRefNo,
            trimmedValue: invoiceData.companyInvoiceRefNo?.trim(),
          }
        );

        // Prepare invoice data for batch insert
        const invoiceRecord = {
          invoice_number: `DRAFT_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
          system_invoice_id: systemInvoiceId,
          invoiceType: invoiceData.invoiceType.trim(),
          invoiceDate: invoiceData.invoiceDate.trim(),
          sellerNTNCNIC: invoiceData.sellerNTNCNIC?.trim() || null,
          sellerFullNTN: invoiceData.sellerFullNTN?.trim() || null,
          sellerBusinessName: req.tenant?.seller_business_name || "",
          sellerProvince: req.tenant?.seller_province || "",
          sellerAddress: req.tenant?.seller_address || null,
          buyerNTNCNIC: invoiceData.buyerNTNCNIC?.trim() || null,
          buyerBusinessName: invoiceData.buyerBusinessName.trim(),
          buyerProvince: invoiceData.buyerProvince.trim(),
          buyerAddress: invoiceData.buyerAddress?.trim() || null,
          buyerRegistrationType:
            invoiceData.buyerRegistrationType?.trim() || null,
          invoiceRefNo: invoiceData.invoiceRefNo?.trim() || null,
          companyInvoiceRefNo: invoiceData.companyInvoiceRefNo?.trim() || null,
          internal_invoice_no: invoiceData.internalInvoiceNo?.trim() || null,
          transctypeId: null, // Will be set from items
          status: "draft",
          fbr_invoice_number: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Debug: Log the complete invoice record
        console.log(`🔍 Debug: Complete invoice record ${i + 1}:`, {
          invoice_number: invoiceRecord.invoice_number,
          system_invoice_id: invoiceRecord.system_invoice_id,
          sellerBusinessName: invoiceRecord.sellerBusinessName,
          sellerProvince: invoiceRecord.sellerProvince,
          buyerBusinessName: invoiceRecord.buyerBusinessName,
          buyerProvince: invoiceRecord.buyerProvince,
          hasCreatedAt: !!invoiceRecord.created_at,
          hasUpdatedAt: !!invoiceRecord.updated_at,
          created_at: invoiceRecord.created_at,
          updated_at: invoiceRecord.updated_at,
        });

        invoiceBatches.push(invoiceRecord);

        // Debug: Log the invoice record being added
        console.log(`🔍 Debug: Invoice record ${i + 1}:`, {
          hasCreatedAt: !!invoiceRecord.created_at,
          hasUpdatedAt: !!invoiceRecord.updated_at,
          created_at: invoiceRecord.created_at,
          updated_at: invoiceRecord.updated_at,
          invoice_number: invoiceRecord.invoice_number,
          system_invoice_id: invoiceRecord.system_invoice_id,
        });

        // Process items for this invoice
        console.log(
          `🔍 Debug: Processing invoice ${i + 1} with ${invoiceData.items.length} items`
        );

        let itemsProcessed = 0;
        for (let j = 0; j < invoiceData.items.length; j++) {
          const itemData = invoiceData.items[j];

          try {
            // Validate required item fields - be more lenient and provide defaults
            const hsCode = itemData.item_hsCode?.trim() || "000000";
            const rate = itemData.item_rate?.trim() || "17";

            // Debug: Log raw item data
            console.log(`🔍 Debug: Raw item ${j + 1} data:`, {
              item_hsCode: itemData.item_hsCode,
              item_rate: itemData.item_rate,
              item_productName: itemData.item_productName,
              name: itemData.name,
              productName: itemData.productName,
              hasHsCode: !!itemData.item_hsCode,
              hasRate: !!itemData.item_rate,
              hsCodeTrimmed: itemData.item_hsCode?.trim(),
              rateTrimmed: itemData.item_rate?.trim(),
              finalHsCode: hsCode,
              finalRate: rate,
            });

            // Only skip if we have absolutely no product information
            if (
              !itemData.item_productName?.trim() &&
              !itemData.name?.trim() &&
              !itemData.productName?.trim()
            ) {
              console.log(
                `⚠️ Skipping item ${j + 1} in invoice ${i + 1}: No product name`
              );
              continue;
            }

            // Debug: Log item data before mapping
            console.log("🔍 Bulk Upload Debug: Item data:", {
              item_productName: itemData.item_productName,
              name: itemData.name,
              productName: itemData.productName,
            });

            // Prepare item data for batch insert
            const itemRecord = {
              invoice_id: null, // Will be set after invoice creation
              hsCode: hsCode,
              name:
                itemData.item_productName?.trim() ||
                itemData.name?.trim() ||
                itemData.productName?.trim() ||
                "Product",
              productDescription:
                itemData.item_productDescription?.trim() || null,
              rate: rate,
              uoM: itemData.item_uoM?.trim() || null,
              quantity: parseFloat(itemData.item_quantity) || 0,
              unitPrice: parseFloat(itemData.item_unitPrice) || 0,
              totalValues: parseFloat(itemData.item_totalValues) || 0,
              valueSalesExcludingST:
                parseFloat(itemData.item_valueSalesExcludingST) || 0,
              // Force fixedNotifiedValueOrRetailPrice to 0 for Excel uploads
              fixedNotifiedValueOrRetailPrice: 0,
              salesTaxApplicable:
                parseFloat(itemData.item_salesTaxApplicable) || 0,
              salesTaxWithheldAtSource:
                parseFloat(itemData.item_salesTaxWithheldAtSource) || 0,
              extraTax:
                typeof itemData.item_extraTax === "string"
                  ? itemData.item_extraTax.trim()
                  : itemData.item_extraTax,
              furtherTax: parseFloat(itemData.item_furtherTax) || 0,
              sroScheduleNo: itemData.item_sroScheduleNo?.trim() || null,
              fedPayable: parseFloat(itemData.item_fedPayable) || 0,
              discount: parseFloat(itemData.item_discount) || 0,
              saleType:
                itemData.item_saleType?.trim() ||
                "Goods at standard rate (default)",
              sroItemSerialNo: itemData.item_sroItemSerialNo?.trim() || null,
              transctypeId: itemData.transctypeId?.trim() || null,
              created_at: new Date(),
              updated_at: new Date(),
            };

            // Debug: Log the final item record
            console.log("🔍 Bulk Upload Debug: Final item record:", {
              name: itemRecord.name,
              hsCode: itemRecord.hsCode,
              productDescription: itemRecord.productDescription,
            });

            invoiceItemBatches.push({
              ...itemRecord,
              _invoiceIndex: i, // Track which invoice this item belongs to
            });

            itemsProcessed++;
            console.log(
              `✅ Successfully processed item ${j + 1} for invoice ${i + 1}`
            );
          } catch (itemError) {
            console.error(
              `❌ Error processing item ${j + 1} in invoice ${i + 1}:`,
              itemError
            );
            console.error(`❌ Item data that failed:`, itemData);
            errors.push({
              index: i,
              row: i + 1,
              error: `Item processing error: ${itemError.message}`,
            });
          }
        }

        console.log(
          `📊 Invoice ${i + 1}: Processed ${itemsProcessed}/${invoiceData.items.length} items`
        );

        // Debug: Log the total items processed so far
        console.log(
          `🔍 Debug: Total invoiceItemBatches after invoice ${i + 1}: ${invoiceItemBatches.length}`
        );
        if (invoiceItemBatches.length > 0) {
          console.log(`🔍 Debug: Sample item:`, {
            _invoiceIndex:
              invoiceItemBatches[invoiceItemBatches.length - 1]._invoiceIndex,
            name: invoiceItemBatches[invoiceItemBatches.length - 1].name,
            hsCode: invoiceItemBatches[invoiceItemBatches.length - 1].hsCode,
          });
        }
      } catch (error) {
        console.error(`Error processing invoice ${i}:`, error);
        errors.push({
          index: i,
          row: i + 1,
          error: `Processing error: ${error.message}`,
        });
      }
    }

    console.log(
      `📈 Processed ${invoices.length}/${invoices.length} grouped invoices...`
    );
    const processingTime =
      Number(process.hrtime.bigint() - processingStart) / 1000000;
    console.log(
      `⚡ Data processing completed in ${processingTime.toFixed(2)}ms`
    );

    // Debug: Log what we have after processing
    console.log(
      `🔍 Debug: After processing - invoiceBatches: ${invoiceBatches.length}, invoiceItemBatches: ${invoiceItemBatches.length}, newBuyers: ${newBuyers.length}, errors: ${errors.length}`
    );

    if (invoiceBatches.length === 0) {
      console.log(
        `⚠️ No invoices to process after validation. Errors:`,
        errors
      );
      return res.status(400).json({
        success: false,
        message: "No valid invoices found after validation",
        data: {
          created: [],
          errors: errors,
          warnings: warnings,
          summary: {
            total: invoices.length,
            successful: 0,
            failed: errors.length,
            warnings: warnings.length,
          },
        },
      });
    }

    // PHASE 3: Chunked Database Operations
    const dbStart = process.hrtime.bigint();

    // Split data into chunks for processing
    const invoiceChunks = [];
    const itemChunks = [];

    for (let i = 0; i < invoiceBatches.length; i += chunkSize) {
      const chunk = invoiceBatches.slice(i, i + chunkSize);
      console.log(
        `🔍 Debug: Creating chunk ${invoiceChunks.length + 1} with ${chunk.length} invoices`
      );
      console.log(`🔍 Debug: First invoice in chunk:`, {
        hasCreatedAt: !!chunk[0]?.created_at,
        hasUpdatedAt: !!chunk[0]?.updated_at,
        invoiceKeys: chunk[0] ? Object.keys(chunk[0]) : [],
      });
      invoiceChunks.push(chunk);
    }

    for (let i = 0; i < invoiceItemBatches.length; i += chunkSize * 10) {
      // Items are typically 10x more than invoices
      itemChunks.push(invoiceItemBatches.slice(i, i + chunkSize * 10));
    }

    console.log(
      `📦 Processing ${invoiceChunks.length} chunks of invoices and ${itemChunks.length} chunks of items`
    );
    console.log(
      `🔍 Debug: Total items to process: ${invoiceItemBatches.length}`
    );
    console.log(`🔍 Debug: Item chunks created: ${itemChunks.length}`);
    if (itemChunks.length > 0) {
      console.log(`🔍 Debug: First item chunk size: ${itemChunks[0].length}`);
    }

    // Validate data lengths before database operations
    console.log("🔍 Validating data lengths...");
    let maxSystemIdLength = 0;
    let maxInvoiceNumberLength = 0;

    for (let i = 0; i < invoiceBatches.length; i++) {
      const invoice = invoiceBatches[i];

      // Debug: Log invoice validation
      console.log(`🔍 Debug: Validating invoice ${i + 1}:`, {
        hasCreatedAt: !!invoice.created_at,
        hasUpdatedAt: !!invoice.updated_at,
        system_invoice_id: invoice.system_invoice_id,
        invoice_number: invoice.invoice_number,
        buyerBusinessName: invoice.buyerBusinessName,
        buyerProvince: invoice.buyerProvince,
      });

      // Track maximum lengths for debugging
      maxSystemIdLength = Math.max(
        maxSystemIdLength,
        invoice.system_invoice_id.length
      );
      maxInvoiceNumberLength = Math.max(
        maxInvoiceNumberLength,
        invoice.invoice_number.length
      );

      // Check system_invoice_id length (max 20 chars)
      if (invoice.system_invoice_id.length > 20) {
        throw new Error(
          `system_invoice_id too long at row ${i + 1}: "${invoice.system_invoice_id}" (${invoice.system_invoice_id.length} chars, max 20)`
        );
      }

      // Check invoice_number length (max 100 chars)
      if (invoice.invoice_number.length > 100) {
        throw new Error(
          `invoice_number too long at row ${i + 1}: "${invoice.invoice_number}" (${invoice.invoice_number.length} chars, max 100)`
        );
      }

      // Check other string fields
      if (invoice.buyerBusinessName && invoice.buyerBusinessName.length > 255) {
        throw new Error(
          `buyerBusinessName too long at row ${i + 1}: ${invoice.buyerBusinessName.length} chars, max 255`
        );
      }

      if (invoice.buyerProvince && invoice.buyerProvince.length > 100) {
        throw new Error(
          `buyerProvince too long at row ${i + 1}: ${invoice.buyerProvince.length} chars, max 100`
        );
      }
    }

    console.log(
      `✅ Validation passed - Max lengths: system_invoice_id=${maxSystemIdLength}, invoice_number=${maxInvoiceNumberLength}`
    );

    // Process chunks with memory management
    const processId = `bulk_upload_${Date.now()}`;
    MemoryManagementService.registerProcess(processId, {
      totalInvoices: invoices.length,
      totalChunks: invoiceChunks.length,
      chunkSize: chunkSize,
    });

    // SIMPLIFIED: Process all invoices in a single transaction like regular uploads
    console.log(
      `🚀 Processing ${invoiceBatches.length} invoices in a single transaction...`
    );

    const allCreatedInvoices = await sequelize.transaction(async (t) => {
      // Create new buyers if any
      if (newBuyers.length > 0) {
        console.log(`🔄 Creating ${newBuyers.length} new buyers...`);
        try {
          await Buyer.bulkCreate(newBuyers, {
            transaction: t,
            ignoreDuplicates: true,
            validate: false,
          });
        } catch (buyerError) {
          console.error("❌ Buyer creation failed:", buyerError);
          throw new Error(`Failed to create buyers: ${buyerError.message}`);
        }
      }

      // OPTIMIZED: Bulk create all invoices at once
      console.log(`🔄 Bulk creating ${invoiceBatches.length} invoices...`);

      // Ensure timestamps are set for all invoices
      const now = new Date();
      const validInvoices = invoiceBatches.map((invoice) => ({
        ...invoice,
        created_at: invoice.created_at || now,
        updated_at: invoice.updated_at || now,
      }));

      let createdInvoices;
      try {
        createdInvoices = await Invoice.bulkCreate(validInvoices, {
          transaction: t,
          validate: false,
          ignoreDuplicates: true,
          returning: true, // Get the created records with IDs
        });
      } catch (createError) {
        console.error("❌ Invoice bulk create failed:", createError);
        throw new Error(`Invoice bulk create failed: ${createError.message}`);
      }

      console.log(`✅ Successfully created ${createdInvoices.length} invoices`);

      // OPTIMIZED: Bulk create all invoice items at once
      if (invoiceItemBatches.length > 0) {
        console.log(
          `🔄 Bulk creating ${invoiceItemBatches.length} invoice items...`
        );

        // Map items to their corresponding invoice IDs
        const itemsWithInvoiceIds = invoiceItemBatches
          .map((item) => {
            const invoiceIndex = item._invoiceIndex;
            const correspondingInvoice = createdInvoices[invoiceIndex];

            if (!correspondingInvoice) {
              console.warn(
                `⚠️ No corresponding invoice found for item at index ${item._invoiceIndex}`
              );
              return null;
            }

            const itemRecord = {
              ...item,
              invoice_id: correspondingInvoice.id,
            };
            // Remove the _invoiceIndex field as it's not needed in the database
            delete itemRecord._invoiceIndex;
            return itemRecord;
          })
          .filter((item) => item !== null);

        console.log(
          `🔍 Prepared ${itemsWithInvoiceIds.length} items for bulk insertion`
        );

        if (itemsWithInvoiceIds.length > 0) {
          try {
            await InvoiceItem.bulkCreate(itemsWithInvoiceIds, {
              transaction: t,
              validate: false,
              ignoreDuplicates: true,
            });
            console.log(
              `✅ Successfully created ${itemsWithInvoiceIds.length} items`
            );
          } catch (itemError) {
            console.error("❌ Invoice items bulk create failed:", itemError);
            throw new Error(
              `Failed to create invoice items: ${itemError.message}`
            );
          }
        }
      } else {
        console.log(`⚠️ No items found`);
      }

      return createdInvoices;
    });

    // Process results (now it's a single array of invoices, not batches)
    const totalInvoicesCreated = allCreatedInvoices
      ? allCreatedInvoices.length
      : 0;

    MemoryManagementService.completeProcess(processId);

    // Database settings are automatically restored when connection is released
    console.log("✅ Database operations completed successfully");

    const dbTime = Number(process.hrtime.bigint() - dbStart) / 1000000;
    console.log(`⚡ Database operations completed in ${dbTime.toFixed(2)}ms`);

    // PHASE 4: Response Preparation
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;

    // Record performance metrics
    PerformanceOptimizationService.recordPerformanceMetric(
      "bulk_upload",
      totalTime,
      {
        invoiceCount: allCreatedInvoices.length,
        chunkCount: invoiceChunks.length,
        chunkSize: chunkSize,
        errorCount: errors.length,
        warningCount: warnings.length,
      }
    );

    console.log(`🎉 Bulk upload completed in ${totalTime.toFixed(2)}ms!`);
    console.log(
      `📊 Summary: ${totalInvoicesCreated} invoices created, ${errors.length} errors, ${warnings.length} warnings`
    );

    // Log detailed error information
    if (errors.length > 0) {
      console.log(`❌ Detailed errors:`);
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. Row ${error.row}: ${error.error}`);
      });
    }

    // Get memory usage statistics
    const memoryUsage = MemoryManagementService.getMemoryUsage();
    console.log(
      `💾 Memory usage: ${memoryUsage.heapUsed}MB heap, ${memoryUsage.activeProcesses} active processes`
    );

    res.status(200).json({
      success: true,
      message: `Bulk upload completed in ${totalTime.toFixed(2)}ms! ${totalInvoicesCreated} grouped invoices created as drafts.`,
      data: {
        created: allCreatedInvoices,
        errors: errors,
        warnings: warnings,
        summary: {
          total: invoices.length,
          successful: totalInvoicesCreated,
          failed: errors.length,
          warnings: warnings.length,
          processingTimeMs: processingTime.toFixed(2),
          databaseTimeMs: dbTime.toFixed(2),
          totalTimeMs: totalTime.toFixed(2),
        },
        performance: {
          invoicesPerSecond: (
            totalInvoicesCreated /
            (totalTime / 1000)
          ).toFixed(2),
          averageTimePerInvoice: (totalTime / totalInvoicesCreated).toFixed(4),
        },
        memory: {
          heapUsedMB: memoryUsage.heapUsed,
          heapTotalMB: memoryUsage.heapTotal,
          activeProcesses: memoryUsage.activeProcesses,
        },
      },
    });
  } catch (error) {
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    console.error(
      `❌ Bulk upload failed after ${totalTime.toFixed(2)}ms:`,
      error
    );

    res.status(500).json({
      success: false,
      message: `Bulk upload failed after ${totalTime.toFixed(2)}ms`,
      error: error.message,
      performance: {
        timeToFailure: totalTime.toFixed(2),
      },
    });
  }
};

// Check existing invoices for preview

export const checkExistingInvoices = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;

    const { invoices } = req.body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({
        success: false,

        message: "Invoices array is required and must not be empty",
      });
    }

    const existing = [];

    const newInvoices = [];

    for (let i = 0; i < invoices.length; i++) {
      const invoiceData = invoices[i];

      // Since invoice numbers will be generated by the system, all invoices are treated as new

      newInvoices.push({
        row: i + 1,

        invoiceData: invoiceData,
      });
    }

    res.status(200).json({
      success: true,

      data: {
        existing: existing,

        new: newInvoices,
      },
    });
  } catch (error) {
    console.error("Error checking existing invoices:", error);

    res.status(500).json({
      success: false,

      message: "Error checking existing invoices",

      error: error.message,
    });
  }
};

// Dashboard summary with monthly overview and recent invoices

export const getDashboardSummary = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;

    const sequelize = req.tenantDb;

    const { Sequelize } = sequelize;

    const { Op } = Sequelize;

    // Default to last 12 months

    const endDate = req.query.end_date
      ? new Date(req.query.end_date)
      : new Date();

    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : new Date(new Date(endDate).setMonth(endDate.getMonth() - 11, 1));

    const whereDateRange = {
      created_at: { [Op.between]: [startDate, endDate] },
    };

    // Key metrics

    const [totalCreated, totalDrafts, totalPosted, totalAmount] =
      await Promise.all([
        Invoice.count({ where: whereDateRange }),

        Invoice.count({ where: { ...whereDateRange, status: "draft" } }),

        Invoice.count({ where: { ...whereDateRange, status: "posted" } }),

        InvoiceItem.sum("totalValues", { where: whereDateRange }).then(
          (v) => v || 0
        ),
      ]);

    // Monthly overview: counts by month for posted and saved

    const monthlyRows = await Invoice.findAll({
      attributes: [
        [
          Sequelize.fn("DATE_FORMAT", Sequelize.col("created_at"), "%Y-%m"),

          "month",
        ],

        [
          Sequelize.literal(
            "SUM(CASE WHEN status IN ('posted', 'submitted') THEN 1 ELSE 0 END)"
          ),

          "posted",
        ],

        [
          Sequelize.literal(
            "SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END)"
          ),

          "draft",
        ],

        [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
      ],

      where: whereDateRange,

      group: [
        Sequelize.fn("DATE_FORMAT", Sequelize.col("created_at"), "%Y-%m"),
      ],

      order: [
        [
          Sequelize.fn("DATE_FORMAT", Sequelize.col("created_at"), "%Y-%m"),

          "ASC",
        ],
      ],
    });

    const monthlyOverview = monthlyRows.map((row) => {
      const plain = row.get({ plain: true });

      return {
        month: plain.month,

        posted: Number(plain.posted || 0),

        saved: Number(plain.saved || 0),

        total: Number(plain.total || 0),
      };
    });

    // Recent invoices with aggregated amount

    const recentInvoicesRaw = await Invoice.findAll({
      attributes: [
        "id",

        ["invoice_number", "invoiceNumber"],

        "status",

        "created_at",

        [
          Sequelize.fn("SUM", Sequelize.col("InvoiceItems.totalValues")),

          "amount",
        ],
      ],

      include: [{ model: InvoiceItem, as: "InvoiceItems", attributes: [] }],

      group: ["Invoice.id"],

      order: [["created_at", "DESC"]],

      limit: 10,

      subQuery: false,
    });

    const recentInvoices = recentInvoicesRaw.map((row) => {
      const plain = row.get({ plain: true });

      return {
        id: plain.id,

        invoiceNumber: plain.invoiceNumber,

        date: plain.created_at,

        amount: Number(plain.amount || 0),

        status: plain.status,

        postedToFBR: plain.status === "posted" || plain.status === "submitted",
      };
    });

    res.status(200).json({
      success: true,

      data: {
        metrics: {
          total_invoices_created: totalCreated,

          total_invoices_draft: totalDrafts,

          total_posted_to_fbr: totalPosted,

          total_invoice_amount: Number(totalAmount || 0),
        },

        monthly_overview: monthlyOverview,

        recent_invoices: recentInvoices,
      },
    });
  } catch (error) {
    console.error("Error getting dashboard summary:", error);

    res.status(500).json({
      success: false,

      message: "Error retrieving dashboard summary",

      error: error.message,
    });
  }
};

// Get document types from FBR

export const getDocumentTypesController = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { environment = "sandbox" } = req.query;

    // Get token from request headers

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,

        message: "Authorization token required",
      });
    }

    console.log(
      `Fetching document types for tenant: ${tenantId}, environment: ${environment}`
    );

    // Get tenant data to check FBR credentials

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,

        message: "Tenant not found",
      });
    }

    // Check if tenant has FBR credentials

    if (!tenant.sandboxProductionToken) {
      return res.status(400).json({
        success: false,

        message: "FBR credentials not found for this tenant",
      });
    }

    // Call FBR service to get document types

    const documentTypes = await getDocumentTypes(environment, token);

    res.json({
      success: true,

      message: "Document types fetched successfully",

      data: documentTypes,
    });
  } catch (error) {
    console.error("Error fetching document types:", error);

    // Handle specific error cases

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,

        message: "FBR authentication failed. Please check your credentials.",
      });
    } else if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,

        message: "Document types API endpoint not found.",
      });
    } else if (error.response?.status === 500) {
      return res.status(503).json({
        success: false,

        message:
          "FBR system is temporarily unavailable. Please try again later.",
      });
    } else if (error.code === "ECONNABORTED") {
      return res.status(408).json({
        success: false,

        message: "Request timeout. FBR system may be slow. Please try again.",
      });
    } else if (error.code === "ERR_NETWORK") {
      return res.status(503).json({
        success: false,

        message: "Network error. Please check your connection and try again.",
      });
    } else {
      return res.status(500).json({
        success: false,

        message:
          error.message || "Unable to fetch document types from FBR API.",
      });
    }
  }
};

// Get provinces from FBR

export const getProvincesController = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { environment = "sandbox" } = req.query;

    // Get token from request headers

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,

        message: "Authorization token required",
      });
    }

    console.log(
      `Fetching provinces for tenant: ${tenantId}, environment: ${environment}`
    );

    // Get tenant data to check FBR credentials

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,

        message: "Tenant not found",
      });
    }

    // Check if tenant has FBR credentials

    if (!tenant.sandboxProductionToken) {
      return res.status(400).json({
        success: false,

        message: "FBR credentials not found for this tenant",
      });
    }

    // Call FBR service to get provinces

    const provinces = await getProvinces(environment, token);

    res.json({
      success: true,

      message: "Provinces fetched successfully",

      data: provinces,
    });
  } catch (error) {
    console.error("Error fetching provinces:", error);

    // Handle specific error cases

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,

        message: "FBR authentication failed. Please check your credentials.",
      });
    } else if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,

        message: "Provinces API endpoint not found.",
      });
    } else if (error.response?.status === 500) {
      return res.status(503).json({
        success: false,

        message:
          "FBR system is temporarily unavailable. Please try again later.",
      });
    } else if (error.code === "ECONNABORTED") {
      return res.status(408).json({
        success: false,

        message: "Request timeout. FBR system may be slow. Please try again.",
      });
    } else if (error.code === "ERR_NETWORK") {
      return res.status(503).json({
        success: false,

        message: "Network error. Please check your connection and try again.",
      });
    } else {
      return res.status(500).json({
        success: false,

        message: error.message || "Unable to fetch provinces from FBR API.",
      });
    }
  }
};

// Validate invoice data with FBR

export const validateInvoiceDataController = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { environment = "sandbox" } = req.query;

    const invoiceData = req.body;

    // Get token from request headers

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,

        message: "Authorization token required",
      });
    }

    console.log(
      `Validating invoice data for tenant: ${tenantId}, environment: ${environment}`
    );

    // Get tenant data to check FBR credentials

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,

        message: "Tenant not found",
      });
    }

    // Check if tenant has FBR credentials

    if (!tenant.sandboxProductionToken) {
      return res.status(400).json({
        success: false,

        message: "FBR credentials not found for this tenant",
      });
    }

    // Call FBR service to validate invoice data

    const validationResult = await validateInvoiceData(
      invoiceData,

      environment,

      token
    );

    res.json({
      success: true,

      message: "Invoice data validated successfully",

      data: validationResult,
    });
  } catch (error) {
    console.error("Error validating invoice data:", error);

    // Handle specific error cases

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,

        message: "FBR authentication failed. Please check your credentials.",
      });
    } else if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,

        message: "Invalid invoice data provided.",

        data: error.response?.data,
      });
    } else if (error.response?.status === 500) {
      return res.status(503).json({
        success: false,

        message:
          "FBR system is temporarily unavailable. Please try again later.",
      });
    } else if (error.code === "ECONNABORTED") {
      return res.status(408).json({
        success: false,

        message: "Request timeout. FBR system may be slow. Please try again.",
      });
    } else if (error.code === "ERR_NETWORK") {
      return res.status(503).json({
        success: false,

        message: "Network error. Please check your connection and try again.",
      });
    } else {
      return res.status(500).json({
        success: false,

        message:
          error.message || "Unable to validate invoice data with FBR API.",
      });
    }
  }
};

// Submit invoice data to FBR

export const submitInvoiceDataController = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { environment = "sandbox" } = req.query;

    const invoiceData = req.body;

    // Get token from request headers

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,

        message: "Authorization token required",
      });
    }

    console.log(
      `Submitting invoice data for tenant: ${tenantId}, environment: ${environment}`
    );

    // Get tenant data to check FBR credentials

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,

        message: "Tenant not found",
      });
    }

    // Check if tenant has FBR credentials

    if (!tenant.sandboxProductionToken) {
      return res.status(400).json({
        success: false,

        message: "FBR credentials not found for this tenant",
      });
    }

    // Call FBR service to submit invoice data

    const submissionResult = await submitInvoiceData(
      invoiceData,

      environment,

      token
    );

    res.json({
      success: true,

      message: "Invoice data submitted successfully",

      data: submissionResult,
    });
  } catch (error) {
    console.error("Error submitting invoice data:", error);

    // Handle specific error cases

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,

        message: "FBR authentication failed. Please check your credentials.",
      });
    } else if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,

        message: "Invalid invoice data provided.",

        data: error.response?.data,
      });
    } else if (error.response?.status === 500) {
      return res.status(503).json({
        success: false,

        message:
          "FBR system is temporarily unavailable. Please try again later.",
      });
    } else if (error.code === "ECONNABORTED") {
      return res.status(408).json({
        success: false,

        message: "Request timeout. FBR system may be slow. Please try again.",
      });
    } else if (error.code === "ERR_NETWORK") {
      return res.status(503).json({
        success: false,

        message: "Network error. Please check your connection and try again.",
      });
    } else {
      return res.status(500).json({
        success: false,

        message: error.message || "Unable to submit invoice data to FBR API.",
      });
    }
  }
};

export const downloadInvoiceTemplateExcel = async (req, res) => {
  try {
    // Dynamically import exceljs to avoid loading cost if unused

    const ExcelJS = (await import("exceljs")).default;

    const { fetchData } = await import("../../service/FBRService.js");

    // Token is optional for template generation; prefer sandbox, then production

    const token =
      req.tenant?.sandboxTestToken ||
      req.tenant?.sandboxProductionToken ||
      null;

    // Fetch provinces to map seller province to code (optional)

    let provinceMap = {};

    let provinceCode = undefined;

    try {
      if (token) {
        const provinces = await fetchData("pdi/v1/provinces", "sandbox", token);

        provinceMap = Array.isArray(provinces)
          ? provinces.reduce((acc, p) => {
              const desc =
                p.stateProvinceDesc || p.STATEPROVINCEDESC || p.desc || "";

              const code =
                p.stateProvinceCode || p.STATEPROVINCECODE || p.code || "";

              if (desc && code) acc[desc.toUpperCase()] = code;

              return acc;
            }, {})
          : {};

        const tenantProvince = (
          req.tenant?.seller_province || ""
        ).toUpperCase();

        provinceCode = provinceMap[tenantProvince];
      }
    } catch (e) {
      provinceMap = {};

      provinceCode = undefined;
    }

    // Fallback: if provinces couldn't be fetched, seed with a default set for dropdowns

    if (!provinceMap || Object.keys(provinceMap).length === 0) {
      const defaultProvinceNames = [
        "BALOCHISTAN",

        "AZAD JAMMU AND KASHMIR",

        "CAPITAL TERRITORY",

        "PUNJAB",

        "KHYBER PAKHTUNKHWA",

        "GILGIT BALTISTAN",

        "SINDH",
      ];

      provinceMap = defaultProvinceNames.reduce((acc, name) => {
        // We don't have province codes without FBR API; use name as placeholder

        acc[name] = name;

        return acc;
      }, {});

      // provinceCode remains undefined; rate fetching will gracefully skip
    }

    // Fetch transaction types (optional). If not available, use a safe placeholder

    let transactionTypes = [];

    try {
      if (token) {
        const transTypesRaw = await fetchData(
          "pdi/v1/transtypecode",

          "sandbox",

          token
        );

        const mappedTypes = (Array.isArray(transTypesRaw) ? transTypesRaw : [])

          .map((t) => {
            // Support various possible key casings/aliases from FBR API

            const id =
              t.transTypeId ||
              t.TRANSTYPEID ||
              t.tranTypeId ||
              t.id ||
              t.transactionTypeId ||
              t.transaction_type_id ||
              t.transactionTypeID ||
              t.transactioN_TYPE_ID ||
              t.TRANSACTION_TYPE_ID;

            const desc =
              t.transTypeDesc ||
              t.TRANSTYPEDESC ||
              t.transactionDesc ||
              t.desc ||
              t.description ||
              t.transactioN_DESC ||
              t.TRANSACTION_DESC;

            return id ? { id: String(id), desc: desc || String(id) } : null;
          })

          .filter(Boolean);

        // Deduplicate by id to avoid conflicting lists/named references

        const uniqueById = new Map();

        for (const tt of mappedTypes) {
          if (!uniqueById.has(tt.id)) uniqueById.set(tt.id, tt);
        }

        transactionTypes = Array.from(uniqueById.values());
      }
    } catch (e) {
      transactionTypes = [];
    }

    if (transactionTypes.length === 0) {
      transactionTypes = [{ id: "0", desc: "Select" }];
    }

    // Ensure all hardcoded transaction types are included for comprehensive rate coverage
    // This ensures that all rates from the API and hardcoded data are available in the Excel dropdown
    try {
      const { TRANSACTION_TYPE_RATES } = await import(
        "../../../frontend/src/utils/hardcodedRates.js"
      );
      const hardcodedTransactionTypeIds = Object.keys(TRANSACTION_TYPE_RATES);

      // Add any missing transaction types from hardcoded data
      hardcodedTransactionTypeIds.forEach((typeId) => {
        const existingType = transactionTypes.find((tt) => tt.id === typeId);
        if (!existingType) {
          // Add the missing transaction type with a generic description
          transactionTypes.push({
            id: typeId,
            desc: `Transaction Type ${typeId}`,
          });
        }
      });

      console.log(
        `Added ${hardcodedTransactionTypeIds.length} hardcoded transaction types to ensure comprehensive rate coverage`
      );
    } catch (fallbackError) {
      console.warn(
        "Could not load hardcoded transaction types:",
        fallbackError
      );
    }

    // Fetch rates per transaction type; aggregate across province codes if needed

    // Also keep id+desc mapping to enable SRO lookup by rate id

    const ratesByType = {};

    const rateIdDescPairsByType = {};

    if (token) {
      const candidateProvinceCodes = [];

      if (provinceCode) {
        candidateProvinceCodes.push(provinceCode);
      } else if (provinceMap && Object.keys(provinceMap).length > 0) {
        const uniqueCodes = new Set(
          Object.values(provinceMap)

            .map((v) => (v == null ? null : String(v)))

            .filter((v) => v && v.length > 0)
        );

        candidateProvinceCodes.push(...uniqueCodes);
      }

      for (const tt of transactionTypes) {
        const aggregated = new Set();

        if (candidateProvinceCodes.length === 0) {
          // No province codes available; we'll try a fallback call without province below
        }

        for (const code of candidateProvinceCodes) {
          try {
            const ratesRaw = await fetchData(
              `pdi/v2/SaleTypeToRate?date=24-Feb-2024&transTypeId=${encodeURIComponent(
                tt.id
              )}&originationSupplier=${encodeURIComponent(code)}`,

              "sandbox",

              token
            );

            const parsedRates = (Array.isArray(ratesRaw) ? ratesRaw : [])

              .map((r) => {
                const rateDesc =
                  r.ratE_DESC ||
                  r.raTE_DESC ||
                  r.rateDesc ||
                  r.RATE_DESC ||
                  r.rATEDESC ||
                  r.desc ||
                  null;

                const rateId =
                  r.ratE_ID ||
                  r.raTE_ID ||
                  r.rateId ||
                  r.RATE_ID ||
                  r.id ||
                  null;

                return rateDesc
                  ? {
                      id: rateId ? String(rateId) : null,

                      desc: String(rateDesc).trim(),
                    }
                  : null;
              })

              .filter(Boolean);

            // Add ALL rates from this API call to the aggregated set
            parsedRates.forEach((rate) => {
              if (rate && rate.desc) {
                aggregated.add(rate.desc);
              }
            });

            // Store id+desc pairs per type

            if (!rateIdDescPairsByType[tt.id])
              rateIdDescPairsByType[tt.id] = new Map();

            for (const pr of parsedRates) {
              if (!rateIdDescPairsByType[tt.id].has(pr.desc) && pr.id) {
                rateIdDescPairsByType[tt.id].set(pr.desc, pr.id);
              }
            }
          } catch (e) {
            // Try next province code
          }
        }

        // Fallback: if still empty, try without province filter (broad fetch)

        if (aggregated.size === 0) {
          try {
            const ratesRawNoProv = await fetchData(
              `pdi/v2/SaleTypeToRate?date=24-Feb-2024&transTypeId=${encodeURIComponent(
                tt.id
              )}`,

              "sandbox",

              token
            );

            const parsedRatesNoProv = (
              Array.isArray(ratesRawNoProv) ? ratesRawNoProv : []
            )

              .map((r) => {
                const rateDesc =
                  r.ratE_DESC ||
                  r.raTE_DESC ||
                  r.rateDesc ||
                  r.RATE_DESC ||
                  r.rATEDESC ||
                  r.desc ||
                  null;

                const rateId =
                  r.ratE_ID ||
                  r.raTE_ID ||
                  r.rateId ||
                  r.RATE_ID ||
                  r.id ||
                  null;

                return rateDesc
                  ? {
                      id: rateId ? String(rateId) : null,

                      desc: String(rateDesc).trim(),
                    }
                  : null;
              })

              .filter(Boolean);

            // Add ALL rates from this fallback API call to the aggregated set
            parsedRatesNoProv.forEach((rate) => {
              if (rate && rate.desc) {
                aggregated.add(rate.desc);
              }
            });

            if (!rateIdDescPairsByType[tt.id])
              rateIdDescPairsByType[tt.id] = new Map();

            for (const pr of parsedRatesNoProv) {
              if (!rateIdDescPairsByType[tt.id].has(pr.desc) && pr.id) {
                rateIdDescPairsByType[tt.id].set(pr.desc, pr.id);
              }
            }
          } catch (e) {
            // ignore
          }
        }

        ratesByType[tt.id] = Array.from(aggregated);

        // If no rates found from API, try to include hardcoded rates as fallback
        if (ratesByType[tt.id].length === 0) {
          try {
            // Import hardcoded rates as fallback
            const { TRANSACTION_TYPE_RATES } = await import(
              "../../../frontend/src/utils/hardcodedRates.js"
            );
            const hardcodedRates = TRANSACTION_TYPE_RATES[tt.id];
            if (hardcodedRates && Array.isArray(hardcodedRates)) {
              const hardcodedRateDescs = hardcodedRates
                .map((rate) => rate.ratE_DESC)
                .filter(Boolean);
              ratesByType[tt.id] = hardcodedRateDescs;

              // Also add to rate mapping
              if (!rateIdDescPairsByType[tt.id]) {
                rateIdDescPairsByType[tt.id] = new Map();
              }
              hardcodedRates.forEach((rate) => {
                if (rate.ratE_DESC && rate.ratE_ID) {
                  rateIdDescPairsByType[tt.id].set(
                    rate.ratE_DESC,
                    String(rate.ratE_ID)
                  );
                }
              });
            }
          } catch (fallbackError) {
            console.warn(
              `Could not load hardcoded rates for transaction type ${tt.id}:`,
              fallbackError
            );
          }
        }
      }
    } else {
      // Provide fallback rates for all transaction types if we cannot fetch from API
      try {
        // Import hardcoded rates as comprehensive fallback
        const { TRANSACTION_TYPE_RATES } = await import(
          "../../../frontend/src/utils/hardcodedRates.js"
        );

        for (const tt of transactionTypes) {
          const hardcodedRates = TRANSACTION_TYPE_RATES[tt.id];
          if (hardcodedRates && Array.isArray(hardcodedRates)) {
            const hardcodedRateDescs = hardcodedRates
              .map((rate) => rate.ratE_DESC)
              .filter(Boolean);
            ratesByType[tt.id] = hardcodedRateDescs;

            // Also add to rate mapping
            rateIdDescPairsByType[tt.id] = new Map();
            hardcodedRates.forEach((rate) => {
              if (rate.ratE_DESC && rate.ratE_ID) {
                rateIdDescPairsByType[tt.id].set(
                  rate.ratE_DESC,
                  String(rate.ratE_ID)
                );
              }
            });
          } else {
            ratesByType[tt.id] = [];
            rateIdDescPairsByType[tt.id] = new Map();
          }
        }
      } catch (fallbackError) {
        console.warn(
          "Could not load hardcoded rates as fallback:",
          fallbackError
        );

        // Final fallback: empty rates
        for (const tt of transactionTypes) {
          ratesByType[tt.id] = [];
          rateIdDescPairsByType[tt.id] = new Map();
        }
      }
    }

    // Build unified map of rate desc -> rate id (best-effort across all transaction types)

    const rateDescToId = new Map();

    for (const tt of transactionTypes) {
      const pairs = rateIdDescPairsByType[tt.id] || new Map();

      for (const [desc, id] of pairs.entries()) {
        if (desc && id && !rateDescToId.has(desc)) rateDescToId.set(desc, id);
      }
    }

    // Fetch SRO schedules per rate id (aggregate across province codes) and create comprehensive SRO list

    const sroByRateId = {};
    const allUniqueSROs = new Set(); // Track all unique SRO Schedule Numbers

    if (token && rateDescToId.size > 0) {
      const candidateProvinceCodes = [];

      if (provinceCode) {
        candidateProvinceCodes.push(provinceCode);
      } else if (provinceMap && Object.keys(provinceMap).length > 0) {
        const uniqueCodes = new Set(
          Object.values(provinceMap)

            .map((v) => (v == null ? null : String(v)))

            .filter((v) => v && v.length > 0)
        );

        candidateProvinceCodes.push(...uniqueCodes);
      }

      console.log(
        `Fetching SRO Schedule data for ${rateDescToId.size} rate IDs across ${candidateProvinceCodes.length} province codes...`
      );

      for (const id of new Set(Array.from(rateDescToId.values()))) {
        const aggregated = new Map(); // desc -> id

        for (const code of candidateProvinceCodes) {
          try {
            const sroRaw = await fetchData(
              `pdi/v1/SroSchedule?rate_id=${encodeURIComponent(id)}&date=04-Feb-2024&origination_supplier_csv=${encodeURIComponent(
                code
              )}`,

              "sandbox",

              token
            );

            const items = (Array.isArray(sroRaw) ? sroRaw : [])

              .map((s) => {
                const sroDesc = s.srO_DESC || s.SRO_DESC || s.desc || null;

                const sroId = s.srO_ID || s.SRO_ID || s.id || null;

                return sroDesc && sroId
                  ? { id: String(sroId), desc: String(sroDesc).trim() }
                  : null;
              })

              .filter(Boolean);

            for (const it of items) {
              if (!aggregated.has(it.desc)) aggregated.set(it.desc, it.id);

              // Add all SRO descriptions to the comprehensive set
              if (it.desc) {
                allUniqueSROs.add(it.desc);
              }
            }
          } catch (e) {
            // continue
          }
        }

        sroByRateId[id] = aggregated; // Map(desc -> id)
      }

      console.log(
        `Collected ${allUniqueSROs.size} unique SRO Schedule Numbers from API`
      );
    }

    // Add fallback SRO Schedule data for comprehensive coverage
    const fallbackSROData = [
      "SRO.1125(I)/2011",
      "SRO.1126(I)/2011",
      "SRO.1127(I)/2011",
      "SRO.1128(I)/2011",
      "SRO.1129(I)/2011",
      "SRO.1130(I)/2011",
      "SRO.1131(I)/2011",
      "SRO.1132(I)/2011",
      "SRO.1133(I)/2011",
      "SRO.1134(I)/2011",
      "SRO.1135(I)/2011",
      "SRO.1136(I)/2011",
      "SRO.1137(I)/2011",
      "SRO.1138(I)/2011",
      "SRO.1139(I)/2011",
      "SRO.1140(I)/2011",
      "SRO.1141(I)/2011",
      "SRO.1142(I)/2011",
      "SRO.1143(I)/2011",
      "SRO.1144(I)/2011",
      "SRO.1145(I)/2011",
      "SRO.1146(I)/2011",
      "SRO.1147(I)/2011",
      "SRO.1148(I)/2011",
      "SRO.1149(I)/2011",
      "SRO.1150(I)/2011",
      "SRO.1151(I)/2011",
      "SRO.1152(I)/2011",
      "SRO.1153(I)/2011",
      "SRO.1154(I)/2011",
      "SRO.1155(I)/2011",
      "SRO.1156(I)/2011",
      "SRO.1157(I)/2011",
      "SRO.1158(I)/2011",
      "SRO.1159(I)/2011",
      "SRO.1160(I)/2011",
      "SRO.1161(I)/2011",
      "SRO.1162(I)/2011",
      "SRO.1163(I)/2011",
      "SRO.1164(I)/2011",
      "SRO.1165(I)/2011",
      "SRO.1166(I)/2011",
      "SRO.1167(I)/2011",
      "SRO.1168(I)/2011",
      "SRO.1169(I)/2011",
      "SRO.1170(I)/2011",
      "SRO.1171(I)/2011",
      "SRO.1172(I)/2011",
      "SRO.1173(I)/2011",
      "SRO.1174(I)/2011",
      "SRO.1175(I)/2011",
      "SRO.1176(I)/2011",
      "SRO.1177(I)/2011",
      "SRO.1178(I)/2011",
      "SRO.1179(I)/2011",
      "SRO.1180(I)/2011",
      "SRO.1181(I)/2011",
      "SRO.1182(I)/2011",
      "SRO.1183(I)/2011",
      "SRO.1184(I)/2011",
      "SRO.1185(I)/2011",
      "SRO.1186(I)/2011",
      "SRO.1187(I)/2011",
      "SRO.1188(I)/2011",
      "SRO.1189(I)/2011",
      "SRO.1190(I)/2011",
      "SRO.1191(I)/2011",
      "SRO.1192(I)/2011",
      "SRO.1193(I)/2011",
      "SRO.1194(I)/2011",
      "SRO.1195(I)/2011",
      "SRO.1196(I)/2011",
      "SRO.1197(I)/2011",
      "SRO.1198(I)/2011",
      "SRO.1199(I)/2011",
      "SRO.1200(I)/2011",
      "SRO.1201(I)/2011",
      "SRO.1202(I)/2011",
      "SRO.1203(I)/2011",
      "SRO.1204(I)/2011",
      "SRO.1205(I)/2011",
      "SRO.1206(I)/2011",
      "SRO.1207(I)/2011",
      "SRO.1208(I)/2011",
      "SRO.1209(I)/2011",
      "SRO.1210(I)/2011",
      "SRO.1211(I)/2011",
      "SRO.1212(I)/2011",
      "SRO.1213(I)/2011",
      "SRO.1214(I)/2011",
      "SRO.1215(I)/2011",
      "SRO.1216(I)/2011",
      "SRO.1217(I)/2011",
      "SRO.1218(I)/2011",
      "SRO.1219(I)/2011",
      "SRO.1220(I)/2011",
      "SRO.1221(I)/2011",
      "SRO.1222(I)/2011",
      "SRO.1223(I)/2011",
      "SRO.1224(I)/2011",
      "SRO.1225(I)/2011",
      "SRO.1226(I)/2011",
      "SRO.1227(I)/2011",
      "SRO.1228(I)/2011",
      "SRO.1229(I)/2011",
      "SRO.1230(I)/2011",
      "SRO.1231(I)/2011",
      "SRO.1232(I)/2011",
      "SRO.1233(I)/2011",
      "SRO.1234(I)/2011",
      "SRO.1235(I)/2011",
      "SRO.1236(I)/2011",
      "SRO.1237(I)/2011",
      "SRO.1238(I)/2011",
      "SRO.1239(I)/2011",
      "SRO.1240(I)/2011",
      "SRO.1241(I)/2011",
      "SRO.1242(I)/2011",
      "SRO.1243(I)/2011",
      "SRO.1244(I)/2011",
      "SRO.1245(I)/2011",
      "SRO.1246(I)/2011",
      "SRO.1247(I)/2011",
      "SRO.1248(I)/2011",
      "SRO.1249(I)/2011",
      "SRO.1250(I)/2011",
    ];

    // Add fallback SRO Schedule data to comprehensive set
    fallbackSROData.forEach((sro) => {
      allUniqueSROs.add(sro);
    });

    // Create comprehensive SRO Schedule list for dropdown (prepend "N/A")
    const comprehensiveSROList = Array.from(allUniqueSROs).sort();
    if (!comprehensiveSROList.includes("N/A")) {
      comprehensiveSROList.unshift("N/A");
    }

    console.log(
      `Total unique SRO Schedule Numbers available: ${comprehensiveSROList.length}`
    );
    console.log(
      `SRO Schedule Numbers: ${comprehensiveSROList.slice(0, 10).join(", ")}${comprehensiveSROList.length > 10 ? "..." : ""}`
    );

    // Build SRO Item lists per SRO Id (for Excel dropdowns) and create comprehensive SRO Item list

    const sroItemsBySroId = {};
    const allUniqueSROItems = new Set(); // Track all unique SRO Item Numbers

    if (token && sroByRateId && Object.keys(sroByRateId).length > 0) {
      // Collect unique SRO Ids across all rates
      const uniqueSroIds = new Set();

      for (const sroMap of Object.values(sroByRateId)) {
        for (const id of sroMap.values()) uniqueSroIds.add(id);
      }

      console.log(`Fetching SRO Item data for ${uniqueSroIds.size} SRO IDs...`);

      for (const sroId of uniqueSroIds) {
        try {
          const sroItemsRaw = await fetchData(
            `pdi/v2/SROItem?date=2025-03-25&sro_id=${encodeURIComponent(
              sroId
            )}`,
            "sandbox",
            token
          );

          const items = (Array.isArray(sroItemsRaw) ? sroItemsRaw : [])
            .map((it) => {
              const desc =
                it.srO_ITEM_DESC || it.SRO_ITEM_DESC || it.desc || null;
              return desc ? String(desc).trim() : null;
            })
            .filter(Boolean);

          sroItemsBySroId[sroId] = items;

          // Add all SRO Item descriptions to the comprehensive set
          items.forEach((item) => {
            if (item) {
              allUniqueSROItems.add(item);
            }
          });
        } catch (e) {
          sroItemsBySroId[sroId] = [];
        }
      }

      console.log(
        `Collected ${allUniqueSROItems.size} unique SRO Item Numbers from API`
      );
    }

    // Add fallback SRO Item data for comprehensive coverage
    const fallbackSROItemData = [
      "SRO Item 1",
      "SRO Item 2",
      "SRO Item 3",
      "SRO Item 4",
      "SRO Item 5",
      "SRO Item 6",
      "SRO Item 7",
      "SRO Item 8",
      "SRO Item 9",
      "SRO Item 10",
      "SRO Item 11",
      "SRO Item 12",
      "SRO Item 13",
      "SRO Item 14",
      "SRO Item 15",
      "SRO Item 16",
      "SRO Item 17",
      "SRO Item 18",
      "SRO Item 19",
      "SRO Item 20",
      "SRO Item 21",
      "SRO Item 22",
      "SRO Item 23",
      "SRO Item 24",
      "SRO Item 25",
      "SRO Item 26",
      "SRO Item 27",
      "SRO Item 28",
      "SRO Item 29",
      "SRO Item 30",
      "SRO Item 31",
      "SRO Item 32",
      "SRO Item 33",
      "SRO Item 34",
      "SRO Item 35",
      "SRO Item 36",
      "SRO Item 37",
      "SRO Item 38",
      "SRO Item 39",
      "SRO Item 40",
      "SRO Item 41",
      "SRO Item 42",
      "SRO Item 43",
      "SRO Item 44",
      "SRO Item 45",
      "SRO Item 46",
      "SRO Item 47",
      "SRO Item 48",
      "SRO Item 49",
      "SRO Item 50",
    ];

    // Add fallback SRO Item data to comprehensive set
    fallbackSROItemData.forEach((item) => {
      allUniqueSROItems.add(item);
    });

    // Create comprehensive SRO Item list for dropdown (prepend "N/A")
    const comprehensiveSROItemList = Array.from(allUniqueSROItems).sort();
    if (!comprehensiveSROItemList.includes("N/A")) {
      comprehensiveSROItemList.unshift("N/A");
    }

    console.log(
      `Total unique SRO Item Numbers available: ${comprehensiveSROItemList.length}`
    );
    console.log(
      `SRO Item Numbers: ${comprehensiveSROItemList.slice(0, 10).join(", ")}${comprehensiveSROItemList.length > 10 ? "..." : ""}`
    );

    // Fetch UoM data for HS Codes and create comprehensive UoM list

    const uomByHsCode = {};
    const allUniqueUoMs = new Set(); // Track all unique UoM values

    if (token) {
      try {
        // Get HS Codes first

        const hsCodes = await hsCodeCacheService.getHSCodes(
          "sandbox",

          token,

          false
        );

        if (hsCodes && Array.isArray(hsCodes) && hsCodes.length > 0) {
          // Increase limit to get more comprehensive UoM coverage
          const limitedHsCodes = hsCodes.slice(0, 500); // Increased from 100 to 500

          console.log(
            `Fetching UoM data for ${limitedHsCodes.length} HS Codes...`
          );

          // Fetch UoM for each HS Code

          for (const hsCode of limitedHsCodes) {
            const hsCodeValue =
              hsCode.hS_CODE || hsCode.hs_code || hsCode.code || "";

            if (hsCodeValue) {
              try {
                const uomResponse = await fetchData(
                  `pdi/v2/HS_UOM?hs_code=${hsCodeValue}&annexure_id=3`,

                  "sandbox",

                  token
                );

                if (uomResponse && Array.isArray(uomResponse)) {
                  const processedUoMs = uomResponse

                    .map((uom) => ({
                      uoM_ID: uom.uoM_ID || uom.uom_id || uom.id || "",

                      description: uom.description || uom.desc || "",
                    }))

                    .filter(
                      (uom) => uom.description && uom.description.trim() !== ""
                    );

                  uomByHsCode[hsCodeValue] = processedUoMs;

                  // Add all UoM descriptions to the comprehensive set
                  processedUoMs.forEach((uom) => {
                    if (uom.description) {
                      allUniqueUoMs.add(uom.description);
                    }
                  });
                }
              } catch (uomError) {
                // Skip this HS Code if UoM fetch fails

                console.log(
                  `Failed to fetch UoM for HS Code ${hsCodeValue}:`,

                  uomError.message
                );
              }
            }
          }

          console.log(
            `Collected ${allUniqueUoMs.size} unique UoM values from API`
          );
        }
      } catch (error) {
        console.error("Error fetching UoM data:", error);

        // Continue with fallback UoM data
      }
    }

    // Hardcoded UoM options from API response (same as Product template)
    const hardcodedUomOptions = [
      { uoM_ID: 3, description: "MT" },
      { uoM_ID: 4, description: "Bill of lading" },
      { uoM_ID: 5, description: "SET" },
      { uoM_ID: 6, description: "KWH" },
      { uoM_ID: 8, description: "40KG" },
      { uoM_ID: 9, description: "Liter" },
      { uoM_ID: 11, description: "SqY" },
      { uoM_ID: 12, description: "Bag" },
      { uoM_ID: 13, description: "KG" },
      { uoM_ID: 46, description: "MMBTU" },
      { uoM_ID: 48, description: "Meter" },
      { uoM_ID: 50, description: "Pcs" },
      { uoM_ID: 53, description: "Carat" },
      { uoM_ID: 55, description: "Cubic Metre" },
      { uoM_ID: 57, description: "Dozen" },
      { uoM_ID: 59, description: "Gram" },
      { uoM_ID: 61, description: "Gallon" },
      { uoM_ID: 63, description: "Kilogram" },
      { uoM_ID: 65, description: "Pound" },
      { uoM_ID: 67, description: "Timber Logs" },
      { uoM_ID: 69, description: "Numbers, pieces, units" },
      { uoM_ID: 71, description: "Packs" },
      { uoM_ID: 73, description: "Pair" },
      { uoM_ID: 75, description: "Square Foot" },
      { uoM_ID: 77, description: "Square Metre" },
      { uoM_ID: 79, description: "Thousand Unit" },
      { uoM_ID: 81, description: "Mega Watt" },
      { uoM_ID: 83, description: "Foot" },
      { uoM_ID: 85, description: "Barrels" },
      { uoM_ID: 87, description: "NO" },
      { uoM_ID: 118, description: "Meter" },
      { uoM_ID: 110, description: "KWH" },
      { uoM_ID: 112, description: "Packs" },
      { uoM_ID: 114, description: "Meter" },
      { uoM_ID: 116, description: "Liter" },
      { uoM_ID: 117, description: "Bag" },
      { uoM_ID: 98, description: "MMBTU" },
      { uoM_ID: 99, description: "Numbers, pieces, units" },
      { uoM_ID: 100, description: "Square Foot" },
      { uoM_ID: 101, description: "Thousand Unit" },
      { uoM_ID: 102, description: "Barrels" },
      { uoM_ID: 88, description: "Others" },
      { uoM_ID: 96, description: "1000 kWh" },
    ];

    // Fallback UoM data using hardcoded options
    const fallbackUomData = {
      "0101.10.00": hardcodedUomOptions,
      "0101.90.00": hardcodedUomOptions,
      "0102.10.00": hardcodedUomOptions,
      "0102.90.00": hardcodedUomOptions,
      "0103.10.00": hardcodedUomOptions,
      "0103.91.00": hardcodedUomOptions,
      "0103.92.00": hardcodedUomOptions,
      "0104.10.00": hardcodedUomOptions,
      "0104.20.00": hardcodedUomOptions,
      "0105.11.00": hardcodedUomOptions,
      "0105.12.00": hardcodedUomOptions,
      // Add more common HS codes as needed
      default: hardcodedUomOptions,
    };

    // Merge API UoM data with fallback data

    const allUomData = { ...fallbackUomData, ...uomByHsCode };

    // Add all fallback UoM values to the comprehensive set
    Object.values(fallbackUomData).forEach((uomList) => {
      if (Array.isArray(uomList)) {
        uomList.forEach((uom) => {
          if (uom.description) {
            allUniqueUoMs.add(uom.description);
          }
        });
      }
    });

    // Create comprehensive UoM list for dropdown
    const comprehensiveUoMList = Array.from(allUniqueUoMs).sort();

    console.log(
      `Total unique UoM values available: ${comprehensiveUoMList.length}`
    );
    console.log(`UoM values: ${comprehensiveUoMList.join(", ")}`);

    // Build Excel workbook

    const wb = new ExcelJS.Workbook();

    wb.creator = "FBR Sandbox System";

    wb.created = new Date();

    const template = wb.addWorksheet("Template", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Lists sheet removed - no longer generating dropdown data in Excel template

    // Define expected columns (in the same order as CSV uploader expects)
    // Add buyer columns as requested

    const columns = [
      "invoiceType",
      "invoiceDate",
      "invoiceRefNo",
      "companyInvoiceRefNo",
      // Buyer details
      "buyerNTNCNIC",
      "buyerBusinessName",
      "buyerProvince",
      "buyerAddress",
      "buyerRegistrationType",
      // Transaction and item details
      "transctypeId",
      "item_rate",
      "item_sroScheduleNo",
      "item_sroItemSerialNo",
      "item_saleType",
      "item_hsCode",
      "item_uoM",
      "item_productName",
      "item_productDescription",
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

    // Map internal keys to user-friendly display labels for header row
    const displayLabelMap = {
      invoiceType: "Invoice Type",
      invoiceDate: "Invoice Date",
      invoiceRefNo: "DN Invoice Ref No",
      companyInvoiceRefNo: "Company Invoice Ref No",
      buyerNTNCNIC: "Buyer NTN/CNIC",
      buyerBusinessName: "Buyer Buisness Name",
      buyerProvince: "Buyer Province",
      buyerAddress: "Buyer Address",
      buyerRegistrationType: "Buyer Registration Type",
      transctypeId: "Transaction Type",
      item_rate: "Rate",
      item_sroScheduleNo: "SRO Schedule No",
      item_sroItemSerialNo: "SRO Item No",
      item_saleType: "Sale Type",
      item_hsCode: "HS Code",
      item_uoM: "Unit Of Measurement",
      item_productName: "Product Name",
      item_productDescription: "Product Description",
      item_valueSalesExcludingST: "Value Sales (Excl ST)",
      item_quantity: "Quantity",
      item_unitPrice: "Unit Cost",
      item_salesTaxApplicable: "Sales Tax Applicable",
      item_salesTaxWithheldAtSource: "ST Withheld at Source",
      item_extraTax: "Extra Tax",
      item_furtherTax: "Further Tax",
      item_fedPayable: "FED Payable",
      item_discount: "Discount",
      item_totalValues: "Total Values",
    };

    const displayHeaders = columns.map((c) => displayLabelMap[c] || c);

    template.addRow(displayHeaders);

    template.getRow(1).font = { bold: true };

    // Buyer-specific formatting: Treat NTN/CNIC as text and readable
    const buyerNtnIdx = columns.indexOf("buyerNTNCNIC") + 1;
    if (buyerNtnIdx > 0) {
      const col = template.getColumn(buyerNtnIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // HS Code formatting: Treat as text to preserve format (e.g., 0101.10.00)
    const hsCodeIdx = columns.indexOf("item_hsCode") + 1;
    if (hsCodeIdx > 0) {
      const col = template.getColumn(hsCodeIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // Rate formatting: Treat as text to preserve rate format (e.g., "17%", "Exempt")
    const rateIdx = columns.indexOf("item_rate") + 1;
    if (rateIdx > 0) {
      const col = template.getColumn(rateIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // SRO Schedule No formatting: Treat as text to preserve format
    const sroScheduleIdx = columns.indexOf("item_sroScheduleNo") + 1;
    if (sroScheduleIdx > 0) {
      const col = template.getColumn(sroScheduleIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // UoM formatting: Treat as text to preserve unit format
    const uoMIdx = columns.indexOf("item_uoM") + 1;
    if (uoMIdx > 0) {
      const col = template.getColumn(uoMIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // SRO Item Serial No formatting: Treat as text to preserve format
    const sroItemIdx = columns.indexOf("item_sroItemSerialNo") + 1;
    if (sroItemIdx > 0) {
      const col = template.getColumn(sroItemIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // Sale Type formatting: Treat as text to preserve format
    const saleTypeIdx = columns.indexOf("item_saleType") + 1;
    if (saleTypeIdx > 0) {
      const col = template.getColumn(saleTypeIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // Transaction Type formatting: Treat as text to preserve format
    const transTypeIdx = columns.indexOf("transctypeId") + 1;
    if (transTypeIdx > 0) {
      const col = template.getColumn(transTypeIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // Invoice Reference Number formatting: Treat as text to preserve format
    const invoiceRefIdx = columns.indexOf("invoiceRefNo") + 1;
    if (invoiceRefIdx > 0) {
      const col = template.getColumn(invoiceRefIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }

    // Company Invoice Reference Number formatting: Treat as text to preserve format
    const companyInvoiceRefIdx = columns.indexOf("companyInvoiceRefNo") + 1;
    if (companyInvoiceRefIdx > 0) {
      const col = template.getColumn(companyInvoiceRefIdx);
      col.numFmt = "@";
      col.alignment = { horizontal: "left" };
      if (!col.width || col.width < 18) col.width = 20;
    }
    // Lists sheet content removed - no longer generating dropdown data in Excel template

    // Also project lists into hidden columns on Template to avoid cross-sheet/named-range issues

    const typeListCol = columns.length + 5; // hidden list columns start after visible columns

    const provinceListCol = typeListCol + 1;

    const ttCombinedCol = provinceListCol + 1;

    const hsCodeListCol = ttCombinedCol + 1;

    const uomListCol = hsCodeListCol + 1;

    const allUoMCol = uomListCol + 1; // New column for comprehensive UoM list

    const allRatesCol = allUoMCol + 1;

    const allSROCol = allRatesCol + 1; // New column for comprehensive SRO Schedule list

    const allSROItemCol = allSROCol + 1; // New column for comprehensive SRO Item list

    const rateDescToIdCol = allSROItemCol + 1; // hidden mapping: rate desc

    const rateIdMapCol = rateDescToIdCol + 1; // hidden mapping: rate id

    const extractedTypeIdCol = rateIdMapCol + 1; // hidden helper column to extract transaction type ID

    const rateLabelCol = extractedTypeIdCol + 1; // hidden projected rate labels per type

    const rateCountCol = rateLabelCol + 1; // hidden projected rate counts per type

    const rateOutputStartCol = rateCountCol + 1; // per-row horizontal output area

    const maxRatesPerType = 40; // allocate space for up to 40 rates per row

    const startIndexCol = rateOutputStartCol + maxRatesPerType; // per-row start index for rates block

    const resolvedCountCol = startIndexCol + 1; // per-row resolved count of rates

    const extractedHsCodeCol = resolvedCountCol + 1; // hidden helper column to extract HS Code

    const uomLabelCol = extractedHsCodeCol + 1; // hidden projected UoM labels per HS Code

    const uomCountCol = uomLabelCol + 1; // hidden projected UoM counts per HS Code

    const uomOutputStartCol = uomCountCol + 1; // per-row horizontal output area for UoM

    const maxUomPerHsCode = 20; // allocate space for up to 20 UoM options per HS Code

    const uomStartIndexCol = uomOutputStartCol + maxUomPerHsCode; // per-row start index for UoM block

    const uomResolvedCountCol = uomStartIndexCol + 1; // per-row resolved count of UoM options

    // SRO Schedule hidden areas

    const extractedRateIdCol = uomResolvedCountCol + 1; // per-row extracted rate id from selected rate desc

    const sroLabelCol = extractedRateIdCol + 1; // hidden projected SRO labels per rate id

    const sroIdCol = sroLabelCol + 1; // hidden projected SRO ids aligned with labels

    const sroCountCol = sroIdCol + 1; // hidden projected SRO counts per rate id

    const sroOutputStartCol = sroCountCol + 1; // per-row horizontal output area for SRO labels

    const sroIdOutputStartCol = sroOutputStartCol + 40; // per-row horizontal output area for SRO ids (align with labels)

    const maxSroPerRate = 40;

    const sroStartIndexCol = sroIdOutputStartCol + maxSroPerRate; // per-row start index for SRO block

    const sroResolvedCountCol = sroStartIndexCol + 1; // per-row resolved count of SRO options

    // Additional hidden columns for SRO Items (appended after SRO schedule areas)

    const selectedSroIndexCol = sroResolvedCountCol + 1; // index of selected SRO within row outputs

    const extractedSroIdCol2 = selectedSroIndexCol + 1; // selected SRO Id per-row

    const sroItemLabelCol = extractedSroIdCol2 + 1; // hidden projected SRO Item labels per SRO Id

    const sroItemCountCol = sroItemLabelCol + 1; // hidden projected SRO Item counts

    const sroItemOutputStartCol = sroItemCountCol + 1; // per-row horizontal output area for SRO Items

    const maxSroItemsPerSro = 60;

    const sroItemStartIndexCol = sroItemOutputStartCol + maxSroItemsPerSro; // per-row start index for SRO Item block

    const sroItemResolvedCountCol = sroItemStartIndexCol + 1; // per-row resolved count of SRO Item options

    // Helper columns for automatic calculations

    const subtotalCol = sroItemResolvedCountCol + 1; // subtotal before discount

    const discountAmountCol = subtotalCol + 1; // calculated discount amount

    const finalTotalCol = discountAmountCol + 1; // final total after discount

    const writeHiddenList = (colIndex, values) => {
      const startRow = 2; // keep row 1 for headers on Template

      template.getColumn(colIndex).hidden = true;

      if (!Array.isArray(values) || values.length === 0) {
        template.getCell(startRow, colIndex).value = "";

        return { startRow, endRow: startRow };
      }

      values.forEach((val, idx) => {
        template.getCell(startRow + idx, colIndex).value = val;
      });

      return { startRow, endRow: startRow + values.length - 1 };
    };

    const invoiceTypeValues = ["Sale Invoice", "Debit Note"];

    const provincesValues = Object.keys(provinceMap);

    const transTypeCombinedValues = transactionTypes.map(
      (tt) => `${tt.id} - ${tt.desc}`
    );

    const typeListRange = writeHiddenList(typeListCol, invoiceTypeValues);

    const provinceListRange = writeHiddenList(provinceListCol, provincesValues);

    const ttCombinedRange = writeHiddenList(
      ttCombinedCol,

      transTypeCombinedValues
    );

    // Prepare HSCode values for hidden list

    const hsCodeValues = [];

    try {
      const hsCodes = await hsCodeCacheService.getHSCodes(
        "sandbox",

        token,

        false
      );

      if (hsCodes && Array.isArray(hsCodes) && hsCodes.length > 0) {
        // Limit to first 1000 HSCodes to avoid Excel performance issues

        const limitedHsCodes = hsCodes.slice(0, 1000);

        limitedHsCodes.forEach((hsCode) => {
          const displayValue = `${hsCode.hS_CODE || hsCode.hs_code || hsCode.code || ""} - ${hsCode.description || ""}`;

          hsCodeValues.push(displayValue);
        });
      }
    } catch (error) {
      console.error("Error fetching HS codes for hidden list:", error);

      // Add fallback HSCodes if API fails

      hsCodeValues.push(
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

        "0105.12.00 - Live goats, other"
      );
    }

    const hsCodeListRange = writeHiddenList(hsCodeListCol, hsCodeValues);

    // Prepare UoM values for hidden list - create a mapping structure

    const uomMappingData = [];

    Object.keys(allUomData).forEach((hsCode) => {
      const uomOptions = allUomData[hsCode];

      if (uomOptions && Array.isArray(uomOptions) && uomOptions.length > 0) {
        uomOptions.forEach((uom) => {
          if (uom.description) {
            uomMappingData.push({
              hsCode: hsCode,

              uom: uom.description,
            });
          }
        });
      }
    });

    // Create a simple list of all unique UoM values for fallback

    const allUomValues = [...new Set(uomMappingData.map((item) => item.uom))];

    const uomListRange = writeHiddenList(uomListCol, allUomValues);

    // Write comprehensive UoM list for dropdown
    const allUoMRange = writeHiddenList(allUoMCol, comprehensiveUoMList);

    // Create a unified list of all unique rates across all transaction types

    const allRatesSet = new Set();

    for (const tt of transactionTypes) {
      const rates = ratesByType[tt.id] || [];

      rates.forEach((rate) => allRatesSet.add(rate));
    }

    const allRates = Array.from(allRatesSet);

    // Log the rates being included in the Excel template for debugging
    console.log("Excel Template - Transaction Types:", transactionTypes.length);
    console.log("Excel Template - Total Unique Rates:", allRates.length);
    console.log("Excel Template - Rates by Transaction Type:");
    for (const tt of transactionTypes) {
      const rates = ratesByType[tt.id] || [];
      console.log(
        `  Transaction Type ${tt.id} (${tt.desc}): ${rates.length} rates`
      );
      if (rates.length > 0) {
        console.log(`    Rates: ${rates.join(", ")}`);
      }
    }

    const allRatesRange = writeHiddenList(allRatesCol, allRates);

    // Write comprehensive SRO Schedule list for dropdown
    const allSRORange = writeHiddenList(allSROCol, comprehensiveSROList);

    // Write comprehensive SRO Item list for dropdown
    const allSROItemRange = writeHiddenList(
      allSROItemCol,
      comprehensiveSROItemList
    );

    // Write rate desc -> id mapping (two hidden columns: desc, id)

    const rateMappingStartRow = 2;

    template.getColumn(rateDescToIdCol).hidden = true;

    template.getColumn(rateIdMapCol).hidden = true;

    let rateMapRow = rateMappingStartRow;

    for (const [desc, id] of rateDescToId.entries()) {
      template.getCell(rateMapRow, rateDescToIdCol).value = desc;

      template.getCell(rateMapRow, rateIdMapCol).value = id;

      rateMapRow++;
    }

    // Prepare the helper column that extracts the numeric ID from the combined value

    template.getColumn(hsCodeListCol).hidden = true;

    template.getColumn(uomListCol).hidden = true;

    template.getColumn(extractedTypeIdCol).hidden = true;

    template.getColumn(extractedHsCodeCol).hidden = true;

    template.getColumn(uomLabelCol).hidden = true;

    template.getColumn(uomCountCol).hidden = true;

    template.getColumn(uomStartIndexCol).hidden = true;

    template.getColumn(uomResolvedCountCol).hidden = true;

    for (let c = 0; c < maxUomPerHsCode; c++) {
      template.getColumn(uomOutputStartCol + c).hidden = true;
    }

    // Hide SRO columns

    template.getColumn(sroLabelCol).hidden = true;

    template.getColumn(sroIdCol).hidden = true;

    template.getColumn(sroCountCol).hidden = true;

    for (let c = 0; c < maxSroPerRate; c++) {
      template.getColumn(sroOutputStartCol + c).hidden = true;

      template.getColumn(sroIdOutputStartCol + c).hidden = true;
    }

    template.getColumn(sroStartIndexCol).hidden = true;

    template.getColumn(sroResolvedCountCol).hidden = true;

    // Hide SRO Item columns

    template.getColumn(selectedSroIndexCol).hidden = true;

    template.getColumn(extractedSroIdCol2).hidden = true;

    template.getColumn(sroItemLabelCol).hidden = true;

    template.getColumn(sroItemCountCol).hidden = true;

    for (let c = 0; c < maxSroItemsPerSro; c++) {
      template.getColumn(sroItemOutputStartCol + c).hidden = true;
    }

    template.getColumn(sroItemStartIndexCol).hidden = true;

    template.getColumn(sroItemResolvedCountCol).hidden = true;

    // Hide helper calculation columns

    template.getColumn(subtotalCol).hidden = true;

    template.getColumn(discountAmountCol).hidden = true;

    template.getColumn(finalTotalCol).hidden = true;

    template.getColumn(rateLabelCol).hidden = true;

    template.getColumn(rateCountCol).hidden = true;

    template.getColumn(startIndexCol).hidden = true;

    template.getColumn(resolvedCountCol).hidden = true;

    for (let c = 0; c < maxRatesPerType; c++) {
      template.getColumn(rateOutputStartCol + c).hidden = true;
    }

    // Project rate blocks onto the Template sheet (store typeId labels as raw IDs)

    // to avoid string parsing issues in data validation formulas

    const labelsStartRow = 2; // start after header

    let templateRatesRow = labelsStartRow; // moving pointer for blocks

    for (const tt of transactionTypes) {
      const rates = ratesByType[tt.id] || [];

      // Label column holds the transaction type ID as text (ensures exact text MATCH)

      template.getCell(templateRatesRow, rateLabelCol).value = String(tt.id);

      template.getCell(templateRatesRow, rateCountCol).value = Math.max(
        rates.length,

        1
      );

      if (rates.length === 0) {
        template.getCell(templateRatesRow + 1, rateLabelCol).value =
          "No rates available";

        templateRatesRow += 2;

        continue;
      }

      rates.forEach((val, idx) => {
        template.getCell(templateRatesRow + 1 + idx, rateLabelCol).value = val;
      });

      templateRatesRow += 1 + rates.length;
    }

    const labelsEndRow = templateRatesRow - 1;

    // Project UoM blocks onto the Template sheet (store HS Code labels)

    let templateUomRow = labelsStartRow; // moving pointer for UoM blocks

    for (const hsCode of Object.keys(allUomData)) {
      const uomOptions = allUomData[hsCode] || [];

      // Label column holds the HS Code as text (ensures exact text MATCH)

      template.getCell(templateUomRow, uomLabelCol).value = String(hsCode);

      template.getCell(templateUomRow, uomCountCol).value = Math.max(
        uomOptions.length,

        1
      );

      if (uomOptions.length === 0) {
        template.getCell(templateUomRow + 1, uomLabelCol).value =
          "No UoM options available";

        templateUomRow += 2;

        continue;
      }

      uomOptions.forEach((uom, idx) => {
        template.getCell(templateUomRow + 1 + idx, uomLabelCol).value =
          uom.description;
      });

      templateUomRow += 1 + uomOptions.length;
    }

    const uomLabelsEndRow = templateUomRow - 1;

    // Project SRO schedule blocks onto the Template sheet (store rateId labels)

    let templateSroRow = labelsStartRow;

    for (const [rateId, sroMap] of Object.entries(sroByRateId)) {
      const sroEntries = Array.from(sroMap.entries()); // [desc, id]

      template.getCell(templateSroRow, sroLabelCol).value = String(rateId);

      template.getCell(templateSroRow, sroCountCol).value = Math.max(
        sroEntries.length,

        1
      );

      if (sroEntries.length === 0) {
        template.getCell(templateSroRow + 1, sroLabelCol).value =
          "No SRO available";

        template.getCell(templateSroRow + 1, sroIdCol).value = "";

        templateSroRow += 2;

        continue;
      }

      sroEntries.forEach(([desc, id], idx) => {
        template.getCell(templateSroRow + 1 + idx, sroLabelCol).value = desc;

        template.getCell(templateSroRow + 1 + idx, sroIdCol).value = id;
      });

      templateSroRow += 1 + sroEntries.length;
    }

    const sroLabelsEndRow = templateSroRow - 1;

    // Project SRO Item blocks onto the Template sheet (store SRO Id labels)

    let templateSroItemRow = labelsStartRow;

    for (const [sroId, itemDescs] of Object.entries(sroItemsBySroId)) {
      const items = Array.isArray(itemDescs) ? itemDescs : [];

      template.getCell(templateSroItemRow, sroItemLabelCol).value =
        String(sroId);

      template.getCell(templateSroItemRow, sroItemCountCol).value = Math.max(
        items.length,
        1
      );

      if (items.length === 0) {
        template.getCell(templateSroItemRow + 1, sroItemLabelCol).value =
          "No SRO Items available";

        templateSroItemRow += 2;
        continue;
      }

      items.forEach((desc, idx) => {
        template.getCell(templateSroItemRow + 1 + idx, sroItemLabelCol).value =
          desc;
      });

      templateSroItemRow += 1 + items.length;
    }

    const sroItemLabelsEndRow = templateSroItemRow - 1;

    // Helper: get column letter by index (1-based)

    const getColLetter = (i) => {
      let s = "";

      let n = i;

      while (n > 0) {
        const m = (n - 1) % 26;

        s = String.fromCharCode(65 + m) + s;

        n = Math.floor((n - 1) / 26);
      }

      return s;
    };

    const headerIndex = (name) => columns.indexOf(name) + 1; // 1-based

    // Apply data validations for 1000 rows

    const maxRows = 1001; // including header

    for (let r = 2; r <= maxRows; r++) {
      // Populate extracted transaction type id per-row: handles both "id - desc" and plain id

      const ttColLetter = getColLetter(headerIndex("transctypeId"));

      template.getCell(r, extractedTypeIdCol).value = {
        formula: `IFERROR(LEFT($${ttColLetter}${r},FIND(" - ",$${ttColLetter}${r})-1),$${ttColLetter}${r})`,
      };

      // Populate extracted HS Code per-row: handles both "code - desc" and plain code

      const hsCodeColLetter = getColLetter(headerIndex("item_hsCode"));

      template.getCell(r, extractedHsCodeCol).value = {
        formula: `IFERROR(LEFT($${hsCodeColLetter}${r},FIND(" - ",$${hsCodeColLetter}${r})-1),$${hsCodeColLetter}${r})`,
      };

      // invoiceType

      template.getCell(r, headerIndex("invoiceType")).dataValidation = {
        type: "list",

        allowBlank: true,

        // Reference hidden list placed on this sheet to avoid cross-sheet parsing

        formulae: [`"${invoiceTypeValues.join(",")}"`],

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid value",

        error: "Select a value from the dropdown list.",
      };

      // buyerProvince dropdown (uses hidden provinces list on this sheet)
      if (headerIndex("buyerProvince") > 0) {
        template.getCell(r, headerIndex("buyerProvince")).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [
            `$${getColLetter(provinceListCol)}$${provinceListRange.startRow}:$${getColLetter(
              provinceListCol
            )}$${provinceListRange.endRow}`,
          ],
          showErrorMessage: true,
        };
      }

      // transctypeId -> list of Combined (ID - Desc) values for better UX

      template.getCell(r, headerIndex("transctypeId")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(ttCombinedCol)}$${ttCombinedRange.startRow}:$${getColLetter(ttCombinedCol)}$${ttCombinedRange.endRow}`,
        ],

        showErrorMessage: true,
      };

      // Per-row: compute starting index of selected transaction type's rates block

      template.getCell(r, startIndexCol).value = {
        formula: `IFERROR(MATCH($${getColLetter(extractedTypeIdCol)}${r},$${getColLetter(rateLabelCol)}$${labelsStartRow}:$${getColLetter(rateLabelCol)}$${labelsEndRow},0)+${labelsStartRow - 1},0)`,
      };

      // Per-row: resolve number of rates for selected type

      template.getCell(r, resolvedCountCol).value = {
        formula: `IFERROR(INDEX($${getColLetter(rateCountCol)}$${labelsStartRow}:$${getColLetter(rateCountCol)}$${labelsEndRow},MATCH($${getColLetter(extractedTypeIdCol)}${r},$${getColLetter(rateLabelCol)}$${labelsStartRow}:$${getColLetter(rateLabelCol)}$${labelsEndRow},0)),0)`,
      };

      // Per-row: project up to maxRatesPerType horizontally

      for (let k = 0; k < maxRatesPerType; k++) {
        const outCol = rateOutputStartCol + k;

        template.getCell(r, outCol).value = {
          formula: `IF($${getColLetter(resolvedCountCol)}${r}>=${k + 1},INDEX($${getColLetter(rateLabelCol)}:$${getColLetter(rateLabelCol)},$${getColLetter(startIndexCol)}${r}+${k + 1}),"")`,
        };
      }

      // item_rate dropdown - show ALL available rates from all transaction types
      template.getCell(r, headerIndex("item_rate")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(allRatesCol)}$${allRatesRange.startRow}:$${getColLetter(
            allRatesCol
          )}$${allRatesRange.endRow}`,
        ],

        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Invalid Rate",
        error: "Select a valid rate from the dropdown list.",
      };

      // Extract selected Rate Id using the rate desc -> id mapping table

      const rateDescColLetter = getColLetter(headerIndex("item_rate"));

      template.getCell(r, extractedRateIdCol).value = {
        formula: `IFERROR(INDEX($${getColLetter(rateIdMapCol)}:$${getColLetter(
          rateIdMapCol
        )},MATCH($${rateDescColLetter}${r},$${getColLetter(rateDescToIdCol)}:$${getColLetter(
          rateDescToIdCol
        )},0))&"","")`,
      };

      // SRO per selected Rate Id: compute block start and count

      template.getCell(r, sroStartIndexCol).value = {
        formula: `IFERROR(MATCH($${getColLetter(extractedRateIdCol)}${r},$${getColLetter(
          sroLabelCol
        )}$${labelsStartRow}:$${getColLetter(sroLabelCol)}$${sroLabelsEndRow},0)+${
          labelsStartRow - 1
        },0)`,
      };

      template.getCell(r, sroResolvedCountCol).value = {
        formula: `IFERROR(INDEX($${getColLetter(sroCountCol)}$${labelsStartRow}:$${getColLetter(
          sroCountCol
        )}$${sroLabelsEndRow},MATCH($${getColLetter(extractedRateIdCol)}${r},$${getColLetter(
          sroLabelCol
        )}$${labelsStartRow}:$${getColLetter(sroLabelCol)}$${sroLabelsEndRow},0)),0)`,
      };

      // Project SRO labels and ids horizontally

      for (let k = 0; k < maxSroPerRate; k++) {
        template.getCell(r, sroOutputStartCol + k).value = {
          formula: `IF($${getColLetter(sroResolvedCountCol)}${r}>=${k + 1},INDEX($${getColLetter(
            sroLabelCol
          )}:$${getColLetter(sroLabelCol)},$${getColLetter(sroStartIndexCol)}${r}+${
            k + 1
          }),"")`,
        };

        template.getCell(r, sroIdOutputStartCol + k).value = {
          formula: `IF($${getColLetter(sroResolvedCountCol)}${r}>=${k + 1},INDEX($${getColLetter(
            sroIdCol
          )}:$${getColLetter(sroIdCol)},$${getColLetter(sroStartIndexCol)}${r}+${
            k + 1
          }),"")`,
        };
      }

      // item_sroScheduleNo dropdown (shows ALL available SRO Schedule Numbers from API and fallback data)

      template.getCell(r, headerIndex("item_sroScheduleNo")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(allSROCol)}$${allSRORange.startRow}:$${getColLetter(
            allSROCol
          )}$${allSRORange.endRow}`,
        ],

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid SRO Schedule",

        error: "Select a valid SRO Schedule from the dropdown list.",
      };

      // Selected SRO index within the horizontal SRO labels for this row

      template.getCell(r, selectedSroIndexCol).value = {
        formula: `IFERROR(MATCH($${getColLetter(
          headerIndex("item_sroScheduleNo")
        )}${r},$${getColLetter(sroOutputStartCol)}$${r}:$${getColLetter(
          sroOutputStartCol + maxSroPerRate - 1
        )}$${r},0),0)`,
      };

      // Extract selected SRO Id using the aligned SRO Id horizontal outputs

      template.getCell(r, extractedSroIdCol2).value = {
        formula: `IF($${getColLetter(selectedSroIndexCol)}${r}>0,INDEX($${getColLetter(
          sroIdOutputStartCol
        )}$${r}:$${getColLetter(
          sroIdOutputStartCol + maxSroPerRate - 1
        )}$${r},$${getColLetter(selectedSroIndexCol)}${r}),"")`,
      };

      // Per-row: compute starting index of selected SRO Id's SRO Item block

      template.getCell(r, sroItemStartIndexCol).value = {
        formula: `IFERROR(MATCH($${getColLetter(extractedSroIdCol2)}${r},$${getColLetter(
          sroItemLabelCol
        )}$${labelsStartRow}:$${getColLetter(sroItemLabelCol)}$${sroItemLabelsEndRow},0)+${
          labelsStartRow - 1
        },0)`,
      };

      // Resolve number of SRO Item options for selected SRO Id

      template.getCell(r, sroItemResolvedCountCol).value = {
        formula: `IFERROR(INDEX($${getColLetter(sroItemCountCol)}$${labelsStartRow}:$${getColLetter(
          sroItemCountCol
        )}$${sroItemLabelsEndRow},MATCH($${getColLetter(
          extractedSroIdCol2
        )}${r},$${getColLetter(sroItemLabelCol)}$${labelsStartRow}:$${getColLetter(
          sroItemLabelCol
        )}$${sroItemLabelsEndRow},0)),0)`,
      };

      // Project SRO Items horizontally

      for (let k = 0; k < maxSroItemsPerSro; k++) {
        template.getCell(r, sroItemOutputStartCol + k).value = {
          formula: `IF($${getColLetter(sroItemResolvedCountCol)}${r}>=${
            k + 1
          },INDEX($${getColLetter(sroItemLabelCol)}:$${getColLetter(
            sroItemLabelCol
          )},$${getColLetter(sroItemStartIndexCol)}${r}+${k + 1}),"")`,
        };
      }

      // item_sroItemSerialNo dropdown (shows ALL available SRO Item Numbers from API and fallback data)

      template.getCell(r, headerIndex("item_sroItemSerialNo")).dataValidation =
        {
          type: "list",
          allowBlank: true,
          formulae: [
            `$${getColLetter(allSROItemCol)}$${allSROItemRange.startRow}:$${getColLetter(
              allSROItemCol
            )}$${allSROItemRange.endRow}`,
          ],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: "Invalid SRO Item",
          error: "Select a valid SRO Item from the dropdown list.",
        };

      // Per-row: compute starting index of selected HS Code's UoM block

      template.getCell(r, uomStartIndexCol).value = {
        formula: `IFERROR(MATCH($${getColLetter(extractedHsCodeCol)}${r},$${getColLetter(uomLabelCol)}$${labelsStartRow}:$${getColLetter(uomLabelCol)}$${uomLabelsEndRow},0)+${labelsStartRow - 1},0)`,
      };

      // Per-row: resolve number of UoM options for selected HS Code

      template.getCell(r, uomResolvedCountCol).value = {
        formula: `IFERROR(INDEX($${getColLetter(uomCountCol)}$${labelsStartRow}:$${getColLetter(uomCountCol)}$${uomLabelsEndRow},MATCH($${getColLetter(extractedHsCodeCol)}${r},$${getColLetter(uomLabelCol)}$${labelsStartRow}:$${getColLetter(uomLabelCol)}$${uomLabelsEndRow},0)),0)`,
      };

      // Per-row: project up to maxUomPerHsCode horizontally

      for (let k = 0; k < maxUomPerHsCode; k++) {
        const outCol = uomOutputStartCol + k;

        template.getCell(r, outCol).value = {
          formula: `IF($${getColLetter(uomResolvedCountCol)}${r}>=${k + 1},INDEX($${getColLetter(uomLabelCol)}:$${getColLetter(uomLabelCol)},$${getColLetter(uomStartIndexCol)}${r}+${k + 1}),"")`,
        };
      }

      // Auto-populate salesType with transaction type description

      // Extract description from the combined transaction type value (e.g., "1 - Sale" -> "Sale")

      const ttColLetterForSalesType = getColLetter(headerIndex("transctypeId"));

      template.getCell(r, headerIndex("item_saleType")).value = {
        formula: `IFERROR(IF(FIND(" - ",$${ttColLetterForSalesType}${r})>0,MID($${ttColLetterForSalesType}${r},FIND(" - ",$${ttColLetterForSalesType}${r})+3,LEN($${ttColLetterForSalesType}${r})),""),"")`,
      };

      // buyerRegistrationType dropdown (Registered / Unregistered)
      if (headerIndex("buyerRegistrationType") > 0) {
        template.getCell(
          r,
          headerIndex("buyerRegistrationType")
        ).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Registered,Unregistered"'],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: "Invalid Registration Type",
          error: "Select Registered or Unregistered from the dropdown list.",
        };
      }

      // item_hsCode - Free text input (dropdown removed)
      // Users can now input their own HS Code values

      // item_uoM - UoM dropdown (shows ALL available UoM values from API and fallback data)

      template.getCell(r, headerIndex("item_uoM")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(allUoMCol)}$${allUoMRange.startRow}:$${getColLetter(
            allUoMCol
          )}$${allUoMRange.endRow}`,
        ],

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid UoM",

        error: "Select a valid Unit of Measurement from the dropdown list.",
      };

      // Add data validation for numeric fields to ensure calculations work properly

      // item_quantity - must be positive number

      template.getCell(r, headerIndex("item_quantity")).dataValidation = {
        type: "decimal",

        operator: "greaterThan",

        formulae: [0],

        allowBlank: true,

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid Quantity",

        error: "Quantity must be a positive number.",
      };

      // item_valueSalesExcludingST - must be positive number

      template.getCell(
        r,

        headerIndex("item_valueSalesExcludingST")
      ).dataValidation = {
        type: "decimal",

        operator: "greaterThan",

        formulae: [0],

        allowBlank: true,

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid Value (Excl. ST)",

        error: "Value (Excl. ST) must be a positive number.",
      };

      // item_discount - must be a positive number (amount, not percentage)

      template.getCell(r, headerIndex("item_discount")).dataValidation = {
        type: "decimal",

        operator: "greaterThanOrEqual",

        formulae: [0],

        allowBlank: true,

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid Discount",

        error: "Discount must be a positive number (amount).",
      };

      // Auto-calculate Unit Price as Retail Price ÷ Quantity; leave other calculated cells empty
      const qtyColLetter = getColLetter(headerIndex("item_quantity"));
      const retailColLetter = getColLetter(
        headerIndex("item_valueSalesExcludingST")
      );
      // Only first data row shows 0 by default; others stay blank until inputs are provided
      if (r === 2) {
        template.getCell(r, headerIndex("item_unitPrice")).value = {
          formula: `IFERROR($${retailColLetter}${r}/$${qtyColLetter}${r},0)`,
        };
      } else {
        template.getCell(r, headerIndex("item_unitPrice")).value = {
          formula: `IF(OR($${retailColLetter}${r}="",$${qtyColLetter}${r}=""),"",IFERROR($${retailColLetter}${r}/$${qtyColLetter}${r},0))`,
        };
      }
      // Value Sales (Excl. ST) is user-provided; no auto-copy
      template.getCell(r, headerIndex("item_valueSalesExcludingST")).value = "";
      // Auto-calculate Sales Tax Applicable = Value (Excl. ST) × (Rate ÷ 100)
      const rateColLetter = getColLetter(headerIndex("item_rate"));
      template.getCell(r, headerIndex("item_salesTaxApplicable")).value = {
        formula: `IF($${retailColLetter}${r}="","",
IF($${rateColLetter}${r}="","",
IF(ISNUMBER(SEARCH("exempt",LOWER($${rateColLetter}${r}))),0,
$${retailColLetter}${r}*(VALUE(SUBSTITUTE($${rateColLetter}${r},"%",""))/100))))`,
      };
      // Auto-calculate Total Values = (Value Excl. ST + Sales Tax + FED + ST W/H + Further Tax) minus Discount Amount
      const vsColLetter = getColLetter(
        headerIndex("item_valueSalesExcludingST")
      );
      const staColLetter = getColLetter(headerIndex("item_salesTaxApplicable"));
      const fedColLetter = getColLetter(headerIndex("item_fedPayable"));
      const stwColLetter = getColLetter(
        headerIndex("item_salesTaxWithheldAtSource")
      );
      const ftrColLetter = getColLetter(headerIndex("item_furtherTax"));
      const dscColLetter = getColLetter(headerIndex("item_discount"));
      template.getCell(r, headerIndex("item_totalValues")).value = {
        formula: `IF($${retailColLetter}${r}="","",
SUM($${vsColLetter}${r},$${staColLetter}${r},$${fedColLetter}${r},$${stwColLetter}${r},$${ftrColLetter}${r})-
IF($${dscColLetter}${r}="",0,VALUE($${dscColLetter}${r})))`,
      };

      // Also clear helper columns to avoid hidden computed values
      template.getCell(r, subtotalCol).value = "";
      template.getCell(r, discountAmountCol).value = "";
    }

    // Summary totals removed (no auto-calculation)

    const summaryRow = maxRows + 1;

    // Optionally keep a label to indicate end of grid
    template.getCell(summaryRow, 1).value = "";

    // Add instructions row

    const instructionsRow = summaryRow + 2;

    template.getCell(instructionsRow, 1).value = "INSTRUCTIONS:";

    template.getCell(instructionsRow, 1).font = {
      bold: true,

      color: { argb: "FF0000FF" },
    };

    const instructions = [
      "1. Unit Cost auto-calculates as Value Sales (Excl. ST) ÷ Quantity.",
      "2. Enter Value Sales (Excl. ST); it is used to compute Unit Cost.",
      "3. Sales Tax Applicable auto-calculates: Value Sales (Excl. ST) × (rate ÷ 100).",
      "4. Total Values = (Value Excl. ST + Sales Tax + FED + ST W/H + Further Tax) minus Discount Amount.",
      "5. Enter Quantity and Value Sales (Excl. ST) to compute Unit Cost.",
      "6. HS Code is now free text input. Use dropdowns for validated selections (UoM, Rate, etc.)",
      "7. Rate dropdown now includes ALL available rates from API and hardcoded data.",
      "8. UoM dropdown now includes ALL available UoM values from API and fallback data.",
      "9. SRO Schedule dropdown now includes ALL available SRO Schedule Numbers from API and fallback data.",
      "10. SRO Item dropdown now includes ALL available SRO Item Numbers from API and fallback data.",
      "11. All transaction types and their corresponding rates are included for comprehensive coverage.",
    ];

    instructions.forEach((instruction, idx) => {
      template.getCell(instructionsRow + idx + 1, 1).value = instruction;

      template.getCell(instructionsRow + idx + 1, 1).font = {
        color: { argb: "FF0000FF" },
      };
    });

    // Removed blue background styling for previously calculated fields

    // Autofit columns roughly

    displayHeaders.forEach((c, idx) => {
      const col = template.getColumn(idx + 1);

      col.width = Math.min(Math.max(c.length + 2, 14), 40);
    });

    // No named ranges required; validations use explicit ranges

    res.setHeader(
      "Content-Type",

      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",

      'attachment; filename="invoice_template.xlsx"'
    );

    const arrayBuffer = await wb.xlsx.writeBuffer();

    const nodeBuffer = Buffer.from(arrayBuffer);

    res.status(200).send(nodeBuffer);
  } catch (error) {
    console.error("Error generating Excel template:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to generate Excel template",

      error: error.message,
    });
  }
};
