require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Import models
const Product = require("./models/Product");
const Category = require("./models/Category");

const app = express();

// ============================================
// 🖼️ MULTER CONFIGURATION FOR IMAGE UPLOADS
// ============================================

// Create uploads directory structure
const uploadsDir = path.join(__dirname, "uploads");
const categoryUploadsDir = path.join(uploadsDir, "categories");
const productUploadsDir = path.join(uploadsDir, "products");

// Create directories if they don't exist
[uploadsDir, categoryUploadsDir, productUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage for categories
const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, categoryUploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = "category-" + uniqueSuffix + ext;
    cb(null, filename);
  },
});

// Configure multer storage for products
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = "product-" + uniqueSuffix + ext;
    cb(null, filename);
  },
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Initialize multer uploads
const uploadProductImages = multer({
  storage: productStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// ============================================
// 🛡️ MIDDLEWARE
// ============================================

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "https://federalpartsphilippines.vercel.app" ],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================
// 📊 DATABASE CONNECTION
// ============================================

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/federal-parts";

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.log("❌ MongoDB connection failed");
    console.log("Error:", err.message);
  }
};

connectDB();

// ============================================
// 🖼️ IMAGE UPLOAD UTILITY FUNCTIONS
// ============================================

/**
 * Deletes image file from server
 * @param {string} imagePath - Path to the image file
 */
const deleteImageFile = (imagePath) => {
  if (!imagePath) return;

  let fullPath;

  // Handle different path formats
  if (imagePath.startsWith("uploads/")) {
    fullPath = path.join(__dirname, imagePath);
  } else if (imagePath.startsWith("/uploads/")) {
    fullPath = path.join(__dirname, imagePath.substring(1));
  } else if (imagePath.includes("categories/")) {
    // Extract just the filename and reconstruct path
    const filename = imagePath.split("/").pop();
    fullPath = path.join(categoryUploadsDir, filename);
  } else if (imagePath.includes("products/")) {
    const filename = imagePath.split("/").pop();
    fullPath = path.join(productUploadsDir, filename);
  } else {
    // Assume it's a filename, try to find in appropriate directory
    if (imagePath.startsWith("category-")) {
      fullPath = path.join(categoryUploadsDir, imagePath);
    } else if (imagePath.startsWith("product-")) {
      fullPath = path.join(productUploadsDir, imagePath);
    } else {
      // Try to find in uploads directory
      fullPath = path.join(__dirname, "uploads", imagePath);
    }
  }

  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) {
        console.error("❌ Error deleting image file:", err.message);
      } else {
        console.log("✅ Deleted image file:", fullPath);
      }
    });
  }
};

/**
 * Gets the public URL for an uploaded image
 * @param {string} filename - The filename stored in database
 * @param {string} type - 'category' or 'product'
 * @returns {string} Public URL
 */
const getImageUrl = (filename, type = "product") => {
  if (!filename || filename.trim() === "") {
    return ""; // Return empty string for no image
  }

  // If it's already a full URL or data URL, return as is
  if (filename.startsWith("http") || filename.startsWith("data:")) {
    return filename;
  }

  // If it already has /uploads/ prefix, return as is
  if (filename.startsWith("/uploads/")) {
    return filename;
  }

  // If it's just a filename, construct URL based on type
  if (type === "category") {
    return `/uploads/categories/${filename}`;
  } else {
    return `/uploads/products/${filename}`;
  }
};

/**
 * Extracts filename from a URL or path
 * @param {string} imagePath - Full URL or path
 * @returns {string} Just the filename
 */
const extractFilename = (imagePath) => {
  if (!imagePath || imagePath.trim() === "") return "";

  // If it's a URL, extract just the filename
  if (imagePath.includes("/")) {
    const filename = imagePath.split("/").pop();
    return filename || "";
  }

  // If it's already just a filename, return as is
  return imagePath;
};

/**
 * Saves base64 image to file and returns filename
 * @param {string} base64Data - Base64 image data
 * @param {string} type - 'product' or 'category'
 * @returns {string} Filename
 */
