// Buyer controller for multi-tenant MySQL system
// This controller uses req.tenantModels.Buyer from tenant middleware

import { logAuditEvent } from "../../middleWare/auditMiddleware.js";

// Helper function to normalize NTN (remove dashes, keep 7 alphanumeric characters)
const normalizeNTN = (ntn) => {
  if (!ntn) return null;
  
  // Remove spaces, dashes, and other special characters but keep alphanumeric
  const cleaned = ntn.replace(/[\s\-]/g, "").trim();
  
  // If it's all digits (common case), take first 7 digits
  if (/^\d+$/.test(cleaned)) {
    return cleaned.length >= 7 ? cleaned.substring(0, 7) : cleaned;
  }
  
  // If it has letters (like A917166, E146838, F655242), keep as-is up to 7 chars
  // Just take the first 7 alphanumeric characters
  return cleaned.substring(0, Math.min(7, cleaned.length));
};

// Helper function to normalize province to uppercase for consistency
const normalizeProvince = (province) => {
  const provinceMap = {
    Punjab: "PUNJAB",
    Sindh: "SINDH",
    "Khyber Pakhtunkhwa": "KHYBER PAKHTUNKHWA",
    Balochistan: "BALOCHISTAN",
    "Capital Territory": "CAPITAL TERRITORY",
    "Gilgit Baltistan": "GILGIT BALTISTAN",
    "Azad Jammu and Kashmir": "AZAD JAMMU AND KASHMIR",
    // Also handle any mixed case variations
    punjab: "PUNJAB",
    sindh: "SINDH",
    "khyber pakhtunkhwa": "KHYBER PAKHTUNKHWA",
    balochistan: "BALOCHISTAN",
    "capital territory": "CAPITAL TERRITORY",
    "gilgit baltistan": "GILGIT BALTISTAN",
    "azad jammu and kashmir": "AZAD JAMMU AND KASHMIR",
  };
  const trimmedProvince = province.trim();
  return provinceMap[trimmedProvince] || trimmedProvince.toUpperCase();
};

// Helper function to normalize string for comparison (trim and lowercase)
const normalizeForComparison = (str) => {
  return str ? String(str).trim().toLowerCase() : null;
};

