// controllers/categoryController.js
const Category = require("../models/Category");
const Product = require("../models/Product");
const mongoose = require("mongoose");

// Get all categories with optional filtering
exports.getAllCategories = async (req, res) => {
  try {
    const {
      includeTree = "false",
      includeStats = "false",
      activeOnly = "false",
      search = "",
    } = req.query;

    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Active only filter
    if (activeOnly === "true") {
      query.isActive = true;
    }

    let categories;

    if (includeTree === "true") {
      // Get categories with hierarchical structure
      categories = await Category.find(query)
        .populate({
          path: "children",
          match: activeOnly === "true" ? { isActive: true } : {},
          options: { sort: { name: 1 } },
        })
        .sort({ name: 1 });

      // Filter to get only parent categories for tree view
      categories = categories.filter((cat) => !cat.parentCategory);
    } else {
      // Get flat list of categories
      categories = await Category.find(query).sort({ name: 1 });
    }

    // Include product count stats if requested
    if (includeStats === "true") {
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const productCount = await Product.countDocuments({
            category: category._id,
            isActive: true,
          });
          return {
            ...category.toObject(),
            productCount,
          };
        })
      );

      return res.json({
        success: true,
        count: categories.length,
        categories: categoriesWithStats,
      });
    }

    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching categories",
      error: error.message,
    });
  }
};

// Get single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get product count
    const productCount = await Product.countDocuments({
      category: id,
      isActive: true,
    });

    const categoryWithStats = {
      ...category.toObject(),
      productCount,
    };

    res.json({
      success: true,
      category: categoryWithStats,
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category",
      error: error.message,
    });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image, parentCategory, isActive } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Check for duplicate category name at same level
    const duplicateQuery = {
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    };

    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID",
        });
      }
      duplicateQuery.parentCategory = parentCategory;
    } else {
      duplicateQuery.parentCategory = null;
    }

    const existingCategory = await Category.findOne(duplicateQuery);

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists at this level",
      });
    }

    // Validate parent category exists if provided
    if (parentCategory) {
      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    // Create category
    const category = new Category({
      name: name.trim(),
      description: description?.trim() || "",
      image: image || "",
      parentCategory: parentCategory || null,
      isActive: isActive !== undefined ? isActive : true,
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category name already exists",
      });
    }

    res.status(400).json({
      success: false,
      message: "Error creating category",
      error: error.message,
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { name, description, image, parentCategory, isActive } = req.body;

    // Check for duplicate name if name is being updated
    if (name && name.trim() !== category.name) {
      const duplicateQuery = {
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      };

      const parentCat =
        parentCategory !== undefined ? parentCategory : category.parentCategory;

      if (parentCat) {
        duplicateQuery.parentCategory = parentCat;
      } else {
        duplicateQuery.parentCategory = null;
      }

      const existingCategory = await Category.findOne(duplicateQuery);

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists at this level",
        });
      }
    }

    // Prevent setting a category as its own parent
    if (parentCategory && parentCategory.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be its own parent",
      });
    }

    // Check for circular reference
    if (parentCategory) {
      let currentParent = parentCategory;
      while (currentParent) {
        if (currentParent.toString() === id) {
          return res.status(400).json({
            success: false,
            message: "Circular reference detected in category hierarchy",
          });
        }

        const parentCat = await Category.findById(currentParent);
        if (!parentCat || !parentCat.parentCategory) break;
        currentParent = parentCat.parentCategory;
      }
    }

    // Validate parent category exists if provided
    if (parentCategory) {
      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name.trim();
    if (description !== undefined)
      category.description = description?.trim() || "";
    if (image !== undefined) category.image = image || "";
    if (parentCategory !== undefined) {
      category.parentCategory = parentCategory || null;
    }
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Update category error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category name already exists",
      });
    }

    res.status(400).json({
      success: false,
      message: "Error updating category",
      error: error.message,
    });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} product(s). Please reassign products first.`,
      });
    }

    // Check if category has children
    const childCount = await Category.countDocuments({ parentCategory: id });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${childCount} sub-category(ies). Please delete or reassign sub-categories first.`,
      });
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting category",
      error: error.message,
    });
  }
};

