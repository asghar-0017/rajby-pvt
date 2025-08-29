import fs from "fs";

import path from "path";

import QRCode from "qrcode";

import ejs from "ejs";

import puppeteer from "puppeteer";

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

      transctypeId,

      items,

      status = "posted",

      fbr_invoice_number = null,
    } = req.body;

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

          transctypeId,

          status: "posted", // Always set as posted when using createInvoice

          fbr_invoice_number,
        },

        { transaction: t }
      );

      // Create invoice items if provided

      if (items && Array.isArray(items) && items.length > 0) {
        const invoiceItems = items.map((item) => {
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

            name: cleanValue(item.name),

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

        await InvoiceItem.bulkCreate(invoiceItems, { transaction: t });
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

            name: cleanValue(item.name),

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

            name: cleanValue(item.name),

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

// Bulk create invoices with items (draft status)

export const bulkCreateInvoices = async (req, res) => {
  try {
    const { Invoice, InvoiceItem, Buyer } = req.tenantModels;

    const { invoices } = req.body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({
        success: false,

        message: "Invoices array is required and must not be empty",
      });
    }

    // Limit the number of invoices that can be uploaded at once

    if (invoices.length > 1000) {
      return res.status(400).json({
        success: false,

        message: "Maximum 1000 invoices can be uploaded at once",
      });
    }

    const results = {
      created: [],

      errors: [],

      warnings: [],

      total: invoices.length,
    };

    // Group invoices by row index since invoice_number will be generated by system

    const invoiceGroups = {};

    for (let i = 0; i < invoices.length; i++) {
      const invoiceData = invoices[i];

      // Generate a unique key for each row since invoice_number will be auto-generated

      const rowKey = `row_${i}`;

      if (!invoiceGroups[rowKey]) {
        invoiceGroups[rowKey] = {
          header: invoiceData,

          items: [],

          rowNumbers: [],
        };
      }

      // Extract item data if present

      const itemData = {};

      const itemFields = [
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

      let hasItemData = false;

      itemFields.forEach((field) => {
        const cleanField = field.replace("item_", "");

        if (
          invoiceData[field] !== undefined &&
          invoiceData[field] !== null &&
          invoiceData[field] !== ""
        ) {
          itemData[cleanField] = invoiceData[field];

          hasItemData = true;
        }
      });

      if (hasItemData) {
        invoiceGroups[rowKey].items.push(itemData);
      }

      invoiceGroups[rowKey].rowNumbers.push(i + 1);
    }

    // Process each unique invoice

    for (const [rowKey, group] of Object.entries(invoiceGroups)) {
      let tempInvoiceNumber = null; // Initialize tempInvoiceNumber outside try block

      try {
        const invoiceData = group.header;

        // Always populate seller fields from selected tenant
        try {
          const tenantInfo = req.tenant;
          if (tenantInfo) {
            invoiceData.sellerBusinessName =
              tenantInfo.seller_business_name || "";
            invoiceData.sellerProvince = tenantInfo.seller_province || "";
            invoiceData.sellerAddress = tenantInfo.seller_address || "";
            invoiceData.sellerNTNCNIC = tenantInfo.seller_ntn_cnic || "";
            invoiceData.sellerFullNTN = tenantInfo.seller_full_ntn || "";
          }
        } catch (e) {
          // Non-fatal; proceed with whatever data we have
        }

        console.log(`Processing invoice row ${rowKey}:`, {
          invoiceType: invoiceData.invoiceType,

          sellerBusinessName: invoiceData.sellerBusinessName,

          buyerBusinessName: invoiceData.buyerBusinessName,

          itemsCount: group.items.length,
        });

        // Validate required fields

        if (!invoiceData.invoiceType || !invoiceData.invoiceType.trim()) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: "Invoice type is required",
            });
          });

          continue;
        }

        if (!invoiceData.invoiceDate || !invoiceData.invoiceDate.trim()) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: "Invoice date is required",
            });
          });

          continue;
        }

        if (
          !invoiceData.buyerBusinessName ||
          !invoiceData.buyerBusinessName.trim()
        ) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: "Buyer business name is required",
            });
          });

          continue;
        }

        if (!invoiceData.buyerProvince || !invoiceData.buyerProvince.trim()) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: "Buyer province is required",
            });
          });

          continue;
        }

        // Validate invoice type

        const validInvoiceTypes = ["Sale Invoice", "Debit Note"];

        if (!validInvoiceTypes.includes(invoiceData.invoiceType.trim())) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: 'Invoice type must be "Sale Invoice" or "Debit Note"',
            });
          });

          continue;
        }

        // Validate date format

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (!dateRegex.test(invoiceData.invoiceDate.trim())) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: "Invoice date must be in YYYY-MM-DD format",
            });
          });

          continue;
        }

        // Validate provinces

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
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error:
                "Invalid buyer province. Valid provinces are: Balochistan, Azad Jammu and Kashmir, Capital Territory, Punjab, Khyber Pakhtunkhwa, Gilgit Baltistan, Sindh",
            });
          });

          continue;
        }

        // Validate buyer registration type if provided

        if (
          invoiceData.buyerRegistrationType &&
          invoiceData.buyerRegistrationType.trim()
        ) {
          const validRegistrationTypes = ["Registered", "Unregistered"];

          if (
            !validRegistrationTypes.includes(
              invoiceData.buyerRegistrationType.trim()
            )
          ) {
            group.rowNumbers.forEach((rowNum) => {
              results.errors.push({
                index: group.rowNumbers.indexOf(rowNum),

                row: rowNum,

                error:
                  'Buyer registration type must be "Registered" or "Unregistered"',
              });
            });

            continue;
          }
        }

        // Ensure buyer exists or create automatically; validate NTN/business name conflict
        try {
          if (
            invoiceData.buyerNTNCNIC &&
            String(invoiceData.buyerNTNCNIC).trim()
          ) {
            const ntnTrimmed = String(invoiceData.buyerNTNCNIC).trim();
            const existingBuyer = await Buyer.findOne({
              where: { buyerNTNCNIC: ntnTrimmed },
            });
            if (existingBuyer) {
              const providedName = String(
                invoiceData.buyerBusinessName || ""
              ).trim();
              const existingName = String(
                existingBuyer.buyerBusinessName || ""
              ).trim();
              if (
                providedName &&
                existingName &&
                existingName.toLowerCase() !== providedName.toLowerCase()
              ) {
                group.rowNumbers.forEach((rowNum) => {
                  results.errors.push({
                    index: group.rowNumbers.indexOf(rowNum),
                    row: rowNum,
                    error: "This Buyer already exists",
                  });
                });
                continue;
              }
            } else {
              await Buyer.create({
                buyerNTNCNIC: ntnTrimmed,
                buyerBusinessName: invoiceData.buyerBusinessName || null,
                buyerProvince: invoiceData.buyerProvince || "",
                buyerAddress: invoiceData.buyerAddress || null,
                buyerRegistrationType:
                  invoiceData.buyerRegistrationType || "Unregistered",
              });
            }
          }
        } catch (buyerErr) {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),
              row: rowNum,
              error: `Buyer validation/creation error: ${buyerErr.message}`,
            });
          });
          continue;
        }

        // Server-side FBR registration mismatch check for bulk
        try {
          if (
            invoiceData.buyerNTNCNIC &&
            String(invoiceData.buyerNTNCNIC).trim() &&
            invoiceData.buyerRegistrationType &&
            String(invoiceData.buyerRegistrationType).trim()
          ) {
            const selectedType = String(invoiceData.buyerRegistrationType)
              .trim()
              .toLowerCase();
            if (selectedType === "unregistered") {
              const axios = (await import("axios")).default;
              const upstream = await axios.post(
                "https://buyercheckapi.inplsoftwares.online/checkbuyer.php",
                {
                  token: "89983e4a-c009-3f9b-bcd6-a605c3086709",
                  registrationNo: String(invoiceData.buyerNTNCNIC).trim(),
                },
                {
                  headers: { "Content-Type": "application/json" },
                  timeout: 10000,
                }
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
                group.rowNumbers.forEach((rowNum) => {
                  results.errors.push({
                    index: group.rowNumbers.indexOf(rowNum),
                    row: rowNum,
                    error:
                      "Buyer Registration Type is not correct (FBR: Registered)",
                  });
                });
                continue;
              }
            }
          }
        } catch (fbrErr) {
          // Non-blocking on upstream failure; skip blocking if proxy fails
        }

        // Generate a temporary invoice number for draft (will be replaced when posted to FBR)

        tempInvoiceNumber = await generateShortInvoiceId(
          Invoice,

          "DRAFT"
        );

        // Normalize provinces to title case

        const normalizeProvince = (province) => {
          const provinceMap = {
            PUNJAB: "Punjab",

            SINDH: "Sindh",

            "KHYBER PAKHTUNKHWA": "Khyber Pakhtunkhwa",

            BALOCHISTAN: "Balochistan",

            "CAPITAL TERRITORY": "Capital Territory",

            "GILGIT BALTISTAN": "Gilgit Baltistan",

            "AZAD JAMMU AND KASHMIR": "Azad Jammu and Kashmir",
          };

          return provinceMap[province.trim()] || province.trim();
        };

        // Create invoice with transaction to handle items

        const result = await req.tenantDb.transaction(async (t) => {
          // Generate system invoice ID

          const systemInvoiceId = await generateSystemInvoiceId(Invoice);

          // Create invoice with draft status

          const invoice = await Invoice.create(
            {
              invoice_number: tempInvoiceNumber,

              system_invoice_id: systemInvoiceId,

              invoiceType: invoiceData.invoiceType.trim(),

              invoiceDate: invoiceData.invoiceDate.trim(),

              sellerNTNCNIC: invoiceData.sellerNTNCNIC
                ? invoiceData.sellerNTNCNIC.trim()
                : null,

              sellerFullNTN: invoiceData.sellerFullNTN
                ? invoiceData.sellerFullNTN.trim()
                : null,

              sellerBusinessName: invoiceData.sellerBusinessName.trim(),

              sellerProvince: normalizeProvince(invoiceData.sellerProvince),

              sellerAddress: invoiceData.sellerAddress
                ? invoiceData.sellerAddress.trim()
                : null,

              buyerNTNCNIC: invoiceData.buyerNTNCNIC
                ? invoiceData.buyerNTNCNIC.trim()
                : null,

              buyerBusinessName: invoiceData.buyerBusinessName.trim(),

              buyerProvince: normalizeProvince(invoiceData.buyerProvince),

              buyerAddress: invoiceData.buyerAddress
                ? invoiceData.buyerAddress.trim()
                : null,

              buyerRegistrationType: invoiceData.buyerRegistrationType
                ? invoiceData.buyerRegistrationType.trim()
                : null,

              invoiceRefNo: invoiceData.invoiceRefNo
                ? invoiceData.invoiceRefNo.trim()
                : null,

              companyInvoiceRefNo: invoiceData.companyInvoiceRefNo
                ? invoiceData.companyInvoiceRefNo.trim()
                : null,

              transctypeId: invoiceData.transctypeId
                ? invoiceData.transctypeId.trim()
                : null,

              status: "draft", // Always set as draft for bulk upload

              fbr_invoice_number: null,
            },

            { transaction: t }
          );

          // Create invoice items if provided

          if (group.items && group.items.length > 0) {
            const invoiceItems = group.items.map((item, itemIndex) => {
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

              // Helper function to clean hsCode with length validation
              const cleanHsCode = (value, rowNumber) => {
                const cleaned = cleanValue(value);
                if (cleaned === null) return null;

                const stringValue = String(cleaned);

                // Extract HS code from description if it contains a dash separator
                // Format: "8432.1010 - NUCLEAR REACTOR, BOILERS, MACHINERY AN"
                let hsCode = stringValue;
                if (stringValue.includes(" - ")) {
                  hsCode = stringValue.split(" - ")[0].trim();
                }

                // Check if truncation is needed
                if (hsCode.length > 50) {
                  results.warnings.push({
                    row: rowNumber,
                    field: "hsCode",
                    message: `HS Code truncated from "${hsCode}" to "${hsCode.substring(0, 50)}" (max 50 characters)`,
                  });
                }

                // Truncate to 50 characters to match database field length
                return hsCode.substring(0, 50);
              };

              // Helper function to convert numeric strings to numbers

              const cleanNumericValue = (value) => {
                const cleaned = cleanValue(value);

                if (cleaned === null) return null;

                const num = parseFloat(cleaned);

                return isNaN(num) ? null : num;
              };

              const mappedItem = {
                invoice_id: invoice.id,

                hsCode: cleanHsCode(item.hsCode, group.rowNumbers[0]),

                name: cleanValue(item.name),

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

        console.log(
          `Successfully created invoice ${tempInvoiceNumber} with ${group.items.length} items:`,

          result.toJSON()
        );

        results.created.push(result);
      } catch (error) {
        const errorInvoiceNumber = tempInvoiceNumber || `row_${rowKey}`;
        console.error(`Error creating invoice ${errorInvoiceNumber}:`, error);

        console.error(`Invoice data that failed:`, group.header);

        // Handle specific database errors

        if (error.name === "SequelizeValidationError") {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error:
                "Validation error: " +
                error.errors.map((e) => e.message).join(", "),
            });
          });
        } else if (error.name === "SequelizeUniqueConstraintError") {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: "Duplicate invoice number found",
            });
          });
        } else {
          group.rowNumbers.forEach((rowNum) => {
            results.errors.push({
              index: group.rowNumbers.indexOf(rowNum),

              row: rowNum,

              error: error.message || "Unknown error occurred",
            });
          });
        }
      }
    }

    // Log final summary

    console.log("=== Bulk Invoice Upload Summary ===");

    console.log(`Total invoices processed: ${results.total}`);

    console.log(`Successfully created: ${results.created.length}`);

    console.log(`Failed: ${results.errors.length}`);

    console.log(`Warnings: ${results.warnings.length}`);

    if (results.errors.length > 0) {
      console.log("Errors:");

      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. Row ${error.row}: ${error.error}`);
      });
    }

    if (results.warnings.length > 0) {
      console.log("Warnings:");

      results.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. Row ${warning.row}: ${warning.message}`);
      });
    }

    console.log("=== End Summary ===");

    res.status(200).json({
      success: true,

      message: `Bulk upload completed. ${results.created.length} invoices created as drafts with auto-generated invoice numbers, ${results.errors.length} errors${results.warnings.length > 0 ? `, ${results.warnings.length} warnings` : ""}.`,

      data: {
        created: results.created,

        errors: results.errors,

        warnings: results.warnings,

        summary: {
          total: results.total,

          successful: results.created.length,

          failed: results.errors.length,

          warnings: results.warnings.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk create invoices:", error);

    res.status(500).json({
      success: false,

      message: "Error processing bulk invoice upload",

      error: error.message,
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

            const rates = parsedRates.map((x) => x.desc);

            parsedRates

              .filter((x) => x && x.length > 0)

              .forEach((val) => aggregated.add(val));

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

            parsedRatesNoProv

              .map((x) => x.desc)

              .filter((x) => x && x.length > 0)

              .forEach((val) => aggregated.add(val));

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
      }
    } else {
      // Provide empty rates for all transaction types if we cannot fetch

      for (const tt of transactionTypes) {
        ratesByType[tt.id] = [];

        rateIdDescPairsByType[tt.id] = new Map();
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

    // Fetch SRO schedules per rate id (aggregate across province codes)

    const sroByRateId = {};

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
            }
          } catch (e) {
            // continue
          }
        }

        sroByRateId[id] = aggregated; // Map(desc -> id)
      }
    }

    // Build SRO Item lists per SRO Id (for Excel dropdowns)

    const sroItemsBySroId = {};

    if (token && sroByRateId && Object.keys(sroByRateId).length > 0) {
      // Collect unique SRO Ids across all rates
      const uniqueSroIds = new Set();

      for (const sroMap of Object.values(sroByRateId)) {
        for (const id of sroMap.values()) uniqueSroIds.add(id);
      }

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
        } catch (e) {
          sroItemsBySroId[sroId] = [];
        }
      }
    }

    // Fetch UoM data for HS Codes

    const uomByHsCode = {};

    if (token) {
      try {
        // Get HS Codes first

        const hsCodes = await hsCodeCacheService.getHSCodes(
          "sandbox",

          token,

          false
        );

        if (hsCodes && Array.isArray(hsCodes) && hsCodes.length > 0) {
          // Limit to first 100 HS Codes to avoid performance issues

          const limitedHsCodes = hsCodes.slice(0, 100);

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
                  uomByHsCode[hsCodeValue] = uomResponse

                    .map((uom) => ({
                      uoM_ID: uom.uoM_ID || uom.uom_id || uom.id || "",

                      description: uom.description || uom.desc || "",
                    }))

                    .filter(
                      (uom) => uom.description && uom.description.trim() !== ""
                    );
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
        }
      } catch (error) {
        console.error("Error fetching UoM data:", error);

        // Continue with fallback UoM data
      }
    }

    // Fallback UoM data for common HS Codes

    const fallbackUomData = {
      "0101.10.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0101.90.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0102.10.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0102.90.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0103.10.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0103.91.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0103.92.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0104.10.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0104.20.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0105.11.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      "0105.12.00": [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },
      ],

      // Add more common HS codes as needed

      default: [
        { uoM_ID: "kg", description: "Kilogram" },

        { uoM_ID: "pcs", description: "Pieces" },

        { uoM_ID: "ltr", description: "Litre" },

        { uoM_ID: "mtr", description: "Meter" },

        { uoM_ID: "sqm", description: "Square Meter" },

        { uoM_ID: "cbm", description: "Cubic Meter" },

        { uoM_ID: "ton", description: "Ton" },

        { uoM_ID: "g", description: "Gram" },

        { uoM_ID: "ml", description: "Millilitre" },

        { uoM_ID: "cm", description: "Centimeter" },

        { uoM_ID: "mm", description: "Millimeter" },

        { uoM_ID: "km", description: "Kilometer" },

        { uoM_ID: "doz", description: "Dozen" },

        { uoM_ID: "pair", description: "Pair" },

        { uoM_ID: "set", description: "Set" },

        { uoM_ID: "box", description: "Box" },

        { uoM_ID: "carton", description: "Carton" },

        { uoM_ID: "bottle", description: "Bottle" },

        { uoM_ID: "can", description: "Can" },

        { uoM_ID: "bag", description: "Bag" },

        { uoM_ID: "roll", description: "Roll" },

        { uoM_ID: "sheet", description: "Sheet" },

        { uoM_ID: "unit", description: "Unit" },

        { uoM_ID: "bill_of_lading", description: "Bill of lading" },

        { uoM_ID: "sqy", description: "SqY" },
      ],
    };

    // Merge API UoM data with fallback data

    const allUomData = { ...fallbackUomData, ...uomByHsCode };

    // Build Excel workbook

    const wb = new ExcelJS.Workbook();

    wb.creator = "FBR Sandbox System";

    wb.created = new Date();

    const template = wb.addWorksheet("Template", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Lists sheet removed - no longer generating dropdown data in Excel template

    // Define expected columns (in the same order as CSV uploader expects)
    // Buyer columns removed - will be selected from buyer dropdown during upload

    const columns = [
      "invoiceType",
      "invoiceDate",
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

    template.addRow(columns);

    template.getRow(1).font = { bold: true };

    // Buyer columns were removed - no need to set formatting for non-existent columns
    // Lists sheet content removed - no longer generating dropdown data in Excel template

    // Also project lists into hidden columns on Template to avoid cross-sheet/named-range issues

    const typeListCol = columns.length + 5; // hidden list columns start after visible columns

    const provinceListCol = typeListCol + 1;

    const ttCombinedCol = provinceListCol + 1;

    const hsCodeListCol = ttCombinedCol + 1;

    const uomListCol = hsCodeListCol + 1;

    const allRatesCol = uomListCol + 1;

    const rateDescToIdCol = allRatesCol + 1; // hidden mapping: rate desc

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

    // Create a unified list of all unique rates across all transaction types

    const allRatesSet = new Set();

    for (const tt of transactionTypes) {
      const rates = ratesByType[tt.id] || [];

      rates.forEach((rate) => allRatesSet.add(rate));
    }

    const allRates = Array.from(allRatesSet);

    const allRatesRange = writeHiddenList(allRatesCol, allRates);

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

      // sellerProvince and buyerProvince removed - no longer needed in template

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

      // item_rate list references the per-row horizontal output area

      template.getCell(r, headerIndex("item_rate")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(rateOutputStartCol)}$${r}:$${getColLetter(
            rateOutputStartCol + maxRatesPerType - 1
          )}$${r}`,
        ],

        showErrorMessage: true,
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

      // item_sroScheduleNo dropdown

      template.getCell(r, headerIndex("item_sroScheduleNo")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(sroOutputStartCol)}$${r}:$${getColLetter(
            sroOutputStartCol + maxSroPerRate - 1
          )}$${r}`,
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

      // item_sroItemSerialNo dropdown

      template.getCell(r, headerIndex("item_sroItemSerialNo")).dataValidation =
        {
          type: "list",
          allowBlank: true,
          formulae: [
            `$${getColLetter(sroItemOutputStartCol)}$${r}:$${getColLetter(
              sroItemOutputStartCol + maxSroItemsPerSro - 1
            )}$${r}`,
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

      // buyerRegistrationType removed - no longer needed in template

      // item_hsCode - HSCode dropdown

      template.getCell(r, headerIndex("item_hsCode")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(hsCodeListCol)}$${hsCodeListRange.startRow}:$${getColLetter(hsCodeListCol)}$${hsCodeListRange.endRow}`,
        ],

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid HS Code",

        error: "Select a valid HS Code from the dropdown list.",
      };

      // item_uoM - UoM dropdown (dynamic based on selected HS Code)

      template.getCell(r, headerIndex("item_uoM")).dataValidation = {
        type: "list",

        allowBlank: true,

        formulae: [
          `$${getColLetter(uomOutputStartCol)}$${r}:$${getColLetter(
            uomOutputStartCol + maxUomPerHsCode - 1
          )}$${r}`,
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

      // item_fixedNotifiedValueOrRetailPrice - must be positive number

      template.getCell(
        r,

        headerIndex("item_fixedNotifiedValueOrRetailPrice")
      ).dataValidation = {
        type: "decimal",

        operator: "greaterThan",

        formulae: [0],

        allowBlank: true,

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid Retail Price",

        error: "Retail price must be a positive number.",
      };

      // item_discount - must be between 0 and 100

      template.getCell(r, headerIndex("item_discount")).dataValidation = {
        type: "decimal",

        operator: "between",

        formulae: [0, 100],

        allowBlank: true,

        showErrorMessage: true,

        errorStyle: "warning",

        errorTitle: "Invalid Discount",

        error: "Discount must be between 0 and 100 percent.",
      };

      // Auto-calculate Unit Price as Retail Price ÷ Quantity; leave other calculated cells empty
      const qtyColLetter = getColLetter(headerIndex("item_quantity"));
      const retailColLetter = getColLetter(
        headerIndex("item_fixedNotifiedValueOrRetailPrice")
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
      // Auto-copy Value Sales (Excl. ST) from Retail Price; blank if Retail Price is blank
      template.getCell(r, headerIndex("item_valueSalesExcludingST")).value = {
        formula: `IF($${retailColLetter}${r}="","",$${retailColLetter}${r})`,
      };
      // Auto-calculate Sales Tax Applicable = Retail Price × (Rate ÷ 100)
      const rateColLetter = getColLetter(headerIndex("item_rate"));
      template.getCell(r, headerIndex("item_salesTaxApplicable")).value = {
        formula: `IF($${retailColLetter}${r}="","",
IF($${rateColLetter}${r}="","",
IF(ISNUMBER(SEARCH("exempt",LOWER($${rateColLetter}${r}))),0,
$${retailColLetter}${r}*(VALUE(SUBSTITUTE($${rateColLetter}${r},"%",""))/100))))`,
      };
      // Auto-calculate Total Values = (Value Excl. ST + Sales Tax + FED + ST W/H + Further Tax) minus Discount%
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
SUM($${vsColLetter}${r},$${staColLetter}${r},$${fedColLetter}${r},$${stwColLetter}${r},$${ftrColLetter}${r})*
(1-IF($${dscColLetter}${r}="",0,VALUE($${dscColLetter}${r})/100)))`,
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
      "1. Unit Price auto-calculates as Retail Price ÷ Quantity.",
      "2. Value Sales (Excl. ST) auto-copies from Retail Price.",
      "3. Sales Tax Applicable auto-calculates: Retail Price × (rate ÷ 100).",
      "4. Total Values = (Value Excl. ST + Sales Tax + FED + ST W/H + Further Tax) minus Discount%.",
      "5. Enter Quantity and Retail Price to compute Unit Price.",
      "6. Use the dropdowns for validated selections (HS Code, UoM, Rate, etc.)",
    ];

    instructions.forEach((instruction, idx) => {
      template.getCell(instructionsRow + idx + 1, 1).value = instruction;

      template.getCell(instructionsRow + idx + 1, 1).font = {
        color: { argb: "FF0000FF" },
      };
    });

    // Removed blue background styling for previously calculated fields

    // Autofit columns roughly

    columns.forEach((c, idx) => {
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
