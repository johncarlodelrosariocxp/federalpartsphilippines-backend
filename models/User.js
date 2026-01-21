// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // For encrypting passwords
const jwt = require("jsonwebtoken"); // For creating login tokens

// Define what a user looks like in our database
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // Must have a name
    trim: true, // Remove extra spaces
  },
  email: {
    type: String,
    required: true, // Must have an email
    unique: true, // No two users can have same email
    lowercase: true, // Store all emails as lowercase
    trim: true,
  },
  password: {
    type: String,
    required: true, // Must have a password
    minlength: 6, // At least 6 characters
  },
  role: {
    type: String,
    enum: ["user", "admin"], // Can only be "user" or "admin"
    default: "user", // If not specified, it's a regular user
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  phone: String,
  createdAt: {
    type: Date,
    default: Date.now, // Auto-set to current date when created
  },
});

// Before saving user to database, encrypt their password
userSchema.pre("save", async function (next) {
  // Only hash password if it's new or changed
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10); // Create random salt
    this.password = await bcrypt.hash(this.password, salt); // Encrypt password
    next(); // Move to next step
  } catch (error) {
    next(error); // Pass error to next step
  }
});

// Method to check if entered password matches stored password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to create login token (lasts 24 hours)
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      userId: this._id, // User's ID from database
      email: this.email,
      role: this.role, // User or admin
      name: this.name,
    },
    process.env.JWT_SECRET, // Secret key from environment
    { expiresIn: "24h" } // Token expires in 24 hours
  );
  return token;
};

// Method to create refresh token (lasts 7 days, for getting new login tokens)
userSchema.methods.generateRefreshToken = function () {
  const refreshToken = jwt.sign(
    { userId: this._id }, // Only store user ID
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "7d" } // Lasts 7 days
  );
  return refreshToken;
};

// When converting user to JSON, remove password for security
userSchema.methods.toJSON = function () {
  const user = this.toObject(); // Convert to plain object
  delete user.password; // Don't include password in response
  return user;
};

// Export the User model so we can use it elsewhere
module.exports = mongoose.model("User", userSchema);
