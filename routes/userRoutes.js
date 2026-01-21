// Import Express router to create routes
const express = require("express");
const router = express.Router(); // Creates a mini-app for user routes

// Import security checkers
const { auth, adminAuth } = require("../middleware/auth");
// auth = "Are you logged in?" checker
// adminAuth = "Are you an admin?" checker

// Import user functions/actions
const userController = require("../controllers/userController");

// ==============================================
// PUBLIC ROUTES (Anyone can access these)
// ==============================================

// POST /users/register → Create new account
router.post("/register", userController.register);
// Example: Send name, email, password → Get new account

// POST /users/login → Login to existing account
router.post("/login", userController.login);
// Example: Send email, password → Get login ticket

// ==============================================
// PROTECTED ROUTES (Need to be logged in)
// ==============================================

// GET /users/profile → View your profile
router.get("/profile", auth, userController.getProfile);
// Flow: 1. Check if logged in (auth) → 2. Get profile info

// PUT /users/profile → Update your profile
router.put("/profile", auth, userController.updateProfile);
// Flow: 1. Check if logged in → 2. Update your info

// ==============================================
// ADMIN ONLY ROUTES (Need to be admin)
// ==============================================

// GET /users/all → Get list of ALL users (admin only)
router.get("/all", auth, adminAuth, userController.getAllUsers);
// Flow: 1. Check if logged in → 2. Check if admin → 3. Get all users

// ==============================================
// TEST ROUTE (Just to check if it's working)
// ==============================================

// GET /users/test → Simple test
router.get("/test", (req, res) => {
  res.json({ message: "Users route working!" });
});
// Example response: {"message": "Users route working!"}

// Export the router so main app can use it
module.exports = router;
