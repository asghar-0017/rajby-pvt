export const listProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const products = await Product.findAll({ order: [["id", "ASC"]] });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { name, description, hsCode, uom } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });
    const product = await Product.create({ name, description, hsCode, uom });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
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
    const { name, description, hsCode, uom } = req.body;

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

    await product.update({ name, description, hsCode, uom });
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

    await product.destroy();
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const checkExistingProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: "products array is required",
      });
    }

    // Extract product names and HS codes for comparison
    const productIdentifiers = products
      .map((product) => ({
        name: product.name || product.productName || product.ProductName,
        description:
          product.description ||
          product.productDescription ||
          product.ProductDescription,
        hsCode: product.hsCode || product.HSCode || product.hs_code,
        uom: product.uom || product.UOM || product.unitOfMeasure,
      }))
      .filter((p) => p.name); // Only include products with names

    if (productIdentifiers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found in the data",
      });
    }

    // Find existing products by name AND HS code (both must match)
    const existingProducts = [];
    const newProducts = [];

    for (const identifier of productIdentifiers) {
      // Check if product exists by name AND HS code (both conditions must be true)
      const existingProduct = await Product.findOne({
        where: {
          name: identifier.name,
          hsCode: identifier.hsCode,
        },
      });

      if (existingProduct) {
        existingProducts.push({
          ...identifier,
          existingProduct: existingProduct,
        });
      } else {
        newProducts.push({
          productData: identifier,
        });
      }
    }

    res.json({
      success: true,
      data: {
        existing: existingProducts,
        new: newProducts,
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

export const bulkCreateProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: "products array is required",
      });
    }

    const createdProducts = [];
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      try {
        // Validate required fields
        if (!productData.name) {
          errors.push({
            row: i + 1,
            error: "Product name is required",
          });
          continue;
        }

        // Check if product already exists by name AND HS code (both must match)
        const existingProduct = await Product.findOne({
          where: {
            name: productData.name,
            hsCode: productData.hsCode,
          },
        });

        if (existingProduct) {
          errors.push({
            row: i + 1,
            error: `Product with name "${productData.name}" and HS Code "${productData.hsCode}" already exists`,
          });
          continue;
        }

        // Create the product
        const product = await Product.create({
          name: productData.name,
          description: productData.description || null,
          hsCode: productData.hsCode || null,
          uom: productData.uom || null,
        });

        createdProducts.push(product);
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error.message || "Unknown error occurred",
        });
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          successful: createdProducts.length,
          failed: errors.length,
          total: products.length,
        },
        createdProducts,
        errors,
      },
    });
  } catch (err) {
    console.error("Error in bulk product creation:", err);
    res.status(500).json({
      success: false,
      message: "Error in bulk product creation: " + err.message,
    });
  }
};
