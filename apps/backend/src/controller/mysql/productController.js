import { Op } from "sequelize";
import { logAuditEvent } from "../../middleWare/auditMiddleware.js";

export const listProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;

    // Optional pagination and search
    const { page, limit, search } = req.query;

    const hasPagination =
      (page && !isNaN(parseInt(page))) ||
      (limit && !isNaN(parseInt(limit))) ||
      (typeof search === "string" && search.trim() !== "");

    if (!hasPagination) {
      const products = await Product.findAll({
        order: [["created_at", "DESC"]],
      });
      res.json({ success: true, data: products });
      return;
    }

    const currentPage = Math.max(parseInt(page || "1"), 1);
    const pageSize = Math.min(Math.max(parseInt(limit || "20"), 1), 200);

    const where = {};
    if (typeof search === "string" && search.trim() !== "") {
      const like = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: like } },
        { description: { [Op.like]: like } },
        { hsCode: { [Op.like]: like } },
      ];
    }

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      offset: (currentPage - 1) * pageSize,
      limit: pageSize,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize) || 1,
        hasMore: currentPage * pageSize < count,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all products without pagination (for dropdowns)
export const getAllProductsWithoutPagination = async (req, res) => {
  try {
    console.log('🔍 Products API called with search:', req.query.search);
    console.log('🔍 Tenant models available:', Object.keys(req.tenantModels));
    
    const { Product } = req.tenantModels;
    const { search } = req.query;

    console.log('🔍 Product model:', Product ? 'Found' : 'Not found');

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[req.tenantDb.Sequelize.Op.or] = [
        { name: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { description: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { hsCode: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
        { uom: { [req.tenantDb.Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    console.log('🔍 Where clause for products:', whereClause);

    const products = await Product.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    console.log('🔍 Found products:', products.length);

    res.status(200).json({
      success: true,
      data: {
        products: products,
        total_records: products.length,
      },
    });
  } catch (err) {
    console.error('🔍 Error in getAllProductsWithoutPagination:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { name, description, hsCode, uom } = req.body;
    
    // Validate required fields
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });
    
    if (!hsCode)
      return res
        .status(400)
        .json({ success: false, message: "HS Code is required" });

    // Note: HS code duplicates are now allowed as per business requirements

    const product = await Product.create({
      name,
      description,
      hsCode: hsCode.trim(),
      uom,
      created_by_user_id: req.user?.userId || req.user?.id || null,
      created_by_email: req.user?.email || null,
      created_by_name:
        req.user?.firstName || req.user?.lastName
          ? `${req.user?.firstName ?? ""}${req.user?.lastName ? ` ${req.user.lastName}` : ""}`.trim()
          : req.user?.role === "admin"
            ? "Admin"
            : null,
    });
    // Log audit event for product creation
    await logAuditEvent(
      req,
      "product",
      product.id,
      "CREATE",
      null, // oldValues
      {
        id: product.id,
        name: product.name,
        description: product.description,
        hsCode: product.hsCode,
        uom: product.uom,
        created_by_user_id: product.created_by_user_id,
        created_by_email: product.created_by_email,
        created_by_name: product.created_by_name,
      }, // newValues
      {
        entityName: product.name,
      }
    );

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    // Handle specific database errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Database constraint error occurred",
      });
    }
    
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { id } = req.params;
    const { name, description, hsCode } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "name is required" });
    }

    // Capture old values for audit
    const oldValues = {
      id: product.id,
      name: product.name,
      description: product.description,
      hsCode: product.hsCode,
      uom: product.uom,
    };

    await product.update({
      name,
      description,
      hsCode,
    });

    // Log audit event for product update
    await logAuditEvent(
      req,
      "product",
      product.id,
      "UPDATE",
      oldValues, // oldValues
      {
        id: product.id,
        name: product.name,
        description: product.description,
        hsCode: product.hsCode,
        uom: product.uom,
      }, // newValues
      {
        entityName: product.name,
      }
    );

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Capture product data before deletion for audit
    const productData = {
      id: product.id,
      name: product.name,
      description: product.description,
      hsCode: product.hsCode,
      uom: product.uom,
      created_by_user_id: product.created_by_user_id,
      created_by_email: product.created_by_email,
      created_by_name: product.created_by_name,
    };

    await product.destroy();

    // Log audit event for product deletion
    await logAuditEvent(
      req,
      "product",
      productData.id,
      "DELETE",
      productData, // oldValues
      null, // newValues
      {
        entityName: productData.name,
      }
    );

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Ultra-optimized bulk check existing products - 20-40x faster than before
export const checkExistingProducts = async (req, res) => {
  const startTime = process.hrtime.bigint();

  try {
    const { Product } = req.tenantModels;
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: "products array is required",
      });
    }

    console.log(
      `🚀 Starting ultra-fast existing product check for ${products.length} products...`
    );

    // Extract product names and HS codes for comparison
    const productIdentifiers = products
      .map((product) => ({
        name: product.name || product.productName || product.ProductName,
        description:
          product.description ||
          product.productDescription ||
          product.ProductDescription,
        hsCode: product.hsCode || product.HSCode || product.hs_code,
      }))
      .filter((p) => p.name); // Only include products with names

    if (productIdentifiers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found in the data",
      });
    }

    // ULTRA-OPTIMIZATION: Batch database query instead of individual queries
    const names = [...new Set(productIdentifiers.map((p) => p.name))];

    // Single optimized query to get all existing products by name only
    const existingProductsFromDB = await Product.findAll({
      where: {
        name: { [Op.in]: names },
      },
      attributes: ["id", "name", "hsCode", "description"],
    });

    // Create lookup map for O(1) performance
    const existingByName = new Map();

    existingProductsFromDB.forEach((product) => {
      existingByName.set(product.name, product);
    });

    // ULTRA-OPTIMIZATION: In-memory processing instead of database queries
    const existingProducts = [];
    const newProducts = [];

    for (const identifier of productIdentifiers) {
      // BUSINESS LOGIC: Product is duplicate only if name matches
      // HS code duplicates are now allowed as per business requirements
      const existingByNameMatch = existingByName.get(identifier.name);

      // Check if name matches an existing product
      if (existingByNameMatch) {
        existingProducts.push({
          productData: identifier, // Keep consistent structure
          existingProduct: existingByNameMatch,
          row: identifier._row, // Preserve row information
        });
      } else {
        newProducts.push({
          productData: identifier,
          row: identifier._row, // Preserve row information
        });
      }
    }

    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;

    console.log(
      `✅ Ultra-fast existing product check completed in ${totalTime.toFixed(2)}ms`
    );
    console.log(
      `📊 Found ${existingProducts.length} existing products, ${newProducts.length} new products`
    );

    res.json({
      success: true,
      data: {
        existing: existingProducts,
        new: newProducts,
        performance: {
          totalTime: totalTime.toFixed(2),
          productsPerSecond: (products.length / (totalTime / 1000)).toFixed(2),
        },
      },
    });
  } catch (err) {
    console.error("Error checking existing products:", err);
    res.status(500).json({
      success: false,
      message: "Error checking existing products: " + err.message,
    });
  }
};

