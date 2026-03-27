// backend/utils/uploadUtils.js
const fs = require("fs");
const path = require("path");

// Define upload directories
const uploadsDir = path.join(__dirname, "../uploads");
const categoryUploadsDir = path.join(uploadsDir, "categories");
const productUploadsDir = path.join(uploadsDir, "products");
const brandUploadsDir = path.join(uploadsDir, "brands");

// Ensure directories exist
[uploadsDir, categoryUploadsDir, productUploadsDir, brandUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

const deleteImageFile = (imagePath) => {
  if (!imagePath) return;

  let fullPath;

  if (imagePath.startsWith("uploads/")) {
    fullPath = path.join(__dirname, "../", imagePath);
  } else if (imagePath.startsWith("/uploads/")) {
    fullPath = path.join(__dirname, "../", imagePath.substring(1));
  } else if (imagePath.includes("categories/")) {
    const filename = imagePath.split("/").pop();
    fullPath = path.join(categoryUploadsDir, filename);
  } else if (imagePath.includes("products/")) {
    const filename = imagePath.split("/").pop();
    fullPath = path.join(productUploadsDir, filename);
  } else if (imagePath.includes("brands/")) {
    const filename = imagePath.split("/").pop();
    fullPath = path.join(brandUploadsDir, filename);
  } else {
    fullPath = path.join(uploadsDir, imagePath);
  }

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Deleted image: ${fullPath}`);
      return true;
    }
  } catch (err) {
    console.error("❌ Error deleting image file:", err.message);
  }
  return false;
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

  // Return full URL path
  if (type === "category") {
    return `/uploads/categories/${filename}`;
  } else if (type === "brand") {
    return `/uploads/brands/${filename}`;
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

    let dir;
    let prefix;
    
    if (type === "category") {
      dir = categoryUploadsDir;
      prefix = "category-";
    } else if (type === "brand") {
      dir = brandUploadsDir;
      prefix = "brand-";
    } else {
      dir = productUploadsDir;
      prefix = "product-";
    }
    
    const ext = mimeType === "jpeg" ? "jpg" : mimeType;
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${prefix}${uniqueSuffix}.${ext}`;
    const filepath = path.join(dir, filename);

    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Saved image: ${filepath}`);

    return getImageUrl(filename, type);
  } catch (error) {
    console.error("❌ Error saving base64 image:", error.message);
    return "";
  }
};

const processImagesArray = (images, type = "product") => {
  if (!images || !Array.isArray(images)) {
    return [];
  }

  const imageUrls = [];

  for (const image of images) {
    if (!image || typeof image !== "string" || image.trim() === "") continue;

    if (image.startsWith("data:image/")) {
      const imageUrl = saveBase64Image(image, type);
      if (imageUrl) {
        imageUrls.push(imageUrl);
      }
    } else if (image.includes("/")) {
      imageUrls.push(image);
    } else {
      imageUrls.push(getImageUrl(image, type));
    }
  }

  return [...new Set(imageUrls.filter((img) => img && img.trim() !== ""))];
};

module.exports = {
  deleteImageFile,
  getImageUrl,
  extractFilename,
  saveBase64Image,
  processImagesArray,
  categoryUploadsDir,
  productUploadsDir,
  brandUploadsDir,
};