// Create new buyer
export const createBuyer = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const {
      buyerId,
      buyerMainName,
      buyerNTNCNIC,
      buyerBusinessName,
      buyerProvince,
      buyerAddress,
      buyerRegistrationType,
      buyerTelephone,
    } = req.body;

    console.log("=== CREATE BUYER DEBUG ===");
    console.log("Request body:", req.body);
    console.log("buyerTelephone:", buyerTelephone);
    console.log("=== END CREATE BUYER DEBUG ===");

    // Validate required fields
    if (!buyerProvince || !buyerRegistrationType) {
      return res.status(400).json({
        success: false,
        message: "Buyer province and registration type are required",
      });
    }

    // Normalize NTN (remove dashes, keep only 7 digits)
    let normalizedNTN = buyerNTNCNIC;
    if (buyerNTNCNIC) {
      normalizedNTN = normalizeNTN(buyerNTNCNIC);
    }

    // Validate NTN/CNIC length
    if (normalizedNTN) {
      const trimmedNTNCNIC = normalizedNTN.trim();
      if (trimmedNTNCNIC.length === 13) {
        // CNIC: exactly 13 digits
        if (!/^\d{13}$/.test(trimmedNTNCNIC)) {
          return res.status(400).json({
            success: false,
            message: "CNIC must contain exactly 13 digits.",
          });
        }
      } else if (trimmedNTNCNIC.length === 7) {
        // NTN: exactly 7 alphanumeric characters (can include letters)
        if (!/^[a-zA-Z0-9]{7}$/.test(trimmedNTNCNIC)) {
          return res.status(400).json({
            success: false,
            message: "NTN must contain exactly 7 alphanumeric characters.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message:
            "NTN must be 7 alphanumeric characters or CNIC must be 13 digits long.",
        });
      }
    }

    const normalizedProvince = normalizeProvince(buyerProvince);

    // Normalize values for comparison
    const normalizedBuyerId = normalizeForComparison(buyerId);
    const normalizedBuyerMainName = normalizeForComparison(buyerMainName);
    const normalizedBuyerBusinessName = normalizeForComparison(buyerBusinessName);
    const normalizedBuyerAddress = normalizeForComparison(buyerAddress);
    const normalizedBuyerProvince = normalizeForComparison(normalizedProvince);
    const normalizedBuyerNTN = normalizeForComparison(normalizedNTN);

    // Check for composite key match (all fields must match)
    // Fetch all buyers and compare in memory for accurate composite key matching
    const existingBuyers = await Buyer.findAll({
      attributes: [
        "id",
        "buyerId",
        "buyerMainName",
        "buyerNTNCNIC",
        "buyerBusinessName",
        "buyerProvince",
        "buyerAddress",
      ],
    });

    // Check if any existing buyer matches ALL provided fields
    const duplicateBuyer = existingBuyers.find((existing) => {
      const existingBuyerId = normalizeForComparison(existing.buyerId);
      const existingBuyerMainName = normalizeForComparison(existing.buyerMainName);
      const existingBuyerBusinessName = normalizeForComparison(existing.buyerBusinessName);
      const existingBuyerAddress = normalizeForComparison(existing.buyerAddress);
      const existingBuyerProvince = normalizeForComparison(existing.buyerProvince);
      const existingBuyerNTN = normalizeForComparison(existing.buyerNTNCNIC);

      // Check if all provided fields match
      const idMatch = !normalizedBuyerId || existingBuyerId === normalizedBuyerId;
      const mainNameMatch = !normalizedBuyerMainName || existingBuyerMainName === normalizedBuyerMainName;
      const businessNameMatch = !normalizedBuyerBusinessName || existingBuyerBusinessName === normalizedBuyerBusinessName;
      const addressMatch = !normalizedBuyerAddress || existingBuyerAddress === normalizedBuyerAddress;
      const provinceMatch = !normalizedBuyerProvince || existingBuyerProvince === normalizedBuyerProvince;
      const ntnMatch = !normalizedBuyerNTN || existingBuyerNTN === normalizedBuyerNTN;

      return idMatch && mainNameMatch && businessNameMatch && addressMatch && provinceMatch && ntnMatch;
    });

    if (duplicateBuyer) {
      return res.status(409).json({
        success: false,
        message: "Duplicate buyer: A buyer with the same details already exists.",
      });
    }

    // Create buyer
    const buyer = await Buyer.create({
      buyerId: buyerId || null,
      buyerMainName: buyerMainName || null,
      buyerNTNCNIC: normalizedNTN, // Use normalized NTN (no dashes, 7 digits)
      buyerBusinessName,
      buyerProvince: normalizedProvince,
      buyerAddress,
      buyerRegistrationType,
      buyerTelephone,
      created_by_user_id: req.user?.userId || req.user?.id || null,
      created_by_email: req.user?.email || null,
      created_by_name:
        req.user?.firstName || req.user?.lastName
          ? `${req.user?.firstName ?? ""}${req.user?.lastName ? ` ${req.user.lastName}` : ""}`.trim()
          : req.user?.role === "admin"
            ? `Admin (${req.user?.id || req.user?.userId})`
            : null,
    });

    // Log audit event for buyer creation
    await logAuditEvent(
      req,
      "buyer",
      buyer.id,
      "CREATE",
      null, // oldValues
      {
        id: buyer.id,
        buyerNTNCNIC: buyer.buyerNTNCNIC,
        buyerBusinessName: buyer.buyerBusinessName,
        buyerProvince: buyer.buyerProvince,
        buyerAddress: buyer.buyerAddress,
        buyerRegistrationType: buyer.buyerRegistrationType,
        created_by_user_id: buyer.created_by_user_id,
        created_by_email: buyer.created_by_email,
        created_by_name: buyer.created_by_name,
      }, // newValues
      {
        entityName: buyer.buyerBusinessName || buyer.buyerNTNCNIC,
      }
    );

    res.status(201).json({
      success: true,
      message: "Buyer created successfully",
      data: buyer,
    });
  } catch (error) {
    console.error("Error creating buyer:", error);

    // Handle specific database errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => e.message),
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Buyer with this NTN/CNIC already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating buyer",
      error: error.message,
    });
  }
};

// Get all buyers
export const getAllBuyers = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { page = 1, limit = 10, search } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[req.tenantDb.Sequelize.Op.or] = [
        { buyerId: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { buyerMainName: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { buyerNTNCNIC: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        {
          buyerBusinessName: {
            [req.tenantDb.Sequelize.Op.like]: `%${search}%`,
          },
        },
        { buyerProvince: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Buyer.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        buyers: rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          total_records: count,
          records_per_page: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting buyers:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving buyers",
      error: error.message,
    });
  }
};

// Get all buyers without pagination (for dropdowns)
export const getAllBuyersWithoutPagination = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { search } = req.query;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[req.tenantDb.Sequelize.Op.or] = [
        { buyerId: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { buyerMainName: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { buyerNTNCNIC: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        {
          buyerBusinessName: {
            [req.tenantDb.Sequelize.Op.like]: `%${search}%`,
          },
        },
        { buyerProvince: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    const buyers = await Buyer.findAll({
      where: whereClause,
      order: [["buyerBusinessName", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        buyers: buyers,
        total_records: buyers.length,
      },
    });
  } catch (error) {
    console.error("Error getting all buyers:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving buyers",
      error: error.message,
    });
  }
};

// Get buyer by ID
export const getBuyerById = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: buyer,
    });
  } catch (error) {
    console.error("Error getting buyer:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving buyer",
      error: error.message,
    });
  }
};

