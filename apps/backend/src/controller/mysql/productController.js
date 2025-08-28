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
