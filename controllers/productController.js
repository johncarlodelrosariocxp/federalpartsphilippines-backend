// backend/controllers/productController.js
const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const { Parser } = require("json2csv");

// =================== PUBLIC CONTROLLERS ===================

// Get all products with filtering, sorting, and pagination
exports.getAllProducts = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 12,
      featured,
      inStock,
      brand,
    } = req.query;

    const query = { isActive: true };

    // Category filter
    if (
      category &&
      category !== "all" &&
      mongoose.Types.ObjectId.isValid(category)
    ) {
      query.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    // Featured filter
    if (featured === "true") {
      query.featured = true;
    } else if (featured === "false") {
      query.featured = false;
    }

    // Stock filter
    if (inStock === "true") {
      query.stock = { $gt: 0 };
    } else if (inStock === "false") {
      query.stock = 0;
    }

    // Brand filter
    if (brand && brand !== "all") {
      query.brand = { $regex: brand, $options: "i" };
    }

    // Calculate skip for pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Sort configuration
    const sortOptions = {};
    sortOptions[sortBy] = order === "asc" ? 1 : -1;

    // Execute query with population
    const products = await Product.find(query)
      .populate("category", "name image")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    // Get total count for pagination
    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages,
      currentPage: Number(page),
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
      error: error.message,
    });
  }
};

// Get single product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id)
      .populate("category", "name description image")
      .populate({
        path: "reviews.user",
        select: "name email",
        match: { approved: true }, // Only show approved reviews
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Only return active products for non-admin users
    if (!product.isActive && !req.user?.isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product",
      error: error.message,
    });
  }
};

// Get featured products
exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({
      featured: true,
      isActive: true,
      stock: { $gt: 0 },
    })
      .populate("category", "name image")
      .limit(8)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get featured products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching featured products",
      error: error.message,
    });
  }
};

// Search products
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
        { sku: { $regex: query, $options: "i" } },
      ],
      isActive: true,
    })
      .populate("category", "name")
      .limit(20);

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Search products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching products",
      error: error.message,
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const { page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find({
      category: categoryId,
      isActive: true,
    })
      .populate("category", "name image")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments({
      category: categoryId,
      isActive: true,
    });
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages,
      currentPage: Number(page),
      products,
    });
  } catch (error) {
    console.error("Get products by category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category products",
      error: error.message,
    });
  }
};

// Get related products
exports.getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
      stock: { $gt: 0 },
    })
      .populate("category", "name")
      .limit(4)
      .sort({ rating: -1 });

    res.json({
      success: true,
      count: relatedProducts.length,
      products: relatedProducts,
    });
  } catch (error) {
    console.error("Get related products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching related products",
      error: error.message,
    });
  }
};

// Add review to product
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.id;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      (review) => review.user.toString() === userId.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Create new review
    const newReview = {
      user: userId,
      rating: Number(rating),
      comment,
      approved: false, // Default to not approved (admin moderation)
      createdAt: new Date(),
    };

    // Add review to product
    product.reviews.push(newReview);

    // Recalculate average rating
    const totalRating = product.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    product.rating = totalRating / product.reviews.length;

    await product.save();

    const updatedProduct = await Product.findById(productId)
      .populate("category", "name")
      .populate({
        path: "reviews.user",
        select: "name email",
      });

    res.status(201).json({
      success: true,
      message: "Review added successfully and pending approval",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(400).json({
      success: false,
      message: "Error adding review",
      error: error.message,
    });
  }
};

// =================== ADMIN CONTROLLERS ===================

// Create new product
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      images,
      stock,
      specifications,
      brand,
      sku,
      discountedPrice,
      weight,
      dimensions,
      featured,
      isActive,
    } = req.body;

    // Validate required fields
    if (!name || !price || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, price, description, and category are required fields",
      });
    }

    // Validate price
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    // Validate category if provided
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
      }

      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Check if SKU already exists
    if (sku) {
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    // Generate SKU if not provided
    const generatedSku =
      sku ||
      `SKU-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;

    // Create product
    const product = new Product({
      name,
      description,
      price,
      category,
      images: images || [],
      stock: stock || 0,
      specifications: specifications || {},
      brand,
      sku: generatedSku,
      discountedPrice,
      weight,
      dimensions,
      featured: featured || false,
      isActive: isActive !== undefined ? isActive : true,
    });

    await product.save();

    const populatedProduct = await Product.findById(product._id).populate(
      "category",
      "name"
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: populatedProduct,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(400).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if SKU is being updated and already exists
    if (req.body.sku && req.body.sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku: req.body.sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    // Validate category if being updated
    if (
      req.body.category &&
      req.body.category !== product.category.toString()
    ) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
      }

      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        product[key] = req.body[key];
      }
    });

    product.updatedAt = Date.now();
    await product.save();

    const updatedProduct = await Product.findById(product._id).populate(
      "category",
      "name"
    );

    res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(400).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

// Delete product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Soft delete by setting isActive to false
    product.isActive = false;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product",
      error: error.message,
    });
  }
};

// Update product stock
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
    }

    product.stock = Math.max(0, Number(quantity));
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: "Stock updated successfully",
      stock: product.stock,
    });
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating stock",
      error: error.message,
    });
  }
};

// Bulk update products
exports.bulkUpdateProducts = async (req, res) => {
  try {
    const { productIds, updateData } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs are required",
      });
    }

    // Validate all product IDs
    const invalidIds = productIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid product IDs: ${invalidIds.join(", ")}`,
      });
    }

    // Update all products
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData, updatedAt: Date.now() }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while bulk updating products",
      error: error.message,
    });
  }
};