const saveBase64Image = (base64Data, type = "product") => {
  if (!base64Data || !base64Data.startsWith("data:image/")) {
    return "";
  }

  try {
    // Extract mime type and base64 data
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return "";
    }

    const mimeType = matches[1];
    const base64String = matches[2];
    const buffer = Buffer.from(base64String, "base64");

    // Determine directory and extension
    const dir = type === "category" ? categoryUploadsDir : productUploadsDir;
    const prefix = type === "category" ? "category-" : "product-";
    const ext = mimeType === "jpeg" ? "jpg" : mimeType;

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${prefix}${uniqueSuffix}.${ext}`;
    const filepath = path.join(dir, filename);

    // Save file
    fs.writeFileSync(filepath, buffer);

    console.log(`✅ Saved base64 image as: ${filename}`);
    return filename;
  } catch (error) {
    console.error("❌ Error saving base64 image:", error.message);
    return "";
  }
};

/**
 * Processes images array - converts base64 to files, extracts filenames
 * @param {Array} images - Array of images (base64 or filenames)
 * @param {string} type - 'product' or 'category'
 * @returns {Array} Array of filenames
 */
const processImagesArray = (images, type = "product") => {
  if (!images || !Array.isArray(images)) {
    return [];
  }

  const filenames = [];

  for (const image of images) {
    if (!image || typeof image !== "string" || image.trim() === "") continue;

    if (image.startsWith("data:image/")) {
      // It's a base64 image - save it
      const filename = saveBase64Image(image, type);
      if (filename) {
        filenames.push(filename);
      }
    } else if (image.includes("/")) {
      // It's a URL - extract filename
      const filename = extractFilename(image);
      if (filename) {
        filenames.push(filename);
      }
    } else {
      // It's already a filename
      filenames.push(image);
    }
  }

  return [...new Set(filenames.filter((f) => f && f.trim() !== ""))];
};

/**
 * Processes product data for response - ensures image URLs are correct
 * @param {Object} product - Product object from database
 * @returns {Object} Processed product with correct image URLs
 */
const processProductForResponse = (product) => {
  const productObj = product.toObject ? product.toObject() : product;

  // Ensure images is always an array
  if (!Array.isArray(productObj.images)) {
    productObj.images = [];
  }

  // Process images array to ensure full URLs
  productObj.images = productObj.images
    .filter((image) => image && image.trim() !== "")
    .map((image) => {
      // If image is already a full URL, keep it
      if (
        image.startsWith("http") ||
        image.startsWith("data:") ||
        image.startsWith("/uploads/")
      ) {
        return image;
      }

      // Check if image exists in uploads directory
      const imagePath = path.join(productUploadsDir, image);
      if (fs.existsSync(imagePath)) {
        return `/uploads/products/${image}`;
      }

      // Image doesn't exist on server, return empty
      console.warn(`⚠️ Image not found on server: ${image}`);
      return "";
    })
    .filter((image) => image !== ""); // Remove empty strings

  return productObj;
};

// ============================================
// 🛣️ MAIN ROUTES
// ============================================

// ROOT ROUTE - Server status
app.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  
  res.json({
    success: true,
    message: "🚀 Federal Parts Philippines Backend API",
    status: "Server is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    database: dbStatus,
    endpoints: {
      api: "/api",
      products: "/api/products",
      categories: "/api/categories",
      health: "/health",
      uploads: "/uploads",
      admin: {
        products: "/api/admin/products",
        createProduct: "/api/admin/products (POST)",
        updateProduct: "/api/admin/products/:id (PUT)"
      }
    },
    documentation: "See /api for detailed endpoint information"
  });
});

// 🔧 TEST ROUTE
app.get("/api", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    message: "✅ Federal Parts API is running",
    database: dbStatus,
    uploadsPath: uploadsDir,
    endpoints: {
      products: "/api/products",
      singleProduct: "/api/products/:id",
      uploadImage: "/api/upload",
      uploadCategoryImage: "/api/upload/category",
      adminProducts: "/api/admin/products",
      categories: "/api/categories",
      createCategory: "/api/categories",
      health: "/health",
    },
  });
});

// ============================================
// 🖼️ IMAGE UPLOAD ROUTES
// ============================================

// POST /api/upload - Upload single image (for products)
app.post(
  "/api/upload",
  uploadProductImages.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      // Construct image URL
      const imageUrl = `/uploads/products/${req.file.filename}`;

      res.json({
        success: true,
        message: "Image uploaded successfully",
        image: {
          url: imageUrl,
          filename: req.file.filename, // Return filename for database storage
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("❌ Image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error: error.message,
      });
    }
  }
);

// POST /api/upload/category - Upload category image
app.post(
  "/api/upload/category",
  uploadCategoryImage.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      // Construct image URL
      const imageUrl = `/uploads/categories/${req.file.filename}`;

      res.json({
        success: true,
        message: "Category image uploaded successfully",
        image: {
          url: imageUrl,
          filename: req.file.filename, // Return filename for database storage
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("❌ Category image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload category image",
        error: error.message,
      });
    }
  }
);

// POST /api/upload/base64 - Upload base64 image
app.post("/api/upload/base64", async (req, res) => {
  try {
    const { image, type = "product" } = req.body;

    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid base64 image data",
      });
    }

    const filename = saveBase64Image(image, type);
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: "Failed to save image",
      });
    }

    const imageUrl =
      type === "category"
        ? `/uploads/categories/${filename}`
        : `/uploads/products/${filename}`;

    res.json({
      success: true,
      message: "Base64 image uploaded successfully",
      image: {
        url: imageUrl,
        filename: filename,
      },
    });
  } catch (error) {
    console.error("❌ Base64 image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload base64 image",
      error: error.message,
    });
  }
});

// ============================================
// 📁 CATEGORY ROUTES WITH IMAGE UPLOAD SUPPORT
// ============================================

// GET /api/categories - Get all categories (with image URL processing)
app.get("/api/categories", async (req, res) => {
  try {
    const { includeInactive, search, parent, includeTree } = req.query;

    let filter = {};

    // Filter by active status
    if (!includeInactive || includeInactive === "false") {
      filter.isActive = true;
    }

    // Filter by parent category
    if (parent === "null" || parent === "none") {
      filter.parentCategory = null;
    } else if (parent) {
      filter.parentCategory = parent;
    }

    // Search by name
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let categories;

    if (includeTree === "true") {
      // Get hierarchical structure
      categories = await Category.find(filter)
        .populate({
          path: "children",
          match: { isActive: true },
          options: { sort: { order: 1, name: 1 } },
        })
        .sort({ order: 1, name: 1 });

      // Filter to get only parent categories for tree view
      categories = categories.filter((cat) => !cat.parentCategory);
    } else {
      // Get flat list
      categories = await Category.find(filter).sort({ order: 1, name: 1 });
    }

    // Process images to ensure full URLs
    const processedCategories = categories.map((category) => {
      const categoryObj = category.toObject();

      // Ensure image has full URL
      if (categoryObj.image) {
        categoryObj.image = getImageUrl(categoryObj.image, "category");
      }

      return categoryObj;
    });

    res.json({
      success: true,
      categories: processedCategories,
      count: categories.length,
    });
  } catch (error) {
    console.error("❌ Categories error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
});

// GET /api/categories/:id - Get single category
app.get("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    const category = await Category.findById(id)
      .populate("children")
      .populate("parentCategory");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Process image URL
    const categoryObj = category.toObject();
    if (categoryObj.image) {
      categoryObj.image = getImageUrl(categoryObj.image, "category");
    }

    res.json({
      success: true,
      category: categoryObj,
    });
  } catch (error) {
    console.error("❌ Category error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message,
    });
  }
});

// POST /api/categories - Create new category WITH FILE UPLOAD
app.post(
  "/api/categories",
  uploadCategoryImage.single("image"),
  async (req, res) => {
    try {
      console.log("📥 Creating category with data:", req.body);
      console.log("📁 Uploaded file:", req.file);

      const {
        name,
        description,
        parentCategory,
        isActive = true,
        order = 0,
        seoTitle,
        seoDescription,
        seoKeywords,
      } = req.body;

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      // Check if category already exists
      const existingCategory = await Category.findOne({ name: name.trim() });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }

      // Handle uploaded image - store only the filename in database
      let imageFilename = "";
      if (req.file) {
        imageFilename = req.file.filename; // Store only filename
      }

      const category = new Category({
        name: name.trim(),
        description: description ? description.trim() : "",
        parentCategory: parentCategory || null,
        isActive: isActive,
        order: order || 0,
        seoTitle: seoTitle ? seoTitle.trim() : "",
        seoDescription: seoDescription ? seoDescription.trim() : "",
        seoKeywords: seoKeywords ? seoKeywords.trim() : "",
        image: imageFilename, // Store ONLY filename in database
      });

      await category.save();

      // Return category with full image URL in response
      const categoryObj = category.toObject();
      if (imageFilename) {
        categoryObj.image = getImageUrl(imageFilename, "category");
      }

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        category: categoryObj,
      });
    } catch (error) {
      console.error("❌ Create category error:", error);
      res.status(400).json({
        success: false,
        message: "Error creating category",
        error: error.message,
      });
    }
  }
);

// PUT /api/categories/:id - Update category WITH IMAGE HANDLING
app.put(
  "/api/categories/:id",
  uploadCategoryImage.single("image"),
  async (req, res) => {
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

      const {
        name,
        description,
        parentCategory,
        isActive,
        order,
        seoTitle,
        seoDescription,
        seoKeywords,
      } = req.body;

      // Update fields if provided
      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({
            success: false,
            message: "Category name cannot be empty",
          });
        }

        // Check if new name conflicts with other categories
        const existingCategory = await Category.findOne({
          name: name.trim(),
          _id: { $ne: id },
        });
        if (existingCategory) {
          return res.status(400).json({
            success: false,
            message: "Category with this name already exists",
          });
        }
        category.name = name.trim();
      }

      if (description !== undefined)
        category.description = description ? description.trim() : "";
      if (parentCategory !== undefined)
        category.parentCategory = parentCategory || null;
      if (isActive !== undefined) category.isActive = isActive;
      if (order !== undefined) category.order = order;
      if (seoTitle !== undefined)
        category.seoTitle = seoTitle ? seoTitle.trim() : "";
      if (seoDescription !== undefined)
        category.seoDescription = seoDescription ? seoDescription.trim() : "";
      if (seoKeywords !== undefined)
        category.seoKeywords = seoKeywords ? seoKeywords.trim() : "";

      // Handle image update
      if (req.file) {
        // Delete old image if exists
        if (category.image) {
          deleteImageFile(category.image);
        }
        // Set new image - store only filename
        category.image = req.file.filename;
      } else if (req.body.removeImage === "true") {
        // Handle image removal request
        if (category.image) {
          deleteImageFile(category.image);
          category.image = "";
        }
      } else if (req.body.image && req.body.image.startsWith("data:image/")) {
        // Handle base64 image
        if (category.image) {
          deleteImageFile(category.image);
        }
        const filename = saveBase64Image(req.body.image, "category");
        if (filename) {
          category.image = filename;
        }
      }

      await category.save();

      // Process image URL for response
      const categoryObj = category.toObject();
      if (categoryObj.image) {
        categoryObj.image = getImageUrl(categoryObj.image, "category");
      }

      res.json({
        success: true,
        message: "Category updated successfully",
        category: categoryObj,
      });
    } catch (error) {
      console.error("❌ Update category error:", error);
      res.status(400).json({
        success: false,
        message: "Error updating category",
        error: error.message,
      });
    }
  }
);

// DELETE /api/categories/:id - Delete category WITH IMAGE CLEANUP
app.delete("/api/categories/:id", async (req, res) => {
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

    // Check if category has children
    const childCount = await Category.countDocuments({ parentCategory: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with sub-categories. Please delete sub-categories first.",
      });
    }

    // Delete associated image file
    if (category.image) {
      deleteImageFile(category.image);
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message,
    });
  }
});

// ============================================
// 📦 PRODUCT ROUTES
// ============================================

// GET /api/products - Fetch all products from MongoDB
app.get("/api/products", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      minPrice,
      maxPrice,
      featured,
      inStock,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Build filter for MongoDB query
    const filter = { isActive: true };

    if (category && category !== "all" && category !== "null") {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (featured === "true") {
      filter.featured = true;
    }

    if (inStock === "true") {
      filter.stock = { $gt: 0 };
    } else if (inStock === "false") {
      filter.stock = 0;
    }

    // Fetch from MongoDB
    const products = await Product.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort(sort);

    // Process image URLs for each product
    const processedProducts = products.map((product) =>
      processProductForResponse(product)
    );

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: processedProducts.length,
      total,
      totalPages,
      currentPage: Number(page),
      products: processedProducts,
      filters: {
        category,
        search,
        minPrice,
        maxPrice,
        featured,
        inStock,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products from database",
      error: error.message,
    });
  }
});

// GET /api/products/:id - Fetch single product from MongoDB
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if it's a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Process product for response
    const processedProduct = processProductForResponse(product);

    res.json({
      success: true,
      product: processedProduct,
    });
  } catch (error) {
    console.error("❌ Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
});

// ============================================
// 🔧 ADMIN ROUTES
// ============================================

// GET /api/admin/products - Get all products for admin
app.get("/api/admin/products", async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "", category = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "all" && category !== "null") {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Process image URLs for admin view
    const processedProducts = products.map((product) =>
      processProductForResponse(product)
    );

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: processedProducts.length,
      total,
      totalPages,
      currentPage: Number(page),
      products: processedProducts,
    });
  } catch (error) {
    console.error("❌ Admin products error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin products",
      error: error.message,
    });
  }
});

// POST /api/admin/products - Create new product in MongoDB WITH IMAGE UPLOAD
app.post(
  "/api/admin/products",
  uploadProductImages.array("images", 10),
  async (req, res) => {
    try {
      console.log("📥 Creating product with data:", req.body);
      console.log("📁 Uploaded files:", req.files?.length || 0, "files");

      const {
        name,
        description,
        price,
        category,
        stock = 0,
        brand,
        sku,
        discountedPrice,
        weight,
        dimensions,
        specifications = {},
        featured = false,
        isActive = true,
      } = req.body;

      // Validate required fields
      if (!name || !description || !price) {
        return res.status(400).json({
          success: false,
          message: "Name, description, and price are required",
        });
      }

      // Validate price
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a positive number",
        });
      }

      // Process images
      let imageFilenames = [];

      // 1. Handle uploaded files from multer
      if (req.files && req.files.length > 0) {
        imageFilenames = req.files.map((file) => file.filename);
        console.log("📸 Added uploaded files:", imageFilenames);
      }

      // 2. Handle images from request body (could be base64 or filenames)
      if (req.body.images) {
        try {
          let bodyImages = req.body.images;

          // Parse if it's a JSON string
          if (typeof bodyImages === "string") {
            try {
              bodyImages = JSON.parse(bodyImages);
            } catch (e) {
              // If not JSON, treat as single image string
              bodyImages = [bodyImages];
            }
          }

          // Ensure it's an array
          if (Array.isArray(bodyImages)) {
            const processed = processImagesArray(bodyImages, "product");
            imageFilenames = [...imageFilenames, ...processed];
            console.log("📸 Processed images from body:", processed);
          } else if (bodyImages && typeof bodyImages === "string") {
            const processed = processImagesArray([bodyImages], "product");
            imageFilenames = [...imageFilenames, ...processed];
          }
        } catch (e) {
          console.log("📸 Error processing images from body:", e.message);
        }
      }

      // Remove duplicates
      imageFilenames = [
        ...new Set(imageFilenames.filter((img) => img && img.trim() !== "")),
      ];
      console.log("📸 Final images array to save:", imageFilenames);

      // Generate SKU if not provided
      const productSku =
        sku && sku.trim() !== ""
          ? sku.trim()
          : `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const product = new Product({
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        category: category && category !== "null" ? category : null,
        images: imageFilenames,
        stock: parseInt(stock) || 0,
        brand: brand ? brand.trim() : "",
        sku: productSku,
        discountedPrice:
          discountedPrice && !isNaN(discountedPrice) && discountedPrice > 0
            ? parseFloat(discountedPrice)
            : null,
        weight: weight ? weight.trim() : "",
        dimensions: dimensions ? dimensions.trim() : "",
        specifications: specifications || {},
        featured: !!featured,
        isActive: !!isActive,
      });

      await product.save();

      console.log("✅ Product saved to database:", product._id);

      // Process product for response
      const processedProduct = processProductForResponse(product);

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        product: processedProduct,
      });
    } catch (error) {
      console.error("❌ Create product error:", error);
      console.error("❌ Error stack:", error.stack);
      res.status(400).json({
        success: false,
        message: "Error creating product",
        error: error.message,
      });
    }
  }
);