// Bulk update categories
exports.bulkUpdateCategories = async (req, res) => {
  try {
    const { categoryIds, updateData } = req.body;

    if (
      !categoryIds ||
      !Array.isArray(categoryIds) ||
      categoryIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Category IDs are required",
      });
    }

    // Validate all category IDs
    const invalidIds = categoryIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid category IDs: ${invalidIds.join(", ")}`,
      });
    }

    // Update all categories
    const result = await Category.updateMany(
      { _id: { $in: categoryIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} categories updated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while bulk updating categories",
      error: error.message,
    });
  }
};

// Get category statistics
exports.getCategoryStats = async (req, res) => {
  try {
    const stats = await Category.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalCategories: { $sum: 1 },
                activeCategories: {
                  $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                },
                categoriesWithProducts: {
                  $sum: { $cond: [{ $gt: ["$productCount", 0] }, 1, 0] },
                },
                nestedCategories: {
                  $sum: { $cond: [{ $ne: ["$parentCategory", null] }, 1, 0] },
                },
              },
            },
          ],
          byLevel: [
            {
              $group: {
                _id: {
                  $cond: [{ $eq: ["$parentCategory", null] }, "Main", "Sub"],
                },
                count: { $sum: 1 },
              },
            },
          ],
          recentCategories: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                name: 1,
                productCount: 1,
                isActive: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const totals = stats[0].totals[0] || {
      totalCategories: 0,
      activeCategories: 0,
      categoriesWithProducts: 0,
      nestedCategories: 0,
    };

    res.json({
      success: true,
      stats: {
        totals,
        byLevel: stats[0].byLevel || [],
        recentCategories: stats[0].recentCategories || [],
      },
    });
  } catch (error) {
    console.error("Get category stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category statistics",
      error: error.message,
    });
  }
};

// Search categories
exports.searchCategories = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const categories = await Category.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ],
      isActive: true,
    }).limit(20);

    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Search categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching categories",
      error: error.message,
    });
  }
};

// Add root category (new functionality)
exports.addRootCategory = async (req, res) => {
  try {
    const { name, description, image, isActive } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Check if root category with same name already exists
    const existingRootCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      parentCategory: null,
    });

    if (existingRootCategory) {
      return res.status(400).json({
        success: false,
        message: "Root category with this name already exists",
      });
    }

    // Create root category
    const rootCategory = new Category({
      name: name.trim(),
      description: description?.trim() || "",
      image: image || "",
      parentCategory: null,
      isActive: isActive !== undefined ? isActive : true,
    });

    await rootCategory.save();

    res.status(201).json({
      success: true,
      message: "Root category created successfully",
      category: rootCategory,
    });
  } catch (error) {
    console.error("Add root category error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Root category name already exists",
      });
    }

    res.status(400).json({
      success: false,
      message: "Error creating root category",
      error: error.message,
    });
  }
};

// Get root categories
exports.getRootCategories = async (req, res) => {
  try {
    const { activeOnly = "false", includeStats = "false" } = req.query;

    let query = { parentCategory: null };

    if (activeOnly === "true") {
      query.isActive = true;
    }

    const rootCategories = await Category.find(query)
      .sort({ name: 1 })
      .populate({
        path: "children",
        match: activeOnly === "true" ? { isActive: true } : {},
        options: { sort: { name: 1 } },
      });

    if (includeStats === "true") {
      const categoriesWithStats = await Promise.all(
        rootCategories.map(async (category) => {
          // Get product count for this root category
          const productCount = await Product.countDocuments({
            category: category._id,
            isActive: true,
          });

          // Get count of immediate children
          const childCount = category.children ? category.children.length : 0;

          return {
            ...category.toObject(),
            productCount,
            childCount,
          };
        })
      );

      return res.json({
        success: true,
        count: rootCategories.length,
        categories: categoriesWithStats,
      });
    }

    res.json({
      success: true,
      count: rootCategories.length,
      categories: rootCategories,
    });
  } catch (error) {
    console.error("Get root categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching root categories",
      error: error.message,
    });
  }
};

// Get category tree (full hierarchy)
exports.getCategoryTree = async (req, res) => {
  try {
    const { activeOnly = "false" } = req.query;

    const buildCategoryTree = async (parentId = null) => {
      const query = { parentCategory: parentId };
      
      if (activeOnly === "true") {
        query.isActive = true;
      }

      const categories = await Category.find(query).sort({ name: 1 });

      const tree = await Promise.all(
        categories.map(async (category) => {
          const children = await buildCategoryTree(category._id);
          
          // Get product count for this category
          const productCount = await Product.countDocuments({
            category: category._id,
            isActive: true,
          });

          return {
            _id: category._id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            image: category.image,
            isActive: category.isActive,
            order: category.order,
            productCount,
            children: children.length > 0 ? children : [],
            level: parentId === null ? 0 : 1, // You can make this dynamic if needed
          };
        })
      );

      return tree;
    };

    const categoryTree = await buildCategoryTree();

    res.json({
      success: true,
      categories: categoryTree,
    });
  } catch (error) {
    console.error("Get category tree error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category tree",
      error: error.message,
    });
  }
};

// Get category path (breadcrumb)
exports.getCategoryPath = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const getPath = async (categoryId, path = []) => {
      const category = await Category.findById(categoryId);
      
      if (!category) {
        return path;
      }

      path.unshift({
        _id: category._id,
        name: category.name,
        slug: category.slug,
      });

      if (category.parentCategory) {
        return getPath(category.parentCategory, path);
      }

      return path;
    };

    const path = await getPath(id);

    res.json({
      success: true,
      path,
    });
  } catch (error) {
    console.error("Get category path error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category path",
      error: error.message,
    });
  }
};

// Reassign category products (move products to another category)
exports.reassignCategoryProducts = async (req, res) => {
  try {
    const { sourceCategoryId, targetCategoryId } = req.body;

    if (!sourceCategoryId || !targetCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Both source and target category IDs are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(sourceCategoryId) ||
      !mongoose.Types.ObjectId.isValid(targetCategoryId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    // Check if categories exist
    const sourceCategory = await Category.findById(sourceCategoryId);
    const targetCategory = await Category.findById(targetCategoryId);

    if (!sourceCategory || !targetCategory) {
      return res.status(404).json({
        success: false,
        message: "One or both categories not found",
      });
    }

    // Reassign products
    const result = await Product.updateMany(
      { category: sourceCategoryId },
      { $set: { category: targetCategoryId } }
    );

    // Update product count in categories
    const sourceProductCount = await Product.countDocuments({
      category: sourceCategoryId,
    });
    const targetProductCount = await Product.countDocuments({
      category: targetCategoryId,
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} products reassigned from "${sourceCategory.name}" to "${targetCategory.name}"`,
      modifiedCount: result.modifiedCount,
      counts: {
        sourceCategory: {
          _id: sourceCategoryId,
          name: sourceCategory.name,
          remainingProducts: sourceProductCount,
        },
        targetCategory: {
          _id: targetCategoryId,
          name: targetCategory.name,
          totalProducts: targetProductCount,
        },
      },
    });
  } catch (error) {
    console.error("Reassign category products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reassigning products",
      error: error.message,
    });
  }
};

