// backend/controllers/adminController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Cart = require("../models/Cart");
const fs = require("fs");
const path = require("path");

// =================== DASHBOARD STATS ===================
exports.getDashboardStats = async (req, res) => {
  try {
    // Get counts in parallel
    const [
      totalUsers,
      totalProducts,
      totalCategories,
      totalBrands,
      activeProducts,
      outOfStockProducts,
      recentOrders
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Category.countDocuments(),
      Brand.countDocuments(),
      Product.countDocuments({ isActive: true, stock: { $gt: 0 } }),
      Product.countDocuments({ stock: 0, isActive: true }),
      Cart.countDocuments() // For orders tracking
    ]);

    // Get revenue calculation (if you have orders model)
    // const totalRevenue = await Order.aggregate([...]);

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt");

    // Get low stock products
    const lowStockProducts = await Product.find({
      stock: { $gt: 0, $lte: 10 },
      isActive: true
    })
      .sort({ stock: 1 })
      .limit(5)
      .select("name stock price");

    // Get top products by sales (if you have orders)
    // const topProducts = await Order.aggregate([...]);

    res.json({
      success: true,
      stats: {
        overview: {
          totalUsers,
          totalProducts,
          totalCategories,
          totalBrands,
          activeProducts,
          outOfStockProducts,
          // totalRevenue,
        },
        recentUsers,
        lowStockProducts,
        // topProducts,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message
    });
  }
};

// =================== USER MANAGEMENT ===================
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    
    if (role && role !== "all") {
      query.role = role;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      users
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: id }).populate("items.product", "name price images");

    res.json({
      success: true,
      user,
      cart
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if email is being changed and is unique
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use"
        });
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (role) user.role = role;

    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      user: user.toObject({ getters: true, virtuals: false })
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Don't allow deleting last admin
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last admin user"
        });
      }
    }

    // Delete user's cart
    await Cart.findOneAndDelete({ user: id });

    // Delete the user
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message
    });
  }
};

exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs are required"
      });
    }

    // Validate all user IDs
    const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid user IDs provided"
      });
    }

    // Check if trying to delete last admin
    const adminUsers = await User.find({
      _id: { $in: validIds },
      role: "admin"
    });

    if (adminUsers.length > 0) {
      const totalAdmins = await User.countDocuments({ role: "admin" });
      if (totalAdmins - adminUsers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete all admin users"
        });
      }
    }

    // Delete users
    const result = await User.deleteMany({ _id: { $in: validIds } });
    
    // Delete their carts
    await Cart.deleteMany({ user: { $in: validIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} users deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk delete users error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting users",
      error: error.message
    });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'user' or 'admin'"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Don't allow changing role of the last admin
    if (user.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot change role of the last admin"
        });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: user.toObject({ getters: true, virtuals: false })
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user role",
      error: error.message
    });
  }
};

// =================== PRODUCT MANAGEMENT ===================
exports.getAllProductsAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      category,
      brand,
      status,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } }
      ];
    }

    if (category && category !== "all") {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      }
    }

    if (brand && brand !== "all") {
      query.brand = brand;
    }

    if (status) {
      if (status === "active") query.isActive = true;
      else if (status === "inactive") query.isActive = false;
      else if (status === "out_of_stock") query.stock = 0;
      else if (status === "low_stock") query.stock = { $gt: 0, $lte: 10 };
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const products = await Product.find(query)
      .populate("category", "name")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      products
    });
  } catch (error) {
    console.error("Get products admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message
    });
  }
};

exports.getProductDetailsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const product = await Product.findById(id)
      .populate("category", "name description")
      .populate({
        path: "reviews.user",
        select: "name email"
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Get related products from same category
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true
    })
      .limit(5)
      .select("name price images stock");

    res.json({
      success: true,
      product,
      relatedProducts
    });
  } catch (error) {
    console.error("Get product details admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product details",
      error: error.message
    });
  }
};