// Update buyer
export const updateBuyer = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { id } = req.params;
    const {
      buyerId,
      buyerMainName,
      buyerNTNCNIC,
      buyerBusinessName,
      buyerProvince,
      buyerAddress,
      buyerRegistrationType,
      buyerTelephone,
    } = req.body;

    console.log("=== UPDATE BUYER DEBUG ===");
    console.log("Request body:", req.body);
    console.log("buyerTelephone:", buyerTelephone);
    console.log("=== END UPDATE BUYER DEBUG ===");

    const buyer = await Buyer.findByPk(id);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    // Normalize NTN (remove dashes, keep 7 alphanumeric characters)
    let normalizedNTN = buyerNTNCNIC;
    if (buyerNTNCNIC) {
      normalizedNTN = normalizeNTN(buyerNTNCNIC);
    }

    // Validate NTN/CNIC length
    if (normalizedNTN) {
      const trimmedNTNCNIC = normalizedNTN.trim();
      if (trimmedNTNCNIC.length === 13) {
        // CNIC: exactly 13 digits
        if (!/^\d{13}$/.test(trimmedNTNCNIC)) {
          return res.status(400).json({
            success: false,
            message: "CNIC must contain exactly 13 digits.",
          });
        }
      } else if (trimmedNTNCNIC.length === 7) {
        // NTN: exactly 7 alphanumeric characters (can include letters)
        if (!/^[a-zA-Z0-9]{7}$/.test(trimmedNTNCNIC)) {
          return res.status(400).json({
            success: false,
            message: "NTN must contain exactly 7 alphanumeric characters.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message:
            "NTN must be 7 alphanumeric characters or CNIC must be 13 digits long.",
        });
      }
    }

    const normalizedProvince = normalizeProvince(buyerProvince);

    // Normalize values for comparison
    const normalizedBuyerId = normalizeForComparison(buyerId);
    const normalizedBuyerMainName = normalizeForComparison(buyerMainName);
    const normalizedBuyerBusinessName = normalizeForComparison(buyerBusinessName);
    const normalizedBuyerAddress = normalizeForComparison(buyerAddress);
    const normalizedBuyerProvince = normalizeForComparison(normalizedProvince);
    const normalizedBuyerNTN = normalizeForComparison(normalizedNTN);

    // Check for composite key match (all fields must match) - exclude current buyer
    // Fetch all buyers and compare in memory for accurate composite key matching
    const existingBuyers = await Buyer.findAll({
      where: {
        id: { [req.tenantDb.Sequelize.Op.ne]: id }, // Exclude current buyer from check
      },
      attributes: [
        "id",
        "buyerId",
        "buyerMainName",
        "buyerNTNCNIC",
        "buyerBusinessName",
        "buyerProvince",
        "buyerAddress",
      ],
    });

    // Check if any existing buyer matches ALL provided fields
    const duplicateBuyer = existingBuyers.find((existing) => {
      const existingBuyerId = normalizeForComparison(existing.buyerId);
      const existingBuyerMainName = normalizeForComparison(existing.buyerMainName);
      const existingBuyerBusinessName = normalizeForComparison(existing.buyerBusinessName);
      const existingBuyerAddress = normalizeForComparison(existing.buyerAddress);
      const existingBuyerProvince = normalizeForComparison(existing.buyerProvince);
      const existingBuyerNTN = normalizeForComparison(existing.buyerNTNCNIC);

      // Check if all provided fields match
      const idMatch = !normalizedBuyerId || existingBuyerId === normalizedBuyerId;
      const mainNameMatch = !normalizedBuyerMainName || existingBuyerMainName === normalizedBuyerMainName;
      const businessNameMatch = !normalizedBuyerBusinessName || existingBuyerBusinessName === normalizedBuyerBusinessName;
      const addressMatch = !normalizedBuyerAddress || existingBuyerAddress === normalizedBuyerAddress;
      const provinceMatch = !normalizedBuyerProvince || existingBuyerProvince === normalizedBuyerProvince;
      const ntnMatch = !normalizedBuyerNTN || existingBuyerNTN === normalizedBuyerNTN;

      return idMatch && mainNameMatch && businessNameMatch && addressMatch && provinceMatch && ntnMatch;
    });

    if (duplicateBuyer) {
      return res.status(409).json({
        success: false,
        message: "Duplicate buyer: A buyer with the same details already exists.",
      });
    }

    // Capture old values for audit
    const oldValues = {
      id: buyer.id,
      buyerNTNCNIC: buyer.buyerNTNCNIC,
      buyerBusinessName: buyer.buyerBusinessName,
      buyerProvince: buyer.buyerProvince,
      buyerAddress: buyer.buyerAddress,
      buyerRegistrationType: buyer.buyerRegistrationType,
    };

    await buyer.update({
      buyerId: buyerId || null,
      buyerMainName: buyerMainName || null,
      buyerNTNCNIC: normalizedNTN, // Use normalized NTN (no dashes, 7 digits)
      buyerBusinessName,
      buyerProvince: normalizedProvince,
      buyerAddress,
      buyerRegistrationType,
      buyerTelephone,
    });

    // Log audit event for buyer update
    await logAuditEvent(
      req,
      "buyer",
      buyer.id,
      "UPDATE",
      oldValues, // oldValues
      {
        id: buyer.id,
        buyerNTNCNIC: buyer.buyerNTNCNIC,
        buyerBusinessName: buyer.buyerBusinessName,
        buyerProvince: buyer.buyerProvince,
        buyerAddress: buyer.buyerAddress,
        buyerRegistrationType: buyer.buyerRegistrationType,
      }, // newValues
      {
        entityName: buyer.buyerBusinessName || buyer.buyerNTNCNIC,
      }
    );

    res.status(200).json({
      success: true,
      message: "Buyer updated successfully",
      data: buyer,
    });
  } catch (error) {
    console.error("Error updating buyer:", error);

    // Handle specific database errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => e.message),
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Buyer with this NTN/CNIC already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating buyer",
      error: error.message,
    });
  }
};