// Move category (change parent)
exports.moveCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { newParentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if moving to root
    if (newParentId === null || newParentId === "") {
      // Prevent circular reference check for root
      category.parentCategory = null;
      await category.save();

      return res.json({
        success: true,
        message: "Category moved to root level successfully",
        category,
      });
    }

    // Validate new parent
    if (!mongoose.Types.ObjectId.isValid(newParentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid new parent category ID",
      });
    }

    // Check if new parent exists
    const newParent = await Category.findById(newParentId);
    if (!newParent) {
      return res.status(404).json({
        success: false,
        message: "New parent category not found",
      });
    }

    // Prevent setting as its own parent
    if (newParentId === id) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be its own parent",
      });
    }

    // Check for circular reference (category cannot be parent of its parent)
    let currentParent = newParentId;
    while (currentParent) {
      if (currentParent.toString() === id) {
        return res.status(400).json({
          success: false,
          message: "Circular reference detected in category hierarchy",
        });
      }

      const parentCat = await Category.findById(currentParent);
      if (!parentCat || !parentCat.parentCategory) break;
      currentParent = parentCat.parentCategory;
    }

    // Check for duplicate name at new level
    const duplicateCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${category.name}$`, "i") },
      parentCategory: newParentId,
      _id: { $ne: id },
    });

    if (duplicateCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists in the target location",
      });
    }

    // Move the category
    category.parentCategory = newParentId;
    await category.save();

    res.json({
      success: true,
      message: "Category moved successfully",
      category,
      newParent: {
        _id: newParent._id,
        name: newParent.name,
      },
    });
  } catch (error) {
    console.error("Move category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while moving category",
      error: error.message,
    });
  }
};