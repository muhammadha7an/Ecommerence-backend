const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// GET all products with filtering & search
router.get("/", async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, inStock, sort } = req.query;
    const filter = {};

    if (category && category !== "all") {
      filter.$or = [
        { category: { $regex: new RegExp(`^${category}$`, "i") } },
        { categoryId: category },
      ];
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ name: searchRegex }, { description: searchRegex }, { category: searchRegex }],
      });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }

    if (inStock === "true") {
      filter.inStock = true;
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price-low") sortOption = { price: 1 };
    if (sort === "price-high") sortOption = { price: -1 };
    if (sort === "rating") sortOption = { rating: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };

    const products = await Product.find(filter).sort(sortOption);

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load products",
    });
  }
});

// GET single product by ID (_id or legacyId)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }

    if (!product && !isNaN(Number(id))) {
      product = await Product.findOne({ legacyId: Number(id) });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load product details",
    });
  }
});

// POST create product (Admin only)
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      salePrice,
      category,
      categoryId,
      stock,
      inStock,
      image,
      images,
      isFeatured,
      isNew,
      rating,
    } = req.body;

    if (!name || price === undefined || !category || !image) {
      return res.status(400).json({
        success: false,
        message: "Name, price, category, and image are required",
      });
    }

    const stockValue = stock !== undefined && stock !== "" ? Number(stock) : 10;
    if (!Number.isInteger(stockValue) || stockValue < 0) {
      return res.status(400).json({ success: false, message: "Stock must be a whole number of 0 or more" });
    }

    const product = await Product.create({
      name: String(name).trim(),
      description: String(description || "").trim(),
      price: Number(price),
      salePrice: salePrice ? Number(salePrice) : null,
      category: String(category).trim(),
      categoryId: categoryId || null,
      stock: stockValue,
      // A product with no stock can never be marked as available.
      inStock: stockValue > 0 && (inStock !== undefined ? Boolean(inStock) : true),
      image: String(image).trim(),
      images: Array.isArray(images) ? images : [],
      isFeatured: Boolean(isFeatured),
      isNew: Boolean(isNew),
      rating: rating ? Number(rating) : 4.8,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
});

// PUT update product (Admin only)
router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let query = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else if (!isNaN(Number(id))) {
      query = { legacyId: Number(id) };
    } else {
      return res.status(400).json({ success: false, message: "Invalid product identifier" });
    }

    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const allowedFields = [
      "name",
      "description",
      "price",
      "salePrice",
      "category",
      "categoryId",
      "stock",
      "inStock",
      "image",
      "images",
      "isFeatured",
      "isNew",
      "rating",
    ];

    if (req.body.stock !== undefined && req.body.stock !== "") {
      const stockValue = Number(req.body.stock);
      if (!Number.isInteger(stockValue) || stockValue < 0) {
        return res.status(400).json({ success: false, message: "Stock must be a whole number of 0 or more" });
      }
      req.body.stock = stockValue;
    } else {
      delete req.body.stock;
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    if (product.stock !== undefined) {
      product.inStock = Number(product.stock) > 0;
    }

    await product.save();

    return res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update product",
    });
  }
});

// DELETE product (Admin only)
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let query = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else if (!isNaN(Number(id))) {
      query = { legacyId: Number(id) };
    } else {
      return res.status(400).json({ success: false, message: "Invalid product identifier" });
    }

    const deletedProduct = await Product.findOneAndDelete(query);
    if (!deletedProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully",
      id: deletedProduct._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete product",
    });
  }
});

module.exports = router;

