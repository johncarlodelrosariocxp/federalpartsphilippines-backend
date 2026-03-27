// backend/routes/uploadRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { auth, adminAuth } = require("../middleware/auth");

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = path.join(__dirname, "../uploads/");
    
    // Determine upload path based on request
    if (req.originalUrl.includes("/category")) {
      uploadPath = path.join(__dirname, "../uploads/categories/");
    } else if (req.originalUrl.includes("/brand")) {
      uploadPath = path.join(__dirname, "../uploads/brands/");
    } else {
      uploadPath = path.join(__dirname, "../uploads/products/");
    }
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "img-" + uniqueSuffix + ext);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

// Upload endpoint for products
router.post("/", auth, adminAuth, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Get the correct URL path
    let imageUrl = `/uploads/products/${req.file.filename}`;
    
    res.json({
      success: true,
      message: "Image uploaded successfully",
      image: {
        url: imageUrl,
        filename: req.file.filename,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload image",
    });
  }
});

// Category image upload
router.post("/category", auth, adminAuth, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const imageUrl = `/uploads/categories/${req.file.filename}`;
    
    res.json({
      success: true,
      message: "Category image uploaded successfully",
      image: {
        url: imageUrl,
        filename: req.file.filename,
      },
    });
  } catch (error) {
    console.error("Category upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload category image",
    });
  }
});

// Brand image upload
router.post("/brand", auth, adminAuth, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const imageUrl = `/uploads/brands/${req.file.filename}`;
    
    res.json({
      success: true,
      message: "Brand image uploaded successfully",
      image: {
        url: imageUrl,
        filename: req.file.filename,
      },
    });
  } catch (error) {
    console.error("Brand upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload brand image",
    });
  }
});

// Base64 upload (alternative method)
router.post("/base64", auth, adminAuth, async (req, res) => {
  try {
    const { image, type = "product" } = req.body;
    
    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid base64 image data",
      });
    }

    // Extract the base64 data
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        message: "Invalid base64 image format",
      });
    }

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    
    // Determine upload path
    let uploadPath = path.join(__dirname, "../uploads/products/");
    let urlPath = "/uploads/products/";
    
    if (type === "category") {
      uploadPath = path.join(__dirname, "../uploads/categories/");
      urlPath = "/uploads/categories/";
    } else if (type === "brand") {
      uploadPath = path.join(__dirname, "../uploads/brands/");
      urlPath = "/uploads/brands/";
    }
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Generate filename
    const filename = Date.now() + "-" + Math.round(Math.random() * 1e9) + "." + ext;
    const filepath = path.join(uploadPath, filename);
    
    // Save file
    fs.writeFileSync(filepath, buffer);
    
    const imageUrl = urlPath + filename;
    
    res.json({
      success: true,
      message: "Base64 image uploaded successfully",
      image: {
        url: imageUrl,
        filename: filename,
      },
    });
  } catch (error) {
    console.error("Base64 upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload base64 image",
    });
  }
});

module.exports = router;