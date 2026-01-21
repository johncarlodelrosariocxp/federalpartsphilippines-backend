// backend/controllers/authController.js

// Think of these like "helpers" we need to use
const User = require("../models/User"); // User template/blueprint
const bcrypt = require("bcryptjs"); // Password encryptor
const jwt = require("jsonwebtoken"); // Ticket creator (for login)

// ⭐️ SECRET CODE AREA ⭐️
// This is like a secret password to become admin
const ADMIN_REGISTRATION_CODE = "FEDERAL2024"; // Change this to your own secret

// ------------------------------------------------------------
// 1. REGISTER FUNCTION (Making a new account)
// ------------------------------------------------------------
exports.register = async (req, res) => {
  try {
    // Step 1: Get info from the sign-up form
    const { name, email, password, phone, role, adminCode } = req.body;

    // Step 2: Check if they filled everything
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Hey! You forgot name, email, or password!",
      });
    }

    // Step 3: Check if email is already used
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Oops! This email is already taken!",
      });
    }

    // Step 4: SPECIAL - If they want to be admin
    if (role === "admin") {
      if (!adminCode) {
        return res.status(400).json({
          success: false,
          message: "You need the secret code to be admin!",
        });
      }

      // Step 5: Check their secret code
      if (adminCode !== ADMIN_REGISTRATION_CODE) {
        return res.status(403).json({
          success: false,
          message: "Wrong secret code! Try again!",
        });
      }
    }

    // Step 6: Hide their password (encrypt it)
    const salt = await bcrypt.genSalt(10); // Make a special spice
    const hashedPassword = await bcrypt.hash(password, salt); // Hide password with spice

    // Step 7: Create the user in database
    const user = new User({
      name,
      email,
      password: hashedPassword, // Save the hidden password
      phone: phone || "",
      role: role || "customer", // If not specified, they're a customer
    });

    await user.save(); // Save to database

    // Step 8: Make a login ticket (lasts 7 days)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET, // Secret key to make ticket
      { expiresIn: "7d" } // Ticket expires in 7 days
    );

    // Step 9: Remove password from what we send back
    const userResponse = user.toObject();
    delete userResponse.password; // Don't send password!

    // Step 10: Send back success message
    res.status(201).json({
      success: true,
      message: "🎉 Yay! Account created successfully!",
      token, // Give them their login ticket
      user: userResponse, // User info without password
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Oops! Something went wrong on our side!",
    });
  }
};

// ------------------------------------------------------------
// 2. LOGIN FUNCTION (Signing in)
// ------------------------------------------------------------
exports.login = async (req, res) => {
  try {
    // Step 1: Get email and password from login form
    const { email, password } = req.body;

    // Step 2: Check if they entered both
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter both email AND password!",
      });
    }

    // Step 3: Look for user in database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Wrong email or password!", // Don't say which one is wrong (security!)
      });
    }

    // Step 4: Check if password matches
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Wrong email or password!",
      });
    }

    // Step 5: Make a new login ticket
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Step 6: Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Step 7: Send success
    res.status(200).json({
      success: true,
      message: "✅ Login successful! Welcome back!",
      token, // New ticket
      user: userResponse, // User info
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Oops! Our server hiccupped!",
    });
  }
};

// ------------------------------------------------------------
// 3. AUTH MIDDLEWARE (The "Ticket Checker")
// ------------------------------------------------------------
// This runs BEFORE other functions to check if user is logged in
exports.auth = (req, res, next) => {
  try {
    // Step 1: Look for the ticket in the request
    // Format: "Bearer your-ticket-here"
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "🚫 No ticket! You need to login first!",
      });
    }

    // Step 2: Check if ticket is valid
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Attach user info to request
    req.user = verified; // Now all following functions know who this is
    req.token = token;

    next(); // "Okay, you can go to the next function"
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "❌ Fake ticket! Not allowed!",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "⌛ Ticket expired! Login again!",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server problem!",
    });
  }
};

// ------------------------------------------------------------
// 4. ADMIN MIDDLEWARE (The "VIP Checker")
// ------------------------------------------------------------
// This checks if user is an admin
exports.adminAuth = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "🔒 VIP only! You need admin powers!",
    });
  }
  next(); // "Okay VIP, you can pass"
};

// ------------------------------------------------------------
// 5. GET CURRENT USER (Who am I?)
// ------------------------------------------------------------
exports.getCurrentUser = async (req, res) => {
  try {
    // Step 1: Find user by ID (from the ticket)
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found! That's weird...",
      });
    }

    // Step 2: Send back their info
    res.status(200).json({
      success: true,
      user, // Their profile info
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server messed up!",
    });
  }
};

// ------------------------------------------------------------
// 6. HELPER FUNCTION (Just for information)
// ------------------------------------------------------------
exports.getAdminCodeInfo = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Here's the admin code info:",
    info: {
      currentAdminCode: ADMIN_REGISTRATION_CODE, // The secret code
      instructions: "Use this code when registering to become admin",
      location: "It's in authController.js at line 7",
      note: "Change it if you want a different secret code!",
    },
  });
};
