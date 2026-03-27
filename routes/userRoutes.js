// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { auth, adminAuth } = require("../middleware/auth");
const userController = require("../controllers/userController");

// Public routes
router.post("/register", userController.register);
router.post("/login", userController.login);

// Protected routes
router.get("/profile", auth, userController.getProfile);
router.put("/profile", auth, userController.updateProfile);

// Admin routes
router.get("/all", auth, adminAuth, userController.getAllUsers);

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Users route working!" });
});

module.exports = router;