exports.createProductAdmin = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discountedPrice,
      category,
      brand,
      stock,
      sku,
      weight,
      dimensions,
      specifications,
      featured,
      isActive
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, description, price, and category are required"
      });
    }

    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check SKU uniqueness
    if (sku) {
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists"
        });
      }
    }

    // Generate SKU if not provided
    const generatedSku = sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Handle images from request
    let images = [];
    if (req.body.images && Array.isArray(req.body.images)) {
      images = req.body.images.filter(img => img && img.trim() !== "");
    }

    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      discountedPrice: discountedPrice ? parseFloat(discountedPrice) : null,
      category,
      brand: brand || null,
      stock: stock ? parseInt(stock) : 0,
      sku: generatedSku,
      weight: weight || null,
      dimensions: dimensions || null,
      specifications: specifications || {},
      images,
      featured: featured === "true" || featured === true,
      isActive: isActive !== undefined ? isActive : true
    });

    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name");

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: populatedProduct
    });
  } catch (error) {
    console.error("Create product admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message
    });
  }
};

exports.updateProductAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const {
      name,
      description,
      price,
      discountedPrice,
      category,
      brand,
      stock,
      sku,
      weight,
      dimensions,
      specifications,
      featured,
      isActive
    } = req.body;

    // Check SKU uniqueness if changing
    if (sku && sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists"
        });
      }
      product.sku = sku;
    }

    // Validate category if changing
    if (category && category !== product.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found"
        });
      }
      product.category = category;
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description) product.description = description.trim();
    if (price) product.price = parseFloat(price);
    if (discountedPrice !== undefined) product.discountedPrice = discountedPrice ? parseFloat(discountedPrice) : null;
    if (brand !== undefined) product.brand = brand || null;
    if (stock !== undefined) product.stock = parseInt(stock);
    if (weight !== undefined) product.weight = weight || null;
    if (dimensions !== undefined) product.dimensions = dimensions || null;
    if (specifications) product.specifications = specifications;
    if (featured !== undefined) product.featured = featured === "true" || featured === true;
    if (isActive !== undefined) product.isActive = isActive === "true" || isActive === true;

    // Handle images
    if (req.body.images && Array.isArray(req.body.images)) {
      product.images = req.body.images.filter(img => img && img.trim() !== "");
    }

    await product.save();

    const updatedProduct = await Product.findById(product._id)
      .populate("category", "name");

    res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Update product admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message
    });
  }
};

exports.deleteProductAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Hard delete the product
    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("Delete product admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message
    });
  }
};

exports.bulkDeleteProductsAdmin = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs are required"
      });
    }

    const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid product IDs provided"
      });
    }

    const result = await Product.deleteMany({ _id: { $in: validIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} products deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk delete products admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting products",
      error: error.message
    });
  }
};

exports.toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      success: true,
      message: `Product ${product.isActive ? "activated" : "deactivated"} successfully`,
      product: {
        _id: product._id,
        name: product.name,
        isActive: product.isActive
      }
    });
  } catch (error) {
    console.error("Toggle product status error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling product status",
      error: error.message
    });
  }
};

// =================== CATEGORY MANAGEMENT ===================
exports.getAllCategoriesAdmin = async (req, res) => {
  try {
    const { search = "", includeTree = "false" } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    let categories;
    
    if (includeTree === "true") {
      // Get hierarchical categories
      const allCategories = await Category.find(query).sort({ order: 1, name: 1 });
      
      // Build tree structure
      const buildTree = (parentId = null) => {
        return allCategories
          .filter(cat => {
            if (parentId === null) {
              return !cat.parentCategory;
            }
            return cat.parentCategory && cat.parentCategory.toString() === parentId.toString();
          })
          .map(cat => ({
            ...cat.toObject(),
            children: buildTree(cat._id)
          }));
      };
      
      categories = buildTree();
    } else {
      categories = await Category.find(query)
        .populate("parentCategory", "name")
        .sort({ order: 1, name: 1 });
    }

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error("Get categories admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message
    });
  }
};

exports.getCategoryDetailsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id)
      .populate("parentCategory", "name")
      .populate({
        path: "children",
        select: "name image isActive productCount"
      });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Get products in this category
    const products = await Product.find({ category: id })
      .limit(10)
      .select("name price images stock isActive");

    const productCount = await Product.countDocuments({ category: id });

    res.json({
      success: true,
      category,
      products,
      productCount
    });
  } catch (error) {
    console.error("Get category details admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category details",
      error: error.message
    });
  }
};

