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
    categories: [
      {
        type: String,
        default: [],
      },
    ],
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
  },
  {
    timestamps: true,
  }
);

productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  
  if (!Array.isArray(this.categories)) {
    this.categories = [];
  }
  
  if (Array.isArray(this.categories)) {
    this.categories = [...new Set(this.categories.filter(cat => cat && cat.trim() !== ""))];
  }
  
  if (this.categories.length > 0 && (!this.category || this.category === "")) {
    this.category = this.categories[0];
  }
  
  next();
});

productSchema.pre("save", function (next) {
  if (!this.sku) {
    this.sku = `SKU-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;
  }
  next();
});

productSchema.methods.addCategory = function(categoryId) {
  if (!this.categories.includes(categoryId)) {
    this.categories.push(categoryId);
  }
  if (!this.category || this.category === "" || this.category === null) {
    this.category = categoryId;
  }
};

productSchema.methods.removeCategory = function(categoryId) {
  const index = this.categories.indexOf(categoryId);
  if (index > -1) {
    this.categories.splice(index, 1);
  }
  if (this.category === categoryId && this.categories.length > 0) {
    this.category = this.categories[0];
  } else if (this.category === categoryId && this.categories.length === 0) {
    this.category = null;
  }
};

productSchema.virtual('primaryCategory').get(function() {
  if (this.categories && this.categories.length > 0) {
    return this.categories[0];
  }
  return this.category;
});

productSchema.index({ name: "text", description: "text", brand: "text" });
productSchema.index({ categories: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;