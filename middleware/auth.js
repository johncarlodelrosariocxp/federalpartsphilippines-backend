// backend/middleware/auth.js
const jwt = require("jsonwebtoken");

// Authentication middleware - verifies JWT token
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");
    console.log("🔐 Auth header received:", authHeader ? "Present" : "Missing");
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization header provided. Please login first.",
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    console.log("🔐 Token length:", token?.length);
    console.log("🔐 Token preview:", token?.substring(0, 30) + "...");
    
    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login first.",
      });
    }

    // Check if token has 3 parts (JWT format)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error("❌ Invalid token format! Token parts:", parts.length);
      console.error("Token received:", token);
      return res.status(401).json({
        success: false,
        message: "Invalid token format. Please login again.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token verified for user:", decoded.email);
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };
    
    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
        error: error.message
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    
    res.status(401).json({
      success: false,
      message: "Authentication failed.",
      error: error.message
    });
  }
};

// Admin authorization middleware
const adminAuth = async (req, res, next) => {
  try {
    // Check if user exists and is admin
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "User not authenticated.",
      });
    }
    
    if (req.user.role !== "admin") {
      console.log("❌ Admin access denied for user:", req.user.email, "Role:", req.user.role);
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }
    
    console.log("✅ Admin access granted for:", req.user.email);
    next();
  } catch (error) {
    console.error("❌ Admin auth middleware error:", error);
    res.status(403).json({
      success: false,
      message: "Authorization failed.",
    });
  }
};

module.exports = { auth, adminAuth };