// Delete buyer
export const deleteBuyer = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    // Capture buyer data before deletion for audit
    const buyerData = {
      id: buyer.id,
      buyerNTNCNIC: buyer.buyerNTNCNIC,
      buyerBusinessName: buyer.buyerBusinessName,
      buyerProvince: buyer.buyerProvince,
      buyerAddress: buyer.buyerAddress,
      buyerRegistrationType: buyer.buyerRegistrationType,
      created_by_user_id: buyer.created_by_user_id,
      created_by_email: buyer.created_by_email,
      created_by_name: buyer.created_by_name,
    };

    await buyer.destroy();

    // Log audit event for buyer deletion
    await logAuditEvent(
      req,
      "buyer",
      buyerData.id,
      "DELETE",
      buyerData, // oldValues
      null, // newValues
      {
        entityName: buyerData.buyerBusinessName || buyerData.buyerNTNCNIC,
      }
    );

    res.status(200).json({
      success: true,
      message: "Buyer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting buyer:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting buyer",
      error: error.message,
    });
  }
};

// Get buyers by province
export const getBuyersByProvince = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { province } = req.params;

    const buyers = await Buyer.findAll({
      where: { buyerProvince: province },
      order: [["buyerBusinessName", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: buyers,
    });
  } catch (error) {
    console.error("Error getting buyers by province:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving buyers by province",
      error: error.message,
    });
  }
};

