const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
  },
  approved: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    category: {
      type: String, // CHANGED: From ObjectId to String to accept category IDs
      required: false,
      default: null,
    },
    images: [
      {
        type: String,
        default: [],
      },
    ],
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    sku: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
      maxlength: 50,
    },
    weight: {
      type: String,
      trim: true,
    },
    dimensions: {
      type: String,
      trim: true,
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    reviews: [reviewSchema],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Update updatedAt on save
productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate SKU if not provided
productSchema.pre("save", function (next) {
  if (!this.sku) {
    this.sku = `SKU-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;
  }
  next();
});

// Custom setter for category to handle empty strings
productSchema.path("category").set(function (value) {
  // If value is empty string, return null
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return value;
});

// Indexes for better performance
productSchema.index({ name: "text", description: "text", brand: "text" });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isArchived: 1 });
productSchema.index({ stock: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
