const express = require("express");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// GET all categories with product count
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 });

    // Include product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          $or: [
            { category: cat.name },
            { categoryId: cat.legacyId },
            { categoryId: cat._id.toString() },
          ],
        });
        const obj = cat.toJSON();
        obj.productCount = count;
        return obj;
      })
    );

    return res.json({
      success: true,
      count: categoriesWithCount.length,
      categories: categoriesWithCount,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load categories",
    });
  }
});

// GET single category
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let category = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    }
    if (!category && !isNaN(Number(id))) {
      category = await Category.findOne({ legacyId: Number(id) });
    }

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.json({ success: true, category });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load category" });
  }
});

// POST create category (Admin only)
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Category name already exists" });
    }

    const category = await Category.create({
      name: name.trim(),
      description: String(description || "").trim(),
      image: String(image || "").trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to create category",
    });
  }
});

// PUT update category (Admin only)
router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let query = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else if (!isNaN(Number(id))) {
      query = { legacyId: Number(id) };
    } else {
      return res.status(400).json({ success: false, message: "Invalid category identifier" });
    }

    const category = await Category.findOne(query);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const oldName = category.name;
    const { name, description, image } = req.body;

    if (name && name.trim()) {
      const existing = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: category._id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Category name already exists" });
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = String(description).trim();
    if (image !== undefined) category.image = String(image).trim();

    await category.save();

    // If category name was renamed, update matching products
    if (name && name.trim() !== oldName) {
      await Product.updateMany({ category: oldName }, { category: name.trim() });
    }

    return res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to update category",
    });
  }
});

// DELETE category (Admin only)
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let query = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else if (!isNaN(Number(id))) {
      query = { legacyId: Number(id) };
    } else {
      return res.status(400).json({ success: false, message: "Invalid category identifier" });
    }

    const deleted = await Category.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.json({
      success: true,
      message: "Category deleted successfully",
      id: deleted._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete category",
    });
  }
});

module.exports = router;