// Bulk create buyers - ULTRA OPTIMIZED VERSION
export const bulkCreateBuyers = async (req, res) => {
  const startTime = process.hrtime.bigint();

  try {
    const { Buyer } = req.tenantModels;
    const { buyers } = req.body;

    if (!Array.isArray(buyers) || buyers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Buyers array is required and must not be empty",
      });
    }

    console.log(
      `🚀 Starting ULTRA-OPTIMIZED bulk upload for ${buyers.length} buyers...`
    );

    const results = {
      created: [],
      errors: [],
      total: buyers.length,
    };

    // PHASE 1: Pre-validation (in memory - fastest)
    console.log("🔍 Phase 1: Pre-validating all buyers...");
    const validBuyers = [];
    const validationErrors = [];

    // Batch validation for maximum speed
    buyers.forEach((buyerData, index) => {
      const rowErrors = [];

      // Quick validation checks
      if (!buyerData.buyerProvince || !buyerData.buyerProvince.trim()) {
        rowErrors.push("Province is required");
      }

      if (
        !buyerData.buyerRegistrationType ||
        !buyerData.buyerRegistrationType.trim()
      ) {
        rowErrors.push("Registration Type is required");
      }

      // Province validation with Set for O(1) lookup
      const validProvinces = new Set([
        "Balochistan",
        "BALOCHISTAN",
        "balochistan",
        "Azad Jammu and Kashmir",
        "AZAD JAMMU AND KASHMIR",
        "azad jammu and kashmir",
        "Capital Territory",
        "CAPITAL TERRITORY",
        "capital territory",
        "Punjab",
        "PUNJAB",
        "punjab",
        "Khyber Pakhtunkhwa",
        "KHYBER PAKHTUNKHWA",
        "khyber pakhtunkhwa",
        "Gilgit Baltistan",
        "GILGIT BALTISTAN",
        "gilgit baltistan",
        "Sindh",
        "SINDH",
        "sindh",
      ]);

      if (
        buyerData.buyerProvince &&
        !validProvinces.has(buyerData.buyerProvince.trim())
      ) {
        rowErrors.push("Invalid province");
      }

      // Registration type validation
      const validTypes = new Set(["Registered", "Unregistered"]);
      if (
        buyerData.buyerRegistrationType &&
        !validTypes.has(buyerData.buyerRegistrationType.trim())
      ) {
        rowErrors.push(
          'Registration Type must be "Registered" or "Unregistered"'
        );
      }

      // Normalize NTN (remove dashes, keep only 7 digits)
      let normalizedNTN = null;
      if (buyerData.buyerNTNCNIC && buyerData.buyerNTNCNIC.trim()) {
        normalizedNTN = normalizeNTN(buyerData.buyerNTNCNIC);
        // Validate NTN/CNIC length after normalization
        if (normalizedNTN) {
          if (normalizedNTN.length === 13) {
            // CNIC: exactly 13 digits
            if (!/^\d{13}$/.test(normalizedNTN)) {
              rowErrors.push("CNIC must contain exactly 13 digits");
            }
          } else if (normalizedNTN.length === 7) {
            // NTN: exactly 7 alphanumeric characters (can include letters)
            if (!/^[a-zA-Z0-9]{7}$/.test(normalizedNTN)) {
              rowErrors.push("NTN must contain exactly 7 alphanumeric characters");
            }
          } else {
            rowErrors.push("NTN must be 7 alphanumeric characters or CNIC must be 13 digits long");
          }
        }
      }

      if (rowErrors.length > 0) {
        validationErrors.push({
          index,
          row: index + 1,
          buyerId: buyerData.buyerId,
          buyerName: buyerData.buyerBusinessName,
          ntn: normalizedNTN,
          error: rowErrors.join(", "),
        });
      } else {
        validBuyers.push({
          ...buyerData,
          index,
          normalizedProvince: normalizeProvince(buyerData.buyerProvince),
          normalizedNTN: normalizedNTN || null,
        });
      }
    });

    // PHASE 2: Batch duplicate checking using composite key
    console.log("🔍 Phase 2: Checking for existing buyers (composite key check)...");
    
    // Get all existing buyers to check against (we'll filter in memory for composite key matching)
    const existingBuyers = await Buyer.findAll({
      attributes: [
        "id",
        "buyerId",
        "buyerMainName",
        "buyerNTNCNIC",
        "buyerBusinessName",
        "buyerProvince",
        "buyerAddress",
      ],
      raw: true,
      benchmark: false,
      logging: false,
    });

    // Filter out existing buyers and duplicates within batch using composite key
    const finalBuyers = [];
    const seenCompositeKeys = new Set();

    validBuyers.forEach((buyer) => {
      // Normalize values for comparison
      const normalizedBuyerId = normalizeForComparison(buyer.buyerId);
      const normalizedBuyerMainName = normalizeForComparison(buyer.buyerMainName);
      const normalizedBuyerBusinessName = normalizeForComparison(buyer.buyerBusinessName);
      const normalizedBuyerAddress = normalizeForComparison(buyer.buyerAddress);
      const normalizedBuyerProvince = normalizeForComparison(buyer.normalizedProvince);
      const normalizedBuyerNTN = normalizeForComparison(buyer.normalizedNTN);

      // Create composite key string for duplicate detection within batch
      const compositeKey = JSON.stringify({
        buyerId: normalizedBuyerId,
        buyerMainName: normalizedBuyerMainName,
        buyerBusinessName: normalizedBuyerBusinessName,
        buyerAddress: normalizedBuyerAddress,
        buyerProvince: normalizedBuyerProvince,
        buyerNTNCNIC: normalizedBuyerNTN,
      });

      // Check for duplicates within the batch
      if (seenCompositeKeys.has(compositeKey)) {
        results.errors.push({
          index: buyer.index,
          row: buyer.index + 1,
          buyerId: buyer.buyerId,
          buyerName: buyer.buyerBusinessName,
          ntn: buyer.normalizedNTN,
          error: "Duplicate buyer found in upload file (all fields match)",
        });
        return;
      }

      // Check against existing buyers in database
      const duplicateBuyer = existingBuyers.find((existing) => {
        const existingBuyerId = normalizeForComparison(existing.buyerId);
        const existingBuyerMainName = normalizeForComparison(existing.buyerMainName);
        const existingBuyerBusinessName = normalizeForComparison(existing.buyerBusinessName);
        const existingBuyerAddress = normalizeForComparison(existing.buyerAddress);
        const existingBuyerProvince = normalizeForComparison(existing.buyerProvince);
        const existingBuyerNTN = normalizeForComparison(existing.buyerNTNCNIC);

        // Check if all provided fields match
        const idMatch = !normalizedBuyerId || existingBuyerId === normalizedBuyerId;
        const mainNameMatch = !normalizedBuyerMainName || existingBuyerMainName === normalizedBuyerMainName;
        const businessNameMatch = !normalizedBuyerBusinessName || existingBuyerBusinessName === normalizedBuyerBusinessName;
        const addressMatch = !normalizedBuyerAddress || existingBuyerAddress === normalizedBuyerAddress;
        const provinceMatch = !normalizedBuyerProvince || existingBuyerProvince === normalizedBuyerProvince;
        const ntnMatch = !normalizedBuyerNTN || existingBuyerNTN === normalizedBuyerNTN;

        return idMatch && mainNameMatch && businessNameMatch && addressMatch && provinceMatch && ntnMatch;
      });

      if (duplicateBuyer) {
        results.errors.push({
          index: buyer.index,
          row: buyer.index + 1,
          buyerId: buyer.buyerId,
          buyerName: buyer.buyerBusinessName,
          ntn: buyer.normalizedNTN,
          error: "Duplicate buyer: A buyer with the same details already exists in database",
        });
        return;
      }

      // Add to seen set and final buyers list
      seenCompositeKeys.add(compositeKey);

      finalBuyers.push({
        buyerId: buyer.buyerId?.trim() || null,
        buyerMainName: buyer.buyerMainName?.trim() || null,
        buyerNTNCNIC: buyer.normalizedNTN || null, // Use normalized NTN (no dashes, 7 digits)
        buyerBusinessName: buyer.buyerBusinessName?.trim() || null,
        buyerProvince: buyer.normalizedProvince,
        buyerAddress: buyer.buyerAddress?.trim() || null,
        buyerRegistrationType: buyer.buyerRegistrationType.trim(),
        buyerTelephone: buyer.buyerTelephone?.trim() || null,
        created_by_user_id: req.user?.userId || req.user?.id || null,
        created_by_email: req.user?.email || null,
        created_by_name:
          req.user?.firstName || req.user?.lastName
            ? `${req.user?.firstName ?? ""}${req.user?.lastName ? ` ${req.user.lastName}` : ""}`.trim()
            : req.user?.role === "admin"
              ? `Admin (${req.user?.id || req.user?.userId})`
              : null,
      });
    });

    // PHASE 3: Ultra-fast bulk insert with chunking
    console.log(`🚀 Phase 3: Bulk inserting ${finalBuyers.length} buyers...`);

    if (finalBuyers.length > 0) {
      try {
        // Use bulkCreate with optimized settings
        const createdBuyers = await Buyer.bulkCreate(finalBuyers, {
          validate: false, // Skip validation since we already did it
          ignoreDuplicates: false, // We handle duplicates manually, don't ignore them
          benchmark: false,
          logging: false,
          returning: true,
          // Process in chunks for optimal performance
          chunkSize: 1000, // Larger chunks for better performance
        });

        // Filter out records that weren't actually inserted (have null ID)
        const successfullyCreated = createdBuyers.filter(buyer => buyer.id !== null);
        const failedToCreate = createdBuyers.filter(buyer => buyer.id === null);

        // Add failed insertions to errors
        failedToCreate.forEach((buyer, idx) => {
          // Find the original index in the buyers array
          const originalBuyer = finalBuyers.find(fb => 
            fb.buyerId === buyer.buyerId && 
            fb.buyerNTNCNIC === buyer.buyerNTNCNIC
          );
          
          if (originalBuyer) {
            results.errors.push({
              row: "Unknown",
              buyerId: buyer.buyerId,
              buyerName: buyer.buyerBusinessName,
              error: "Failed to insert into database - possible unique constraint violation",
            });
          }
        });

        results.created = successfullyCreated;
      } catch (error) {
        console.error("Error during bulk insert:", error);
        
        // If bulk insert fails completely, add all as errors
        finalBuyers.forEach((buyer, idx) => {
          results.errors.push({
            row: "Unknown",
            buyerId: buyer.buyerId,
            buyerName: buyer.buyerBusinessName,
            error: `Database error: ${error.message}`,
          });
        });
      }
    }

    // Add validation errors
    results.errors.push(...validationErrors);

    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    console.log(
      `🎉 ULTRA-OPTIMIZED bulk upload completed in ${totalTime.toFixed(2)}ms!`
    );
    console.log(
      `📊 Results: ${results.created.length} created, ${results.errors.length} errors`
    );

    res.status(200).json({
      success: true,
      message: `Ultra-optimized bulk upload completed in ${totalTime.toFixed(2)}ms. ${results.created.length} buyers created, ${results.errors.length} errors.`,
      data: {
        created: results.created,
        errors: results.errors,
        summary: {
          total: results.total,
          successful: results.created.length,
          failed: results.errors.length,
          processingTime: totalTime.toFixed(2) + "ms",
        },
      },
    });
  } catch (error) {
    console.error("Error in ultra-optimized bulk create buyers:", error);
    res.status(500).json({
      success: false,
      message: "Error processing ultra-optimized bulk buyer upload",
      error: error.message,
    });
  }
};