// Bulk delete products
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs are required",
      });
    }

    // Validate all product IDs
    const invalidIds = productIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid product IDs: ${invalidIds.join(", ")}`,
      });
    }

    // Soft delete all products
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { isActive: false, updatedAt: Date.now() } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products deleted successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while bulk deleting products",
      error: error.message,
    });
  }
};

// Bulk update product status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { productIds, isActive } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs are required",
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Validate all product IDs
    const invalidIds = productIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid product IDs: ${invalidIds.join(", ")}`,
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { isActive, updatedAt: Date.now() } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products status updated to ${
        isActive ? "active" : "inactive"
      }`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while bulk updating status",
      error: error.message,
    });
  }
};

// Get product statistics
exports.getProductStats = async (req, res) => {
  try {
    // Use aggregation for better performance
    const stats = await Product.aggregate([
      {
        $facet: {
          // Total counts
          totals: [
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
                activeProducts: {
                  $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                },
                featuredProducts: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$featured", true] },
                          { $eq: ["$isActive", true] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                outOfStockProducts: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$stock", 0] },
                          { $eq: ["$isActive", true] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                lowStockProducts: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ["$stock", 0] },
                          { $lte: ["$stock", 10] },
                          { $eq: ["$isActive", true] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          // Inventory value
          inventory: [
            { $match: { isActive: true } },
            {
              $group: {
                _id: null,
                totalInventoryValue: {
                  $sum: { $multiply: ["$price", "$stock"] },
                },
                averagePrice: { $avg: "$price" },
                totalStock: { $sum: "$stock" },
                minPrice: { $min: "$price" },
                maxPrice: { $max: "$price" },
              },
            },
          ],
          // Products by category
          byCategory: [
            { $match: { isActive: true } },
            {
              $group: {
                _id: "$category",
                count: { $sum: 1 },
                totalStock: { $sum: "$stock" },
                avgPrice: { $avg: "$price" },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          // Recent products
          recentProducts: [
            { $match: { isActive: true } },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                name: 1,
                price: 1,
                stock: 1,
                category: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    // Get category names
    const categoryStats = stats[0].byCategory;
    const categoryIds = categoryStats
      .map((stat) => stat._id)
      .filter((id) => id);

    let categories = [];
    if (categoryIds.length > 0) {
      categories = await Category.find(
        { _id: { $in: categoryIds } },
        "name _id"
      );
    }

    // Map category names to stats
    const productsByCategory = categoryStats.map((stat) => {
      const category = categories.find((cat) => cat._id.equals(stat._id));
      return {
        categoryId: stat._id,
        categoryName: category ? category.name : "Uncategorized",
        count: stat.count,
        totalStock: stat.totalStock,
        avgPrice: stat.avgPrice,
      };
    });

    const totals = stats[0].totals[0] || {
      totalProducts: 0,
      activeProducts: 0,
      featuredProducts: 0,
      outOfStockProducts: 0,
      lowStockProducts: 0,
    };

    const inventory = stats[0].inventory[0] || {
      totalInventoryValue: 0,
      averagePrice: 0,
      totalStock: 0,
      minPrice: 0,
      maxPrice: 0,
    };

    res.json({
      success: true,
      stats: {
        totals: {
          products: totals.totalProducts,
          active: totals.activeProducts,
          featured: totals.featuredProducts,
          outOfStock: totals.outOfStockProducts,
          lowStock: totals.lowStockProducts,
        },
        inventory: inventory,
        productsByCategory: productsByCategory,
        recentProducts: stats[0].recentProducts || [],
      },
    });
  } catch (error) {
    console.error("Get product stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product statistics",
      error: error.message,
    });
  }
};

// Get low stock products
exports.getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const products = await Product.find({
      stock: { $gt: 0, $lte: threshold },
      isActive: true,
    })
      .populate("category", "name")
      .sort({ stock: 1 });

    res.json({
      success: true,
      count: products.length,
      threshold,
      products,
    });
  } catch (error) {
    console.error("Get low stock products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching low stock products",
      error: error.message,
    });
  }
};

// Export products to CSV
exports.exportProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate("category", "name").lean();

    // Format products for CSV
    const formattedProducts = products.map((product) => ({
      ID: product._id,
      Name: product.name,
      SKU: product.sku || "",
      Description: product.description,
      Category: product.category?.name || "",
      Brand: product.brand || "",
      Price: product.price,
      DiscountedPrice: product.discountedPrice || "",
      Stock: product.stock,
      Weight: product.weight || "",
      Dimensions: product.dimensions || "",
      Featured: product.featured ? "Yes" : "No",
      Active: product.isActive ? "Yes" : "No",
      Created: new Date(product.createdAt).toISOString(),
      Updated: new Date(product.updatedAt).toISOString(),
    }));

    // Convert to CSV
    const fields = [
      "ID",
      "Name",
      "SKU",
      "Description",
      "Category",
      "Brand",
      "Price",
      "DiscountedPrice",
      "Stock",
      "Weight",
      "Dimensions",
      "Featured",
      "Active",
      "Created",
      "Updated",
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(formattedProducts);

    // Set headers for CSV download
    res.header("Content-Type", "text/csv");
    res.attachment(`products_${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while exporting products",
      error: error.message,
    });
  }
};

