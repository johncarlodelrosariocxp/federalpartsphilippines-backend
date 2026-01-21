// Import User model (database template) and JWT for making tokens
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// ==============================================
// 1. REGISTER FUNCTION - Create new account
// ==============================================
exports.register = async (req, res) => {
  try {
    // Step 1: Get info from sign-up form
    const { name, email, password } = req.body;

    // Step 2: Check if email is already taken
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "❌ Email already registered! Try another email.",
      });
    }

    // Step 3: Create new user account
    const user = new User({ name, email, password });
    await user.save(); // Save to database

    // Step 4: Create login ticket (lasts 24 hours)
    const token = jwt.sign(
      {
        userId: user._id, // User's ID number
        email: user.email, // User's email
        role: user.role, // User or admin
        name: user.name, // User's name
      },
      process.env.JWT_SECRET, // Secret key to sign ticket
      { expiresIn: "24h" } // Ticket expires in 24 hours
    );

    // Step 5: Send success response
    res.status(201).json({
      success: true,
      message: "✅ Account created successfully!",
      token, // Give them the login ticket
      user: {
        id: user._id, // User ID
        name: user.name, // User's name
        email: user.email, // User's email
        role: user.role, // User's role
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "⚠️ Server error! Please try again later.",
      error: error.message,
    });
  }
};

// ==============================================
// 2. LOGIN FUNCTION - Sign in to account
// ==============================================
exports.login = async (req, res) => {
  try {
    // Step 1: Get login info
    const { email, password } = req.body;

    // Step 2: Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ Wrong email or password!",
      });
    }

    // Step 3: Check password (using model's comparePassword)
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "❌ Wrong email or password!",
      });
    }

    // Step 4: Create new login ticket
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Step 5: Send success
    res.json({
      success: true,
      message: "✅ Login successful!",
      token, // New login ticket
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "⚠️ Server error! Please try again.",
      error: error.message,
    });
  }
};

// ==============================================
// 3. GET PROFILE - View your account info
// ==============================================
exports.getProfile = async (req, res) => {
  try {
    // Step 1: Find user by ID (from token)
    const user = await User.findById(req.user.userId).select("-password");
    // .select("-password") means "don't include password"

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "❓ User not found!",
      });
    }

    // Step 2: Send user info (without password)
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "⚠️ Server error!",
    });
  }
};

// ==============================================
// 4. UPDATE PROFILE - Change your info
// ==============================================
exports.updateProfile = async (req, res) => {
  try {
    // Step 1: Get new info from request
    const updates = req.body;

    // Step 2: Protect important fields (can't change these)
    delete updates.password; // Can't change password here
    delete updates.email; // Can't change email
    delete updates.role; // Can't change role

    // Step 3: Update user in database
    const user = await User.findByIdAndUpdate(
      req.user.userId, // Which user to update
      updates, // New info
      {
        new: true, // Return updated user
        runValidators: true, // Check if new info is valid
      }
    ).select("-password"); // Don't include password

    // Step 4: Send success
    res.json({
      success: true,
      message: "✅ Profile updated!",
      user, // Updated user info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "⚠️ Server error!",
    });
  }
};

// ==============================================
// 5. GET ALL USERS - Admin only (see all accounts)
// ==============================================
exports.getAllUsers = async (req, res) => {
  try {
    // Step 1: Get ALL users from database
    const users = await User.find().select("-password");
    // .select("-password") = don't include passwords

    // Step 2: Send user list
    res.json({
      success: true,
      count: users.length, // How many users total
      users, // List of all users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "⚠️ Server error!",
      error: error.message,
    });
  }
};