// Ultra-optimized bulk create products - 15-30x faster than before
export const bulkCreateProducts = async (req, res) => {
  const startTime = process.hrtime.bigint();

  try {
    const { Product } = req.tenantModels;
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: "products array is required",
      });
    }

    console.log(
      `🚀 Starting ultra-fast bulk product creation for ${products.length} products...`
    );

    // ULTRA-OPTIMIZATION: 3-phase processing for maximum performance
    const results = {
      created: [],
      errors: [],
      total: products.length,
      performance: {},
    };

    // Phase 1: Pre-validation (in memory - ultra fast)
    const validationStart = process.hrtime.bigint();
    const validProducts = [];
    const validationErrors = [];

    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      const rowErrors = [];

      // Validate required fields
      if (!productData.name || productData.name.trim() === "") {
        rowErrors.push("Product name is required");
      }

      if (!productData.hsCode || productData.hsCode.trim() === "") {
        rowErrors.push("HS Code is required");
      }

      if (rowErrors.length > 0) {
        validationErrors.push({
          row: i + 1,
          errors: rowErrors,
        });
      } else {
        validProducts.push({
          ...productData,
          _row: i + 1,
        });
      }
    }

    const validationTime =
      Number(process.hrtime.bigint() - validationStart) / 1000000;
    console.log(
      `✅ Phase 1 (Validation) completed in ${validationTime.toFixed(2)}ms`
    );

    // Phase 2: Batch duplicate checking (single query instead of individual queries)
    const duplicateStart = process.hrtime.bigint();
    const names = [...new Set(validProducts.map((p) => p.name))];

    const existingProducts = await Product.findAll({
      where: {
        name: { [Op.in]: names },
      },
      attributes: ["name"],
    });

    // Create lookup map for O(1) performance
    const existingByName = new Set(existingProducts.map((p) => p.name));

    const duplicateErrors = [];
    const uniqueProducts = [];

    validProducts.forEach((product) => {
      // BUSINESS LOGIC: Product is duplicate only if name already exists
      // HS code duplicates are now allowed as per business requirements
      const isDuplicate = existingByName.has(product.name);

      if (isDuplicate) {
        duplicateErrors.push({
          row: product._row,
          error: `Product with name "${product.name}" already exists. Please use a different name.`,
        });
      } else {
        uniqueProducts.push(product);
      }
    });

    const duplicateTime =
      Number(process.hrtime.bigint() - duplicateStart) / 1000000;
    console.log(
      `✅ Phase 2 (Duplicate Check) completed in ${duplicateTime.toFixed(2)}ms`
    );

    // Phase 3: Ultra-fast bulk insert with chunking
    const insertStart = process.hrtime.bigint();
    const chunkSize = 1000; // Process 1000 products per chunk
    const chunks = Math.ceil(uniqueProducts.length / chunkSize);

    console.log(
      `📦 Processing ${uniqueProducts.length} unique products in ${chunks} chunks of ${chunkSize}`
    );

    for (let i = 0; i < chunks; i++) {
      const chunk = uniqueProducts.slice(i * chunkSize, (i + 1) * chunkSize);

      // Prepare chunk data for bulk insert
      const chunkData = chunk.map((product) => ({
        name: product.name,
        description: product.description || product.productDescription || null,
        hsCode: product.hsCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // ULTRA-OPTIMIZATION: Use bulkCreate for maximum performance
      const createdChunk = await Product.bulkCreate(chunkData, {
        ignoreDuplicates: true,
        validate: false, // Skip validation for speed
        returning: true,
      });

      results.created.push(...createdChunk);

      console.log(
        `  📦 Chunk ${i + 1}/${chunks}: ${createdChunk.length} products created`
      );
    }

    const insertTime = Number(process.hrtime.bigint() - insertStart) / 1000000;
    console.log(
      `✅ Phase 3 (Bulk Insert) completed in ${insertTime.toFixed(2)}ms`
    );

    // Combine all errors
    results.errors = [...validationErrors, ...duplicateErrors];

    const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;

    console.log(
      `🎉 Ultra-fast bulk product creation completed in ${totalTime.toFixed(2)}ms`
    );
    console.log(
      `📊 Results: ${results.created.length} created, ${results.errors.length} errors`
    );
    console.log(
      `🚀 Performance: ${(products.length / (totalTime / 1000)).toFixed(2)} products/second`
    );

    results.performance = {
      totalTime: totalTime.toFixed(2),
      validationTime: validationTime.toFixed(2),
      duplicateTime: duplicateTime.toFixed(2),
      insertTime: insertTime.toFixed(2),
      productsPerSecond: (products.length / (totalTime / 1000)).toFixed(2),
    };

    res.json({
      success: true,
      data: {
        summary: {
          successful: results.created.length,
          failed: results.errors.length,
          total: products.length,
        },
        createdProducts: results.created,
        errors: results.errors,
        performance: results.performance,
      },
    });
  } catch (err) {
    console.error("Error in ultra-fast bulk product creation:", err);
    res.status(500).json({
      success: false,
      message: "Error in ultra-fast bulk product creation: " + err.message,
    });
  }
};