// Check existing buyers for preview
export const checkExistingBuyers = async (req, res) => {
  try {
    const { Buyer } = req.tenantModels;
    const { buyers } = req.body;

    if (!Array.isArray(buyers) || buyers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Buyers array is required and must not be empty",
      });
    }

    // No limit on the number of buyers that can be checked at once
    // Users can now check unlimited buyers

    const results = {
      existing: [],
      new: [],
      total: buyers.length,
    };

    // Extract all NTN/CNIC values for batch checking
    const ntnCnicValues = buyers
      .map((buyer, index) => ({
        ntnCnic: buyer.buyerNTNCNIC?.trim(),
        index,
        buyerData: buyer,
      }))
      .filter((item) => item.ntnCnic); // Only check buyers with NTN/CNIC

    if (ntnCnicValues.length > 0) {
      // Ultra-optimized batch query using IN clause with indexed field
      // This will use the unique index on buyerNTNCNIC for O(1) lookups
      const existingBuyers = await Buyer.findAll({
        where: {
          buyerNTNCNIC: ntnCnicValues.map((item) => item.ntnCnic),
        },
        attributes: ["buyerNTNCNIC", "buyerBusinessName"], // Only fetch what we need
        raw: true, // Use raw queries for maximum performance
        benchmark: false, // Disable benchmarking
        logging: false, // Disable query logging for performance
        // Force index usage for maximum performance (temporarily disabled until index issue is resolved)
        // indexHints: [{ type: 'USE', values: ['idx_buyer_ntn_cnic'] }]
      });

      const existingNtnCnicSet = new Set(
        existingBuyers.map((buyer) => buyer.buyerNTNCNIC)
      );

      // Categorize buyers
      buyers.forEach((buyer, index) => {
        const ntnCnic = buyer.buyerNTNCNIC?.trim();

        if (ntnCnic && existingNtnCnicSet.has(ntnCnic)) {
          const existingBuyer = existingBuyers.find(
            (b) => b.buyerNTNCNIC === ntnCnic
          );
          results.existing.push({
            index,
            row: index + 1,
            buyerData: buyer,
            existingBuyer: {
              buyerNTNCNIC: existingBuyer.buyerNTNCNIC,
              buyerBusinessName: existingBuyer.buyerBusinessName,
            },
          });
        } else {
          results.new.push({
            index,
            row: index + 1,
            buyerData: buyer,
          });
        }
      });
    } else {
      // If no NTN/CNIC values, all buyers are considered new
      buyers.forEach((buyer, index) => {
        results.new.push({
          index,
          row: index + 1,
          buyerData: buyer,
        });
      });
    }

    res.status(200).json({
      success: true,
      data: {
        existing: results.existing,
        new: results.new,
        summary: {
          total: results.total,
          existing: results.existing.length,
          new: results.new.length,
        },
      },
    });
  } catch (error) {
    console.error("Error checking existing buyers:", error);
    res.status(500).json({
      success: false,
      message: "Error checking existing buyers",
      error: error.message,
    });
  }
};