exports.createCategoryAdmin = async (req, res) => {
  try {
    const { name, description, image, parentCategory, isActive, order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    // Check for duplicate
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      parentCategory: parentCategory || null
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists at this level"
      });
    }

    // Validate parent category if provided
    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID"
        });
      }
      
      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found"
        });
      }
    }

    const category = new Category({
      name: name.trim(),
      description: description ? description.trim() : "",
      image: image || "",
      parentCategory: parentCategory || null,
      isActive: isActive !== undefined ? isActive : true,
      order: order ? parseInt(order) : 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category
    });
  } catch (error) {
    console.error("Create category admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating category",
      error: error.message
    });
  }
};

exports.updateCategoryAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const { name, description, image, parentCategory, isActive, order } = req.body;

    // Check for duplicate name if changing
    if (name && name.trim() !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        parentCategory: parentCategory !== undefined ? parentCategory : category.parentCategory,
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists at this level"
        });
      }
      category.name = name.trim();
    }

    // Prevent self-parent
    if (parentCategory && parentCategory.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be its own parent"
      });
    }

    // Validate parent category
    if (parentCategory !== undefined) {
      if (parentCategory) {
        if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
          return res.status(400).json({
            success: false,
            message: "Invalid parent category ID"
          });
        }
        
        const parentExists = await Category.findById(parentCategory);
        if (!parentExists) {
          return res.status(404).json({
            success: false,
            message: "Parent category not found"
          });
        }
      }
      category.parentCategory = parentCategory || null;
    }

    if (description !== undefined) category.description = description.trim();
    if (image !== undefined) category.image = image || "";
    if (isActive !== undefined) category.isActive = isActive;
    if (order !== undefined) category.order = parseInt(order);

    await category.save();

    res.json({
      success: true,
      message: "Category updated successfully",
      category
    });
  } catch (error) {
    console.error("Update category admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category",
      error: error.message
    });
  }
};

exports.deleteCategoryAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check for products in this category
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} product(s). Reassign products first.`
      });
    }

    // Check for child categories
    const childCount = await Category.countDocuments({ parentCategory: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${childCount} sub-category(ies). Delete or reassign sub-categories first.`
      });
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete category admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message
    });
  }
};

exports.bulkDeleteCategoriesAdmin = async (req, res) => {
  try {
    const { categoryIds } = req.body;

    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category IDs are required"
      });
    }

    const validIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid category IDs provided"
      });
    }

    // Check for products in these categories
    const productsInCategories = await Product.countDocuments({
      category: { $in: validIds }
    });
    
    if (productsInCategories > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete categories with ${productsInCategories} product(s). Reassign products first.`
      });
    }

    // Check for child categories
    const childCategories = await Category.countDocuments({
      parentCategory: { $in: validIds }
    });
    
    if (childCategories > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete categories with ${childCategories} sub-category(ies). Delete or reassign sub-categories first.`
      });
    }

    const result = await Category.deleteMany({ _id: { $in: validIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} categories deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk delete categories admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting categories",
      error: error.message
    });
  }
};

exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully`,
      category: {
        _id: category._id,
        name: category.name,
        isActive: category.isActive
      }
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling category status",
      error: error.message
    });
  }
};

// =================== BRAND MANAGEMENT ===================
exports.getAllBrandsAdmin = async (req, res) => {
  try {
    const { search = "", isActive, withStats = "true" } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const brands = await Brand.find(query).sort({ order: 1, name: 1 });

    if (withStats === "true") {
      // Get product counts for each brand
      const brandsWithStats = await Promise.all(
        brands.map(async (brand) => {
          const productCount = await Product.countDocuments({
            brand: brand._id,
            isActive: true
          });
          
          const brandObj = brand.toObject();
          brandObj.productCount = productCount;
          return brandObj;
        })
      );
      
      return res.json({
        success: true,
        count: brandsWithStats.length,
        brands: brandsWithStats
      });
    }

    res.json({
      success: true,
      count: brands.length,
      brands
    });
  } catch (error) {
    console.error("Get brands admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching brands",
      error: error.message
    });
  }
};

exports.getBrandDetailsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID format"
      });
    }

    const brand = await Brand.findById(id)
      .populate("categories", "name image");

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    // Get products for this brand
    const products = await Product.find({ brand: id })
      .limit(20)
      .select("name price images stock isActive");
    
    const productCount = await Product.countDocuments({ brand: id });

    res.json({
      success: true,
      brand,
      products,
      productCount
    });
  } catch (error) {
    console.error("Get brand details admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching brand details",
      error: error.message
    });
  }
};

exports.createBrandAdmin = async (req, res) => {
  try {
    const {
      name,
      description,
      logo,
      coverImage,
      country,
      foundedYear,
      website,
      phone,
      email,
      address,
      isActive,
      order,
      categories,
      primaryColor,
      secondaryColor,
      warrantyPolicy,
      socialMedia,
      serviceCenters
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required"
      });
    }

    // Check for duplicate
    const existingBrand = await Brand.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") }
    });

    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: "Brand with this name already exists"
      });
    }

    const brand = new Brand({
      name: name.trim(),
      description: description ? description.trim() : "",
      logo: logo || "",
      coverImage: coverImage || "",
      country: country || "",
      foundedYear: foundedYear ? parseInt(foundedYear) : undefined,
      website: website || "",
      phone: phone || "",
      email: email || "",
      address: address || "",
      isActive: isActive !== undefined ? isActive : true,
      order: order ? parseInt(order) : 0,
      categories: categories || [],
      primaryColor: primaryColor || "#000000",
      secondaryColor: secondaryColor || "#ffffff",
      warrantyPolicy: warrantyPolicy || "",
      socialMedia: socialMedia || {},
      serviceCenters: serviceCenters || []
    });

    await brand.save();

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      brand
    });
  } catch (error) {
    console.error("Create brand admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating brand",
      error: error.message
    });
  }
};

exports.updateBrandAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID format"
      });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    const {
      name,
      description,
      logo,
      coverImage,
      country,
      foundedYear,
      website,
      phone,
      email,
      address,
      isActive,
      order,
      categories,
      primaryColor,
      secondaryColor,
      warrantyPolicy,
      socialMedia,
      serviceCenters
    } = req.body;

    // Check for duplicate name if changing
    if (name && name.trim() !== brand.name) {
      const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id }
      });

      if (existingBrand) {
        return res.status(400).json({
          success: false,
          message: "Brand with this name already exists"
        });
      }
      brand.name = name.trim();
    }

    if (description !== undefined) brand.description = description.trim();
    if (logo !== undefined) brand.logo = logo || "";
    if (coverImage !== undefined) brand.coverImage = coverImage || "";
    if (country !== undefined) brand.country = country;
    if (foundedYear !== undefined) brand.foundedYear = foundedYear ? parseInt(foundedYear) : undefined;
    if (website !== undefined) brand.website = website;
    if (phone !== undefined) brand.phone = phone;
    if (email !== undefined) brand.email = email;
    if (address !== undefined) brand.address = address;
    if (isActive !== undefined) brand.isActive = isActive;
    if (order !== undefined) brand.order = parseInt(order);
    if (categories !== undefined) brand.categories = categories || [];
    if (primaryColor !== undefined) brand.primaryColor = primaryColor;
    if (secondaryColor !== undefined) brand.secondaryColor = secondaryColor;
    if (warrantyPolicy !== undefined) brand.warrantyPolicy = warrantyPolicy;
    if (socialMedia !== undefined) brand.socialMedia = socialMedia;
    if (serviceCenters !== undefined) brand.serviceCenters = serviceCenters;

    await brand.save();

    res.json({
      success: true,
      message: "Brand updated successfully",
      brand
    });
  } catch (error) {
    console.error("Update brand admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating brand",
      error: error.message
    });
  }
};

exports.deleteBrandAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID format"
      });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    // Check for products with this brand
    const productCount = await Product.countDocuments({ brand: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete brand with ${productCount} product(s). Reassign products first.`
      });
    }

    await Brand.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Brand deleted successfully"
    });
  } catch (error) {
    console.error("Delete brand admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting brand",
      error: error.message
    });
  }
};

