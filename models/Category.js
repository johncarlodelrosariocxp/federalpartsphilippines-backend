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
    // ADDED: Real field to store product count for better performance
    productCountReal: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ADDED: Total product count including subcategories
    totalProductCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ADDED: Last time product count was updated
    productCountUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Rename productCountReal to productCount in JSON output
        ret.productCount = ret.productCountReal;
        delete ret.productCountReal;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Rename productCountReal to productCount in object output
        ret.productCount = ret.productCountReal;
        delete ret.productCountReal;
        return ret;
      }
    },
  }
);

// Virtual for children categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
  justOne: false,
});

// Virtual for product count (dynamic calculation)
categorySchema.virtual("productCount").get(function() {
  // Return the real stored count for better performance
  return this.productCountReal || 0;
});

// Virtual for getting all descendant category IDs
categorySchema.virtual("descendantIds").get(async function() {
  const getAllDescendantIds = async (parentId) => {
    const childCategories = await mongoose.model("Category").find({ 
      parentCategory: parentId,
      isActive: true 
    });
    let allIds = [parentId];
    
    for (const child of childCategories) {
      const childIds = await getAllDescendantIds(child._id);
      allIds = [...allIds, ...childIds];
    }
    
    return allIds;
  };

  return getAllDescendantIds(this._id);
});

// Static method to calculate product count for a category
categorySchema.statics.calculateProductCount = async function(categoryId, includeChildren = false) {
  const Product = mongoose.model("Product");
  
  if (includeChildren) {
    // Get all descendant category IDs
    const getAllDescendantIds = async (parentId) => {
      const childCategories = await this.find({ 
        parentCategory: parentId,
        isActive: true 
      });
      let allIds = [parentId];
      
      for (const child of childCategories) {
        const childIds = await getAllDescendantIds(child._id);
        allIds = [...allIds, ...childIds];
      }
      
      return allIds;
    };

    const allCategoryIds = await getAllDescendantIds(categoryId);
    
    // Count products in all categories
    const productCount = await Product.countDocuments({
      category: { $in: allCategoryIds },
      isActive: true,
    });

    return productCount;
  } else {
    // Count only products directly in this category
    const productCount = await Product.countDocuments({
      category: categoryId,
      isActive: true,
    });

    return productCount;
  }
};

// Static method to update product count for a category
categorySchema.statics.updateProductCount = async function(categoryId) {
  try {
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) return 0;

    const productCount = await this.calculateProductCount(categoryId, false);
    const totalProductCount = await this.calculateProductCount(categoryId, true);

    // Update the category with both counts
    await this.findByIdAndUpdate(categoryId, {
      productCountReal: productCount,
      totalProductCount: totalProductCount,
      productCountUpdatedAt: new Date(),
    });

    console.log(`✅ Updated product count for category ${categoryId}: ${productCount} products (total: ${totalProductCount})`);
    return productCount;
  } catch (error) {
    console.error("❌ Error updating category product count:", error.message);
    return 0;
  }
};

// Static method to update product counts for all categories
categorySchema.statics.updateAllProductCounts = async function() {
  try {
    console.log("🔄 Updating product counts for all categories...");

    const categories = await this.find({});
    let updatedCount = 0;

    for (const category of categories) {
      const productCount = await this.calculateProductCount(category._id, false);
      const totalProductCount = await this.calculateProductCount(category._id, true);

      if (category.productCountReal !== productCount || category.totalProductCount !== totalProductCount) {
        await this.findByIdAndUpdate(category._id, {
          productCountReal: productCount,
          totalProductCount: totalProductCount,
          productCountUpdatedAt: new Date(),
        });
        updatedCount++;
        console.log(
          `   📊 ${category.name}: ${productCount} products (total: ${totalProductCount}) ${productCount !== category.productCountReal ? "(updated)" : ""}`
        );
      }
    }

    console.log(
      `✅ Updated product counts for ${updatedCount}/${categories.length} categories`
    );

    return {
      success: true,
      message: `Updated ${updatedCount} categories`,
      totalCategories: categories.length,
      updated: updatedCount,
    };
  } catch (error) {
    console.error("❌ Error updating all category product counts:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Instance method to get products in this category
categorySchema.methods.getProducts = async function(options = {}) {
  const Product = mongoose.model("Product");
  const { 
    page = 1, 
    limit = 20, 
    includeSubcategories = false,
    ...queryOptions 
  } = options;

  const skip = (Number(page) - 1) * Number(limit);

  let categoryIds = [this._id];

  if (includeSubcategories) {
    // Get all descendant category IDs
    const getAllDescendantIds = async (parentId) => {
      const childCategories = await mongoose.model("Category").find({ 
        parentCategory: parentId,
        isActive: true 
      });
      let allIds = [parentId];
      
      for (const child of childCategories) {
        const childIds = await getAllDescendantIds(child._id);
        allIds = [...allIds, ...childIds];
      }
      
      return allIds;
    };

    categoryIds = await getAllDescendantIds(this._id);
  }

  // Build filter
  const filter = {
    category: { $in: categoryIds },
    isActive: true,
    ...queryOptions,
  };

  // Get products
  const products = await Product.find(filter)
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const total = await Product.countDocuments(filter);

  return {
    products,
    total,
    currentPage: Number(page),
    totalPages: Math.ceil(total / limit),
    limit: Number(limit),
    includeSubcategories,
  };
};

// Middleware to update parent category counts when this category is modified
categorySchema.post('save', async function(doc) {
  // If this category has a parent, update the parent's total product count
  if (doc.parentCategory) {
    const Category = mongoose.model("Category");
    await Category.updateProductCount(doc.parentCategory);
  }
  
  // Also update this category's own counts
  await mongoose.model("Category").updateProductCount(doc._id);
});

// Middleware to update parent category counts when this category is deleted
categorySchema.post('findOneAndDelete', async function(doc) {
  if (doc && doc.parentCategory) {
    const Category = mongoose.model("Category");
    await Category.updateProductCount(doc.parentCategory);
  }
});

// Indexes for better performance
categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ order: 1 });
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ productCountReal: 1 }); // ADDED: Index for product count
categorySchema.index({ totalProductCount: 1 }); // ADDED: Index for total product count

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

// Pre-save middleware to update timestamps
categorySchema.pre("save", function (next) {
  if (this.isModified('productCountReal') || this.isModified('totalProductCount')) {
    this.productCountUpdatedAt = new Date();
  }
  next();
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;