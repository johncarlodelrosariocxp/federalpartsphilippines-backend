const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure directories exist
const productUploadsDir = path.join(__dirname, "../uploads/products");
const categoryUploadsDir = path.join(__dirname, "../uploads/categories");

if (!fs.existsSync(productUploadsDir)) {
  fs.mkdirSync(productUploadsDir, { recursive: true });
}
if (!fs.existsSync(categoryUploadsDir)) {
  fs.mkdirSync(categoryUploadsDir, { recursive: true });
}

// Dynamic storage based on fieldname
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "image" && req.baseUrl.includes("category")) {
      cb(null, categoryUploadsDir);
    } else {
      cb(null, productUploadsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === "image" && req.baseUrl.includes("category") 
      ? "category-" 
      : "product-";
    const filename = prefix + uniqueSuffix + extension;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)!"));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: fileFilter,
});

module.exports = upload;