// PUT /api/admin/products/:id - Update product in MongoDB WITH IMAGE UPLOAD
app.put(
  "/api/admin/products/:id",
  uploadProductImages.array("images", 10),
  async (req, res) => {
    try {
      const { id } = req.params;

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

      console.log("📥 Updating product:", id);
      console.log("📁 Uploaded files:", req.files?.length || 0);
      console.log("📝 Request body received");

      const {
        name,
        description,
        price,
        category,
        stock,
        brand,
        sku,
        discountedPrice,
        weight,
        dimensions,
        specifications,
        featured,
        isActive,
        images = "[]", // JSON string of images
        removeImages = "[]", // JSON string of images to remove
      } = req.body;

      // Update fields if provided
      if (name !== undefined && name.trim() !== "") product.name = name.trim();
      if (description !== undefined) product.description = description.trim();
      if (price !== undefined) {
        const priceNum = parseFloat(price);
        if (!isNaN(priceNum) && priceNum > 0) {
          product.price = priceNum;
        }
      }
      if (category !== undefined) {
        product.category = category && category !== "null" ? category : null;
      }
      if (stock !== undefined) product.stock = parseInt(stock) || 0;
      if (brand !== undefined) product.brand = brand ? brand.trim() : "";
      if (sku !== undefined && sku.trim() !== "") product.sku = sku.trim();

      if (discountedPrice !== undefined) {
        product.discountedPrice =
          discountedPrice && !isNaN(discountedPrice) && discountedPrice > 0
            ? parseFloat(discountedPrice)
            : null;
      }

      if (weight !== undefined) product.weight = weight ? weight.trim() : "";
      if (dimensions !== undefined)
        product.dimensions = dimensions ? dimensions.trim() : "";
      if (specifications !== undefined) {
        try {
          const specs =
            typeof specifications === "string"
              ? JSON.parse(specifications)
              : specifications;
          product.specifications = specs || {};
        } catch (e) {
          console.error("❌ Error parsing specifications:", e);
          product.specifications = {};
        }
      }
      if (featured !== undefined) product.featured = !!featured;
      if (isActive !== undefined) product.isActive = !!isActive;

      // Handle images update
      let updatedImages = [];

      try {
        // Parse images from request body
        let imagesArray = images;
        if (typeof imagesArray === "string") {
          try {
            imagesArray = JSON.parse(imagesArray);
          } catch (e) {
            // If not JSON, treat as single image
            imagesArray = [imagesArray];
          }
        }

        // Process images (convert base64 to files, extract filenames)
        if (Array.isArray(imagesArray)) {
          updatedImages = processImagesArray(imagesArray, "product");
          console.log("📸 Processed images:", updatedImages);
        }
      } catch (e) {
        console.error("❌ Error parsing images:", e);
        // If parsing fails, use current images
        updatedImages = [...product.images];
      }

      // Remove specified images
      try {
        const imagesToRemove = JSON.parse(removeImages);
        if (Array.isArray(imagesToRemove)) {
          imagesToRemove.forEach((imageToRemove) => {
            const filename = extractFilename(imageToRemove);
            // Remove from array
            updatedImages = updatedImages.filter((img) => img !== filename);
            // Delete from server
            if (filename) {
              deleteImageFile(filename);
            }
          });
        }
      } catch (e) {
        console.error("❌ Error parsing removeImages:", e);
      }

      // Add new uploaded images
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map((file) => file.filename);
        updatedImages = [...updatedImages, ...newImages];
        console.log("📸 Added uploaded files:", newImages);
      }

      // Remove duplicates and empty values
      updatedImages = [
        ...new Set(updatedImages.filter((img) => img && img.trim() !== "")),
      ];

      console.log("📸 Final images to save:", updatedImages);
      product.images = updatedImages;
      product.updatedAt = Date.now();

      await product.save();

      console.log("✅ Product updated successfully");

      // Process product for response
      const processedProduct = processProductForResponse(product);

      res.json({
        success: true,
        message: "Product updated successfully",
        product: processedProduct,
      });
    } catch (error) {
      console.error("❌ Update product error:", error);
      console.error("❌ Error stack:", error.stack);
      res.status(400).json({
        success: false,
        message: "Error updating product",
        error: error.message,
      });
    }
  }
);

