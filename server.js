// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const compression = require("compression");

// Import routes
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const userRoutes = require("./routes/userRoutes");
const cartRoutes = require("./routes/cartRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// ============================================
// 🛡️ MIDDLEWARE - OPTIMIZED FOR SPEED
// ============================================

app.use(compression());

// Parse allowed origins from env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000").split(",");

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory
const uploadsDir = path.join(__dirname, "uploads");
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "7d",
    etag: true,
    lastModified: true,
  })
);

// Ensure upload directories exist
const ensureDirectories = () => {
  const dirs = [
    path.join(__dirname, "uploads"),
    path.join(__dirname, "uploads/products"),
    path.join(__dirname, "uploads/categories"),
    path.join(__dirname, "uploads/brands"),
  ];
  
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};
ensureDirectories();

// ============================================
// 📊 DATABASE CONNECTION
// ============================================

const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.log("❌ MongoDB connection failed");
    console.log("Error:", err.message);
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// ============================================
// 🛣️ ROUTES
// ============================================

app.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    success: true,
    message: "🚀 Federal Parts Philippines Backend API",
    status: "Server is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    endpoints: {
      api: "/api",
      admin: "/api/admin",
      products: "/api/products",
      categories: "/api/categories",
      brands: "/api/brands",
      users: "/api/users",
      cart: "/api/cart",
      upload: "/api/upload",
    },
  });
});

app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "UP",
    database: dbStatus,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);

// ============================================
// 🚨 ERROR HANDLING
// ============================================

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedUrl: req.originalUrl,
  });
});

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
  console.log(`🔗 Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`═══════════════════════════════════════════\n`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  server.close(() => {
    mongoose.connection.close();
    console.log("✅ Server closed");
    process.exit(0);
  });
});