// Bulk check FBR registration status for multiple buyers - ULTRA OPTIMIZED VERSION
export const bulkCheckFBRRegistration = async (req, res) => {
  const startTime = process.hrtime.bigint();

  try {
    const { buyers } = req.body;

    if (!Array.isArray(buyers) || buyers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Buyers array is required and must not be empty",
      });
    }

    console.log(
      `🚀 Starting ULTRA-OPTIMIZED FBR registration check for ${buyers.length} buyers...`
    );

    // Filter out buyers without NTN/CNIC
    const buyersWithNTN = buyers.filter(
      (buyer) => buyer.buyerNTNCNIC && buyer.buyerNTNCNIC.trim()
    );

    if (buyersWithNTN.length === 0) {
      console.log(
        "⚠️ No buyers with NTN/CNIC found, returning all as Unregistered"
      );
      const results = buyers.map((buyer) => ({
        ...buyer,
        buyerRegistrationType: "Unregistered",
      }));

      return res.status(200).json({
        success: true,
        data: {
          results,
          summary: {
            total: buyers.length,
            checked: 0,
            registered: 0,
            unregistered: buyers.length,
            processingTime: "0ms",
          },
        },
      });
    }

    // Process in moderate batches with controlled concurrency to avoid upstream throttling
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < buyersWithNTN.length; i += batchSize) {
      batches.push(buyersWithNTN.slice(i, i + batchSize));
    }

    console.log(
      `📦 Processing ${batches.length} batches of ${batchSize} buyers each...`
    );

    const results = [];
    const errors = [];

    // Concurrency-limited mapper
    const mapWithConcurrency = async (items, limit, iterator) => {
      const resultsLocal = new Array(items.length);
      let index = 0;
      const run = async () => {
        while (true) {
          const current = index++;
          if (current >= items.length) break;
          resultsLocal[current] = await iterator(items[current], current);
        }
      };
      const workers = Array.from(
        { length: Math.min(limit, items.length) },
        run
      );
      await Promise.all(workers);
      return resultsLocal;
    };

    // Process batches sequentially to be gentle on the upstream service
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      try {
        console.log(
          `🔍 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} buyers) with limited concurrency...`
        );

        const batchResults = await mapWithConcurrency(
          batch,
          10,
          async (buyer) => {
            try {
              const registrationType = await checkFBRRegistrationAPI(
                buyer.buyerNTNCNIC
              );
              return { ...buyer, buyerRegistrationType: registrationType };
            } catch (error) {
              console.error(
                `Error checking FBR for ${buyer.buyerNTNCNIC}:`,
                error
              );
              return { ...buyer, buyerRegistrationType: "Unregistered" };
            }
          }
        );

        results.push(...batchResults);
        console.log(
          `✅ Batch ${batchIndex + 1} completed: ${batchResults.length} buyers processed`
        );
      } catch (batchError) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError);
        errors.push(batchError);
        results.push(
          ...batch.map((buyer) => ({
            ...buyer,
            buyerRegistrationType: "Unregistered",
          }))
        );
      }
    }

    // Add buyers without NTN/CNIC with default "Unregistered" status
    const buyersWithoutNTN = buyers.filter(
      (buyer) => !buyer.buyerNTNCNIC || !buyer.buyerNTNCNIC.trim()
    );

    const buyersWithoutNTNResults = buyersWithoutNTN.map((buyer) => ({
      ...buyer,
      buyerRegistrationType: "Unregistered",
    }));

    const finalResults = [...results, ...buyersWithoutNTNResults];

    const registeredCount = finalResults.filter(
      (buyer) => buyer.buyerRegistrationType === "Registered"
    ).length;

    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    console.log(
      `🎉 ULTRA-OPTIMIZED FBR registration check completed in ${totalTime.toFixed(2)}ms: ${registeredCount} registered, ${finalResults.length - registeredCount} unregistered`
    );

    res.status(200).json({
      success: true,
      data: {
        results: finalResults,
        summary: {
          total: buyers.length,
          checked: buyersWithNTN.length,
          registered: registeredCount,
          unregistered: finalResults.length - registeredCount,
          errors: errors.length,
          processingTime: totalTime.toFixed(2) + "ms",
        },
      },
    });
  } catch (error) {
    console.error(
      "Error in ultra-optimized bulk FBR registration check:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Error processing ultra-optimized bulk FBR registration check",
      error: error.message,
    });
  }
};