exports.bulkDeleteBrandsAdmin = async (req, res) => {
  try {
    const { brandIds } = req.body;

    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Brand IDs are required"
      });
    }

    const validIds = brandIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid brand IDs provided"
      });
    }

    // Check for products with these brands
    const productsWithBrands = await Product.countDocuments({
      brand: { $in: validIds }
    });
    
    if (productsWithBrands > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete brands with ${productsWithBrands} product(s). Reassign products first.`
      });
    }

    const result = await Brand.deleteMany({ _id: { $in: validIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} brands deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk delete brands admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting brands",
      error: error.message
    });
  }
};

exports.toggleBrandStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID format"
      });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    brand.isActive = !brand.isActive;
    await brand.save();

    res.json({
      success: true,
      message: `Brand ${brand.isActive ? "activated" : "deactivated"} successfully`,
      brand: {
        _id: brand._id,
        name: brand.name,
        isActive: brand.isActive
      }
    });
  } catch (error) {
    console.error("Toggle brand status error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling brand status",
      error: error.message
    });
  }
};

// =================== ORDERS MANAGEMENT ===================
exports.getAllOrders = async (req, res) => {
  try {
    // For now, return cart data as orders placeholder
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all carts with items
    const carts = await Cart.find()
      .populate("user", "name email phone")
      .populate("items.product", "name price images")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Cart.countDocuments();

    // Transform carts to order-like structure
    const orders = carts.map(cart => ({
      _id: cart._id,
      user: cart.user,
      items: cart.items,
      totalAmount: cart.totalPrice,
      status: "pending", // Default status for carts
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    }));

    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      orders
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    const cart = await Cart.findById(id)
      .populate("user", "name email phone address")
      .populate("items.product", "name price images sku stock");

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const order = {
      _id: cart._id,
      user: cart.user,
      items: cart.items,
      totalAmount: cart.totalPrice,
      status: "pending",
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order details",
      error: error.message
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", ")
      });
    }

    const cart = await Cart.findById(id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update order status (you'll need to add status field to Cart model)
    // For now, just return success
    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: {
        _id: cart._id,
        status
      }
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message
    });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    const cart = await Cart.findById(id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    await Cart.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Order deleted successfully"
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message
    });
  }
};

// =================== SYSTEM MANAGEMENT ===================
exports.getSystemInfo = async (req, res) => {
  try {
    const os = require("os");
    
    const systemInfo = {
      nodeVersion: process.version,
      platform: os.platform(),
      architecture: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + " GB",
      freeMemory: Math.round(os.freemem() / 1024 / 1024) + " MB",
      uptime: Math.floor(process.uptime()) + " seconds",
      environment: process.env.NODE_ENV || "development",
      databaseStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      systemInfo
    });
  } catch (error) {
    console.error("Get system info error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching system info",
      error: error.message
    });
  }
};

exports.createBackup = async (req, res) => {
  try {
    // This is a placeholder for backup functionality
    // In production, you would implement actual backup logic
    const backupData = {
      timestamp: new Date().toISOString(),
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      categories: await Category.countDocuments(),
      brands: await Brand.countDocuments(),
      carts: await Cart.countDocuments()
    };

    res.json({
      success: true,
      message: "Backup created successfully",
      backup: backupData
    });
  } catch (error) {
    console.error("Create backup error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating backup",
      error: error.message
    });
  }
};

exports.clearCache = async (req, res) => {
  try {
    // Placeholder for cache clearing
    res.json({
      success: true,
      message: "Cache cleared successfully"
    });
  } catch (error) {
    console.error("Clear cache error:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing cache",
      error: error.message
    });
  }
};

exports.getSystemLogs = async (req, res) => {
  try {
    // Placeholder for system logs
    res.json({
      success: true,
      message: "System logs retrieved",
      logs: []
    });
  } catch (error) {
    console.error("Get system logs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching system logs",
      error: error.message
    });
  }
};