// DELETE /api/admin/products/:id - Delete product from MongoDB
app.delete("/api/admin/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

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

    // Delete associated image files from server
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((image) => {
        // Extract filename and delete
        const filename = extractFilename(image);
        if (filename) {
          deleteImageFile(filename);
        }
      });
    }

    // Soft delete from database
    product.isActive = false;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message,
    });
  }
});

// ============================================
// 📥 OTHER ROUTES
// ============================================

// 🩺 HEALTH CHECK
app.get("/health", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "UP",
    database: dbStatus,
    uptime: process.uptime(),
    uploadsPath: uploadsDir,
  });
});

// ============================================
// 🚨 ERROR HANDLING
// ============================================

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next(err);
});

// 404 - Route not found
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedUrl: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  console.error("🔥 Error stack:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ============================================
// 🚀 START THE SERVER
// ============================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`🚀 Federal Parts Backend Server Started`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
  console.log(`   ├─ Categories: http://localhost:${PORT}/uploads/categories`);
  console.log(`   └─ Products: http://localhost:${PORT}/uploads/products`);
  console.log(
    `📊 Database: ${
      mongoose.connection.readyState === 1 ? "Connected ✅" : "Not Connected ⚠️"
    }`
  );
  console.log(`═══════════════════════════════════════════\n`);
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});