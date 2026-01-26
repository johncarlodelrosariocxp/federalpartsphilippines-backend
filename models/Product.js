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
    // UPDATED: Changed from single category to array of categories
    categories: [
      {
        type: String, // Category IDs as strings
        default: [],
      },
    ],
    // Keep the old category field for backward compatibility
    category: {
      type: String,
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
  
  // Ensure categories is an array
  if (!Array.isArray(this.categories)) {
    this.categories = [];
  }
  
  // Remove duplicates from categories array
  if (Array.isArray(this.categories)) {
    this.categories = [...new Set(this.categories.filter(cat => cat && cat.trim() !== ""))];
  }
  
  // For backward compatibility, set category to the first category if not already set
  if (this.categories.length > 0 && (!this.category || this.category === "")) {
    this.category = this.categories[0];
  }
  
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

// Method to add a category
productSchema.methods.addCategory = function(categoryId) {
  if (!this.categories.includes(categoryId)) {
    this.categories.push(categoryId);
  }
  // Update the main category if it's empty
  if (!this.category || this.category === "" || this.category === null) {
    this.category = categoryId;
  }
};

// Method to remove a category
productSchema.methods.removeCategory = function(categoryId) {
  const index = this.categories.indexOf(categoryId);
  if (index > -1) {
    this.categories.splice(index, 1);
  }
  // Update the main category if we removed it
  if (this.category === categoryId && this.categories.length > 0) {
    this.category = this.categories[0];
  } else if (this.category === categoryId && this.categories.length === 0) {
    this.category = null;
  }
};

// Virtual for getting primary category (first in array or old category field)
productSchema.virtual('primaryCategory').get(function() {
  if (this.categories && this.categories.length > 0) {
    return this.categories[0];
  }
  return this.category;
});

// Indexes for better performance
productSchema.index({ name: "text", description: "text", brand: "text" });
productSchema.index({ categories: 1 }); // Index for array of categories
productSchema.index({ category: 1 }); // Keep old index for backward compatibility
productSchema.index({ price: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isArchived: 1 });
productSchema.index({ stock: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;