// Helper function to check FBR registration status with retry logic
const checkFBRRegistrationAPI = async (registrationNo) => {
  if (!registrationNo || !registrationNo.trim()) {
    return "Unregistered";
  }

  const maxRetries = 2;
  const timeout = 12000; // 12 seconds timeout to reduce upstream timeouts
  const FBR_API_URL =
    "https://buyercheckapi.inplsoftwares.online/checkbuyer.php";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use axios with token (same as public proxy) and timeout
      const axios = (await import("axios")).default;
      const { data } = await axios.post(
        FBR_API_URL,
        {
          token: "89983e4a-c009-3f9b-bcd6-a605c3086709",
          registrationNo: registrationNo.trim(),
        },
        { headers: { "Content-Type": "application/json" }, timeout }
      );

      let derivedRegistrationType = "";
      if (data && typeof data.REGISTRATION_TYPE === "string") {
        derivedRegistrationType =
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
        derivedRegistrationType = isRegistered ? "Registered" : "Unregistered";
      }

      return derivedRegistrationType;
    } catch (error) {
      console.error(
        `Error checking FBR registration for ${registrationNo} (attempt ${attempt}/${maxRetries}):`,
        error
      );

      // If upstream returns 400 (invalid NTN/CNIC), don't retry further
      if (error?.response?.status === 400) {
        return "Unregistered";
      }

      if (attempt === maxRetries) {
        // Return "Unregistered" as default if all retries fail
        return "Unregistered";
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
};
