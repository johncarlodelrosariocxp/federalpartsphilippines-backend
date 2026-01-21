const express = require("express");
const router = express.Router();
const { auth, adminAuth } = require("../middleware/auth");
const Category = require("../models/Category");

// Get all categories (public)
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Create category (admin only)
router.post("/", auth, adminAuth, async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json({
      success: true,
      message: "Category created",
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