// Upload product image
exports.uploadProductImage = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // In production, use multer middleware for file uploads
    // For now, accept base64 image data
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Image data is required",
      });
    }

    // Validate base64 image
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format. Must be base64 data URL",
      });
    }

    product.images.push(image);
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: "Image uploaded successfully",
      images: product.images,
    });
  } catch (error) {
    console.error("Upload product image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while uploading image",
      error: error.message,
    });
  }
};

// Delete product image
exports.deleteProductImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (isNaN(index) || index < 0 || index >= product.images.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid image index",
      });
    }

    product.images.splice(index, 1);
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: "Image deleted successfully",
      images: product.images,
    });
  } catch (error) {
    console.error("Delete product image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting image",
      error: error.message,
    });
  }
};

// Toggle product featured status
exports.toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.featured = !product.featured;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: `Product ${
        product.featured ? "marked as" : "removed from"
      } featured`,
      featured: product.featured,
    });
  } catch (error) {
    console.error("Toggle featured error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating featured status",
      error: error.message,
    });
  }
};

// Toggle product active status
exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.isActive = !product.isActive;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: `Product ${product.isActive ? "activated" : "deactivated"}`,
      isActive: product.isActive,
    });
  } catch (error) {
    console.error("Toggle active error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating active status",
      error: error.message,
    });
  }
};

// Get all products for admin (including inactive)
exports.getAllProductsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      featured,
      category,
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    } else if (status === "out_of_stock") {
      query.stock = 0;
    } else if (status === "low_stock") {
      query.stock = { $gt: 0, $lte: 10 };
    } else if (status === "in_stock") {
      query.stock = { $gt: 10 };
    }

    // Featured filter
    if (featured === "true") {
      query.featured = true;
    } else if (featured === "false") {
      query.featured = false;
    }

    // Category filter
    if (
      category &&
      category !== "all" &&
      mongoose.Types.ObjectId.isValid(category)
    ) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOptions = {};
    sortOptions[sortBy] = order === "asc" ? 1 : -1;

    const products = await Product.find(query)
      .populate("category", "name")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages,
      currentPage: Number(page),
      products,
    });
  } catch (error) {
    console.error("Get all products for admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products for admin",
      error: error.message,
    });
  }
};

// Get product reviews for admin
exports.getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id).populate({
      path: "reviews.user",
      select: "name email",
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      count: product.reviews.length,
      reviews: product.reviews,
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product reviews",
      error: error.message,
    });
  }
};

// Update review status (admin moderation)
exports.updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { approved } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID format",
      });
    }

    // Find product containing this review
    const product = await Product.findOne({ "reviews._id": reviewId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Update review status
    const reviewIndex = product.reviews.findIndex(
      (r) => r._id.toString() === reviewId
    );
    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Update the approved status
    product.reviews[reviewIndex].approved =
      approved !== undefined ? approved : true;
    product.reviews[reviewIndex].updatedAt = new Date();

    await product.save();

    res.json({
      success: true,
      message: "Review status updated successfully",
    });
  } catch (error) {
    console.error("Update review status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating review status",
      error: error.message,
    });
  }
};
