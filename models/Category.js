const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      type: String,
      default: "",
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    seoKeywords: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for children categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
  justOne: false,
});

// Virtual for product count (you can add this if you have Product model)
categorySchema.virtual("productCount", {
  ref: "Product",
  localField: "_id",
  foreignField: "category",
  count: true,
});

// Indexes for better performance
categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ order: 1 });
categorySchema.index({ slug: 1 }, { unique: true });

// Add compound index for unique name per parent
categorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });

// Pre-save middleware to generate slug
categorySchema.pre("save", function (next) {
  if (!this.slug || this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-');
  }
  next();
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;