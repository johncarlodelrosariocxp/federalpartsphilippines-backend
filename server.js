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
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: fileFilter,
});

const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: fileFilter,
});

// ============================================
// 🛡️ MIDDLEWARE
// ============================================

// Fix JSON parsing errors - add this BEFORE express.json()
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (data.trim() === '') {
        req.body = {};
        next();
      } else {
        try {
          req.body = JSON.parse(data);
          next();
        } catch (err) {
          console.error('❌ JSON Parse Error:', err.message);
          res.status(400).json({
            success: false,
            message: "Invalid JSON in request body"
          });
        }
      }
    });
  } else {
    next();
  }
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://federalpartsphilippines.vercel.app",
      "https://federalpartsphilippines-frontend.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================
// 📊 DATABASE CONNECTION
// ============================================

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://federal:admin1234@cluster0.glihep0.mongodb.net/?appName=Cluster0";

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

const deleteImageFile = (imagePath) => {
  if (!imagePath) return;

  let fullPath;

  if (imagePath.startsWith("uploads/")) {
    fullPath = path.join(__dirname, imagePath);
  } else if (imagePath.startsWith("/uploads/")) {
    fullPath = path.join(__dirname, imagePath.substring(1));
  } else if (imagePath.includes("categories/")) {
    const filename = imagePath.split("/").pop();
    fullPath = path.join(categoryUploadsDir, filename);
  } else if (imagePath.includes("products/")) {
    const filename = imagePath.split("/").pop();
    fullPath = path.join(productUploadsDir, filename);
  } else {
    if (imagePath.startsWith("category-")) {
      fullPath = path.join(categoryUploadsDir, imagePath);
    } else if (imagePath.startsWith("product-")) {
      fullPath = path.join(productUploadsDir, imagePath);
    } else {
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

const getImageUrl = (filename, type = "product") => {
  if (!filename || filename.trim() === "") {
    return "";
  }

  if (filename.startsWith("http") || filename.startsWith("data:")) {
    return filename;
  }

  if (filename.startsWith("/uploads/")) {
    return filename;
  }

  if (type === "category") {
    return `/uploads/categories/${filename}`;
  } else {
    return `/uploads/products/${filename}`;
  }
};

const extractFilename = (imagePath) => {
  if (!imagePath || imagePath.trim() === "") return "";

  if (imagePath.includes("/")) {
    const filename = imagePath.split("/").pop();
    return filename || "";
  }

  return imagePath;
};

const saveBase64Image = (base64Data, type = "product") => {
  if (!base64Data || !base64Data.startsWith("data:image/")) {
    return "";
  }

  try {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return "";
    }

    const mimeType = matches[1];
    const base64String = matches[2];
    const buffer = Buffer.from(base64String, "base64");

    const dir = type === "category" ? categoryUploadsDir : productUploadsDir;
    const prefix = type === "category" ? "category-" : "product-";
    const ext = mimeType === "jpeg" ? "jpg" : mimeType;

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${prefix}${uniqueSuffix}.${ext}`;
    const filepath = path.join(dir, filename);

    fs.writeFileSync(filepath, buffer);

    console.log(`✅ Saved base64 image as: ${filename}`);
    return filename;
  } catch (error) {
    console.error("❌ Error saving base64 image:", error.message);
    return "";
  }
};

const processImagesArray = (images, type = "product") => {
  if (!images || !Array.isArray(images)) {
    return [];
  }

  const filenames = [];

  for (const image of images) {
    if (!image || typeof image !== "string" || image.trim() === "") continue;

    if (image.startsWith("data:image/")) {
      const filename = saveBase64Image(image, type);
      if (filename) {
        filenames.push(filename);
      }
    } else if (image.includes("/")) {
      const filename = extractFilename(image);
      if (filename) {
        filenames.push(filename);
      }
    } else {
      filenames.push(image);
    }
  }

  return [...new Set(filenames.filter((f) => f && f.trim() !== ""))];
};

const processProductForResponse = (product) => {
  const productObj = product.toObject ? product.toObject() : product;

  if (!Array.isArray(productObj.images)) {
    productObj.images = [];
  }

  productObj.images = productObj.images
    .filter((image) => image && image.trim() !== "")
    .map((image) => {
      if (
        image.startsWith("http") ||
        image.startsWith("data:") ||
        image.startsWith("/uploads/")
      ) {
        return image;
      }

      const imagePath = path.join(productUploadsDir, image);
      if (fs.existsSync(imagePath)) {
        return `/uploads/products/${image}`;
      }

      console.warn(`⚠️ Image not found on server: ${image}`);
      return "";
    })
    .filter((image) => image !== "");

  return productObj;
};

// ============================================
// 🔗 CATEGORY-PRODUCT COUNT UTILITY FUNCTIONS (UPDATED FOR MULTIPLE CATEGORIES)
// ============================================

const updateCategoryProductCount = async (categoryId) => {
  try {
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) return;

    // UPDATED: Now checking if product.categories array includes the categoryId
    const productCount = await Product.countDocuments({
      categories: categoryId,
      isActive: true,
    });

    await Category.findByIdAndUpdate(categoryId, {
      productCount: productCount,
      updatedAt: Date.now(),
    });

    console.log(
      `✅ Updated product count for category ${categoryId}: ${productCount} products`
    );

    // Also update parent categories if any
    const category = await Category.findById(categoryId);
    if (category && category.parentCategory) {
      await updateCategoryProductCount(category.parentCategory);
    }
  } catch (error) {
    console.error("❌ Error updating category product count:", error.message);
  }
};

const updateAllCategoryProductCounts = async () => {
  try {
    console.log("🔄 Updating product counts for all categories...");

    const categories = await Category.find({});
    let updatedCount = 0;

    for (const category of categories) {
      // UPDATED: Check products.categories array instead of product.category
      const productCount = await Product.countDocuments({
        categories: category._id,
        isActive: true,
      });

      if (category.productCount !== productCount) {
        await Category.findByIdAndUpdate(category._id, {
          productCount: productCount,
          updatedAt: Date.now(),
        });
        updatedCount++;
        console.log(
          `   📊 ${category.name}: ${productCount} products ${
            productCount !== category.productCount ? "(updated)" : ""
          }`
        );
      }
    }

    console.log(
      `✅ Updated product counts for ${updatedCount}/${categories.length} categories`
    );

    return {
      success: true,
      message: `Updated ${updatedCount} categories`,
      totalCategories: categories.length,
      updated: updatedCount,
    };
  } catch (error) {
    console.error("❌ Error updating all category product counts:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// ============================================
// 🛣️ MAIN ROUTES
// ============================================

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
    },
  });
});

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
      updateCategoryCounts: "/api/admin/categories/update-counts",
      health: "/health",
    },
  });
});

// ============================================
// 🖼️ IMAGE UPLOAD ROUTES
// ============================================

// GET endpoint to check if images are accessible
app.get("/api/check-image/:filename", (req, res) => {
  const { filename } = req.params;
  const productPath = path.join(productUploadsDir, filename);
  const categoryPath = path.join(categoryUploadsDir, filename);
  
  if (fs.existsSync(productPath)) {
    res.json({
      success: true,
      message: "Image exists in products directory",
      url: `/uploads/products/${filename}`,
      accessible: true
    });
  } else if (fs.existsSync(categoryPath)) {
    res.json({
      success: true,
      message: "Image exists in categories directory",
      url: `/uploads/categories/${filename}`,
      accessible: true
    });
  } else {
    res.status(404).json({
      success: false,
      message: "Image not found",
      accessible: false
    });
  }
});

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

      const imageUrl = `/uploads/products/${req.file.filename}`;

      res.json({
        success: true,
        message: "Image uploaded successfully",
        image: {
          url: imageUrl,
          filename: req.file.filename,
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

      const imageUrl = `/uploads/categories/${req.file.filename}`;

      res.json({
        success: true,
        message: "Category image uploaded successfully",
        image: {
          url: imageUrl,
          filename: req.file.filename,
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
    if (!req.body || !req.body.image) {
      return res.status(400).json({
        success: false,
        message: "No image data provided",
      });
    }

    const { image, type = "product" } = req.body;

    if (!image.startsWith("data:image/")) {
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
// 📁 CATEGORY ROUTES
// ============================================

app.get("/api/categories", async (req, res) => {
  try {
    const { includeInactive, search, parent, includeTree } = req.query;

    let filter = {};

    if (!includeInactive || includeInactive === "false") {
      filter.isActive = true;
    }

    if (parent === "null" || parent === "none") {
      filter.parentCategory = null;
    } else if (parent) {
      filter.parentCategory = parent;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let categories;

    if (includeTree === "true") {
      categories = await Category.find(filter)
        .populate({
          path: "children",
          match: { isActive: true },
          options: { sort: { order: 1, name: 1 } },
        })
        .sort({ order: 1, name: 1 });

      categories = categories.filter((cat) => !cat.parentCategory);
    } else {
      categories = await Category.find(filter).sort({ order: 1, name: 1 });
    }

    const processedCategories = await Promise.all(
      categories.map(async (category) => {
        const categoryObj = category.toObject();

        if (categoryObj.image) {
          categoryObj.image = getImageUrl(categoryObj.image, "category");
        }

        if (categoryObj.productCount === undefined || categoryObj.productCount === null) {
          // UPDATED: Check products.categories array instead of product.category
          const productCount = await Product.countDocuments({
            categories: categoryObj._id,
            isActive: true,
          });
          categoryObj.productCount = productCount;
        }

        if (includeTree === "true" && categoryObj.children && categoryObj.children.length > 0) {
          let totalProductCount = categoryObj.productCount || 0;
          for (const child of categoryObj.children) {
            // UPDATED: Check products.categories array instead of product.category
            const childProductCount = await Product.countDocuments({
              categories: child._id,
              isActive: true,
            });
            child.productCount = childProductCount;
            totalProductCount += childProductCount;
          }
          categoryObj.totalProductCount = totalProductCount;
        }

        return categoryObj;
      })
    );

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

    const categoryObj = category.toObject();
    if (categoryObj.image) {
      categoryObj.image = getImageUrl(categoryObj.image, "category");
    }

    // UPDATED: Check products.categories array instead of product.category
    const productCount = await Product.countDocuments({
      categories: id,
      isActive: true,
    });
    categoryObj.productCount = productCount;

    const recentProducts = await Product.find({
      categories: id,
      isActive: true,
    })
      .limit(5)
      .sort({ createdAt: -1 })
      .select("name price images featured categories");

    const processedRecentProducts = recentProducts.map((product) => {
      const productObj = product.toObject();
      if (productObj.images && productObj.images.length > 0) {
        const firstImage = productObj.images[0];
        if (firstImage && !firstImage.startsWith("http") && !firstImage.startsWith("/uploads/")) {
          productObj.imageUrl = getImageUrl(firstImage, "product");
        } else {
          productObj.imageUrl = firstImage;
        }
      }
      return productObj;
    });

    res.json({
      success: true,
      category: categoryObj,
      productCount: productCount,
      recentProducts: processedRecentProducts,
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

app.post(
  "/api/categories",
  uploadCategoryImage.single("image"),
  async (req, res) => {
    try {
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

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      const existingCategory = await Category.findOne({ name: name.trim() });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }

      let imageFilename = "";
      if (req.file) {
        imageFilename = req.file.filename;
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
        image: imageFilename,
        productCount: 0,
      });

      await category.save();

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

      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({
            success: false,
            message: "Category name cannot be empty",
          });
        }

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

      if (req.file) {
        if (category.image) {
          deleteImageFile(category.image);
        }
        category.image = req.file.filename;
      } else if (req.body.removeImage === "true") {
        if (category.image) {
          deleteImageFile(category.image);
          category.image = "";
        }
      } else if (req.body.image && req.body.image.startsWith("data:image/")) {
        if (category.image) {
          deleteImageFile(category.image);
        }
        const filename = saveBase64Image(req.body.image, "category");
        if (filename) {
          category.image = filename;
        }
      }

      await category.save();

      const categoryObj = category.toObject();
      if (categoryObj.image) {
        categoryObj.image = getImageUrl(categoryObj.image, "category");
      }

      await updateCategoryProductCount(id);

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

    const childCount = await Category.countDocuments({ parentCategory: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with sub-categories. Please delete sub-categories first.",
      });
    }

    // UPDATED: Check products.categories array instead of product.category
    const productCount = await Product.countDocuments({
      categories: id,
      isActive: true,
    });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with products. Please reassign or delete products first.",
        productCount: productCount,
      });
    }

    if (category.image) {
      deleteImageFile(category.image);
    }

    await category.deleteOne();

    if (category.parentCategory) {
      await updateCategoryProductCount(category.parentCategory);
    }

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

app.post("/api/admin/categories/update-counts", async (req, res) => {
  try {
    console.log("🔄 Manual request to update category product counts...");
    const result = await updateAllCategoryProductCounts();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        totalCategories: result.totalCategories,
        updated: result.updated,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("❌ Error in update-counts endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category product counts",
      error: error.message,
    });
  }
});

// ============================================
// 📦 PRODUCT ROUTES (UPDATED FOR MULTIPLE CATEGORIES)
// ============================================

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

    const filter = { isActive: true };

    if (category && category !== "all" && category !== "null") {
      // UPDATED: Now checking if product.categories array includes the category ID
      filter.categories = category;
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

    const products = await Product.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort(sort)
      .populate("categories", "name slug productCount");

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

app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
    }).populate("categories", "name slug image productCount description");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const processedProduct = processProductForResponse(product);

    if (processedProduct.categories && Array.isArray(processedProduct.categories)) {
      processedProduct.categories = processedProduct.categories.map(cat => {
        if (cat && cat.image) {
          cat.image = getImageUrl(cat.image, "category");
        }
        return cat;
      });
    }

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
// 🔧 ADMIN ROUTES (UPDATED FOR MULTIPLE CATEGORIES)
// ============================================

app.get("/api/admin/products", async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "", category = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

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
      // UPDATED: Now checking if product.categories array includes the category ID
      filter.categories = category;
    }

    const products = await Product.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .populate("categories", "name productCount");

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
        categories = "[]", // NEW: Accept multiple categories
        stock = 0,
        brand,
        sku,
        discountedPrice,
        weight,
        dimensions,
        specifications = {},
        featured = false,
        isActive = true,
        images: imagesInput = "[]",
      } = req.body;

      if (!name || !description || !price) {
        return res.status(400).json({
          success: false,
          message: "Name, description, and price are required",
        });
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a positive number",
        });
      }

      let imageFilenames = [];

      // Handle uploaded files
      if (req.files && req.files.length > 0) {
        imageFilenames = req.files.map((file) => file.filename);
        console.log("📸 Added uploaded files:", imageFilenames);
      }

      // Handle images from request body
      let bodyImages = [];
      try {
        if (imagesInput && imagesInput !== "[]") {
          if (typeof imagesInput === "string") {
            if (imagesInput.trim().startsWith("[")) {
              bodyImages = JSON.parse(imagesInput);
            } else {
              bodyImages = [imagesInput];
            }
          } else if (Array.isArray(imagesInput)) {
            bodyImages = imagesInput;
          }
        }
      } catch (e) {
        console.log("📸 Error parsing images from body:", e.message);
        bodyImages = [];
      }

      if (Array.isArray(bodyImages) && bodyImages.length > 0) {
        const processed = processImagesArray(bodyImages, "product");
        imageFilenames = [...imageFilenames, ...processed];
        console.log("📸 Processed images from body:", processed);
      }

      // Remove duplicates
      imageFilenames = [
        ...new Set(imageFilenames.filter((img) => img && img.trim() !== "")),
      ];
      console.log("📸 Final images array to save:", imageFilenames);

      const productSku =
        sku && sku.trim() !== ""
          ? sku.trim()
          : `SKU-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 6)
              .toUpperCase()}`;

      // Process categories - accept both single category and multiple categories
      let productCategories = [];
      
      // Parse categories array
      try {
        if (categories && categories !== "[]") {
          if (typeof categories === "string") {
            if (categories.trim().startsWith("[")) {
              productCategories = JSON.parse(categories);
            } else {
              productCategories = [categories];
            }
          } else if (Array.isArray(categories)) {
            productCategories = categories;
          }
        }
      } catch (e) {
        console.log("📊 Error parsing categories:", e.message);
        productCategories = [];
      }

      // Also add single category if provided for backward compatibility
      if (category && category !== "null" && category.trim() !== "") {
        if (!productCategories.includes(category)) {
          productCategories.push(category);
        }
      }

      // Remove duplicates and empty values
      productCategories = [
        ...new Set(productCategories.filter((cat) => cat && cat.trim() !== "")),
      ];

      const product = new Product({
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        categories: productCategories,
        category: productCategories.length > 0 ? productCategories[0] : null, // For backward compatibility
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
      console.log("📊 Product categories:", productCategories);

      // Update product counts for all categories
      if (productCategories.length > 0) {
        for (const catId of productCategories) {
          await updateCategoryProductCount(catId);
        }
      }

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
      console.log("📝 Request body:", req.body);

      const {
        name,
        description,
        price,
        category,
        categories,
        stock,
        brand,
        sku,
        discountedPrice,
        weight,
        dimensions,
        specifications,
        featured,
        isActive,
        images = "[]",
        removeImages = "[]",
      } = req.body;

      // Store old categories for product count update
      const oldCategories = [...(product.categories || [])];

      // Update fields if provided
      if (name !== undefined && name.trim() !== "") product.name = name.trim();
      if (description !== undefined) product.description = description.trim();
      if (price !== undefined) {
        const priceNum = parseFloat(price);
        if (!isNaN(priceNum) && priceNum > 0) {
          product.price = priceNum;
        }
      }
      
      if (categories !== undefined) {
        // Parse categories array
        let newCategories = [];
        try {
          if (categories && categories !== "[]") {
            if (typeof categories === "string") {
              if (categories.trim().startsWith("[")) {
                newCategories = JSON.parse(categories);
              } else {
                newCategories = [categories];
              }
            } else if (Array.isArray(categories)) {
              newCategories = categories;
            }
          }
        } catch (e) {
          console.error("📊 Error parsing categories:", e);
          newCategories = [];
        }
        
        // Also add single category if provided for backward compatibility
        if (category && category !== "null" && category.trim() !== "") {
          if (!newCategories.includes(category)) {
            newCategories.push(category);
          }
        }
        
        // Remove duplicates and empty values
        product.categories = [
          ...new Set(newCategories.filter((cat) => cat && cat.trim() !== "")),
        ];
        
        // Update single category for backward compatibility
        if (product.categories.length > 0) {
          product.category = product.categories[0];
        } else {
          product.category = null;
        }
      } else if (category !== undefined) {
        // For backward compatibility - single category update
        if (category && category !== "null" && category.trim() !== "") {
          if (!product.categories.includes(category)) {
            product.categories.push(category);
          }
          product.category = category;
        } else {
          product.category = null;
        }
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
            typeof specifications === "string" && specifications.trim() !== ""
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
      let updatedImages = [...product.images];

      // Parse images from request body
      let imagesArray = [];
      try {
        if (images && images.trim() !== "" && images !== "[]") {
          if (typeof images === "string") {
            if (images.trim().startsWith("[")) {
              imagesArray = JSON.parse(images);
            } else {
              imagesArray = [images];
            }
          } else if (Array.isArray(images)) {
            imagesArray = images;
          }
        }
      } catch (e) {
        console.error("❌ Error parsing images:", e);
        imagesArray = [];
      }

      // Process images (convert base64 to files, extract filenames)
      if (Array.isArray(imagesArray) && imagesArray.length > 0) {
        const processed = processImagesArray(imagesArray, "product");
        updatedImages = [...processed];
        console.log("📸 Processed images:", processed);
      }

      // Remove specified images
      try {
        let imagesToRemove = [];
        if (removeImages && removeImages.trim() !== "" && removeImages !== "[]") {
          if (typeof removeImages === "string") {
            if (removeImages.trim().startsWith("[")) {
              imagesToRemove = JSON.parse(removeImages);
            } else {
              imagesToRemove = [removeImages];
            }
          } else if (Array.isArray(removeImages)) {
            imagesToRemove = removeImages;
          }
          
          if (Array.isArray(imagesToRemove)) {
            imagesToRemove.forEach((imageToRemove) => {
              const filename = extractFilename(imageToRemove);
              if (filename) {
                // Remove from array
                updatedImages = updatedImages.filter((img) => img !== filename);
                // Delete from server
                deleteImageFile(filename);
              }
            });
          }
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
      console.log("📊 Updated categories:", product.categories);

      // Update product counts for all affected categories
      const allAffectedCategories = [...new Set([...oldCategories, ...product.categories])];
      
      for (const catId of allAffectedCategories) {
        await updateCategoryProductCount(catId);
      }

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

    const categories = [...(product.categories || [])];

    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((image) => {
        const filename = extractFilename(image);
        if (filename) {
          deleteImageFile(filename);
        }
      });
    }

    product.isActive = false;
    product.updatedAt = Date.now();
    await product.save();

    // Update product counts for all categories this product was in
    for (const categoryId of categories) {
      await updateCategoryProductCount(categoryId);
    }

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
// 🔗 PRODUCT-CATEGORY LINKING ROUTES (NEW)
// ============================================

// POST /api/admin/products/:productId/link-category/:categoryId
app.post("/api/admin/products/:productId/link-category/:categoryId", async (req, res) => {
  try {
    const { productId, categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or category ID format",
      });
    }

    const product = await Product.findById(productId);
    const category = await Category.findById(categoryId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Add category to product's categories array if not already present
    if (!product.categories.includes(categoryId)) {
      product.categories.push(categoryId);
      await product.save();
      
      // Update product count for the category
      await updateCategoryProductCount(categoryId);
    }

    const processedProduct = processProductForResponse(product);

    res.json({
      success: true,
      message: "Product linked to category successfully",
      product: processedProduct,
    });
  } catch (error) {
    console.error("❌ Link product to category error:", error);
    res.status(500).json({
      success: false,
      message: "Error linking product to category",
      error: error.message,
    });
  }
});

// DELETE /api/admin/products/:productId/unlink-category/:categoryId
app.delete("/api/admin/products/:productId/unlink-category/:categoryId", async (req, res) => {
  try {
    const { productId, categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or category ID format",
      });
    }

    const product = await Product.findById(productId);
    const category = await Category.findById(categoryId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Remove category from product's categories array
    const index = product.categories.indexOf(categoryId);
    if (index > -1) {
      product.categories.splice(index, 1);
      await product.save();
      
      // Update product count for the category
      await updateCategoryProductCount(categoryId);
    }

    const processedProduct = processProductForResponse(product);

    res.json({
      success: true,
      message: "Product unlinked from category successfully",
      product: processedProduct,
    });
  } catch (error) {
    console.error("❌ Unlink product from category error:", error);
    res.status(500).json({
      success: false,
      message: "Error unlinking product from category",
      error: error.message,
    });
  }
});

// POST /api/admin/categories/:categoryId/link-products (Bulk link products)
app.post("/api/admin/categories/:categoryId/link-products", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { productIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product IDs provided",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const results = [];
    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let errorCount = 0;

    for (const productId of productIds) {
      try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          results.push({ productId, success: false, error: "Invalid product ID format" });
          errorCount++;
          continue;
        }

        const product = await Product.findById(productId);
        if (!product) {
          results.push({ productId, success: false, error: "Product not found" });
          errorCount++;
          continue;
        }

        if (product.categories.includes(categoryId)) {
          results.push({ productId, success: true, message: "Already linked" });
          alreadyLinkedCount++;
          continue;
        }

        product.categories.push(categoryId);
        await product.save();
        
        results.push({ productId, success: true, message: "Linked successfully" });
        linkedCount++;
      } catch (error) {
        console.error(`❌ Error linking product ${productId}:`, error);
        results.push({ productId, success: false, error: error.message });
        errorCount++;
      }
    }

    // Update product count for the category
    await updateCategoryProductCount(categoryId);

    res.json({
      success: true,
      message: `Bulk linking completed: ${linkedCount} linked, ${alreadyLinkedCount} already linked, ${errorCount} errors`,
      results: results,
      summary: {
        total: productIds.length,
        linked: linkedCount,
        alreadyLinked: alreadyLinkedCount,
        errors: errorCount
      }
    });
  } catch (error) {
    console.error("❌ Bulk link products to category error:", error);
    res.status(500).json({
      success: false,
      message: "Error bulk linking products to category",
      error: error.message,
    });
  }
});

// ============================================
// 📥 OTHER ROUTES
// ============================================

app.get("/health", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "UP",
    database: dbStatus,
    uptime: process.uptime(),
    uploadsPath: uploadsDir,
    directories: {
      uploads: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [],
      products: fs.existsSync(productUploadsDir) ? fs.readdirSync(productUploadsDir) : [],
      categories: fs.existsSync(categoryUploadsDir) ? fs.readdirSync(categoryUploadsDir) : []
    }
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
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
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
  
  setTimeout(() => {
    updateAllCategoryProductCounts().then(result => {
      if (result.success) {
        console.log(`📊 Category product counts initialized: ${result.updated}/${result.totalCategories} categories updated`);
      } else {
        console.log(`⚠️ Failed to initialize category product counts: ${result.message}`);
      }
    });
  }, 3000);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});