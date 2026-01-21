const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Brand name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  description: {
    type: String,
    default: '',
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  logo: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  country: {
    type: String,
    default: ''
  },
  foundedYear: {
    type: Number,
    min: [1800, 'Founded year must be after 1800']
  },
  website: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  seoTitle: {
    type: String,
    default: '',
    maxlength: [60, 'SEO title cannot exceed 60 characters']
  },
  seoDescription: {
    type: String,
    default: '',
    maxlength: [160, 'SEO description cannot exceed 160 characters']
  },
  seoKeywords: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0,
    min: [0, 'Order cannot be negative']
  },
  // For filtering
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  // Brand stats (updated by hooks/controllers)
  productCount: {
    type: Number,
    default: 0
  },
  motorcycleCount: {
    type: Number,
    default: 0
  },
  // Social media links
  socialMedia: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    youtube: { type: String, default: '' },
    linkedin: { type: String, default: '' }
  },
  // Brand colors for UI
  primaryColor: {
    type: String,
    default: '#000000'
  },
  secondaryColor: {
    type: String,
    default: '#ffffff'
  },
  // Additional info
  warrantyPolicy: {
    type: String,
    default: ''
  },
  serviceCenters: [{
    name: String,
    address: String,
    phone: String,
    city: String,
    isActive: { type: Boolean, default: true }
  }],
  // Meta fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting all products of this brand
brandSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'brand',
  justOne: false
});

// Virtual for getting all motorcycles of this brand
brandSchema.virtual('motorcycles', {
  ref: 'Motorcycle',
  localField: '_id',
  foreignField: 'brand',
  justOne: false
});

// Pre-save middleware to generate slug
brandSchema.pre('save', function(next) {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  next();
});

// Indexes for better performance
brandSchema.index({ name: 1 });
brandSchema.index({ slug: 1 });
brandSchema.index({ isActive: 1 });
brandSchema.index({ order: 1 });
brandSchema.index({ country: 1 });

// Static method to find by slug
brandSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug }).populate('categories');
};

// Static method to get active brands only
brandSchema.statics.getActiveBrands = function() {
  return this.find({ isActive: true }).sort({ order: 1, name: 1 });
};

// Static method to get brands with product counts
brandSchema.statics.getBrandsWithStats = async function() {
  const brands = await this.find({ isActive: true }).sort({ order: 1, name: 1 });
  
  // Populate counts (you might want to do this differently based on your data structure)
  return brands;
};

// Instance method to toggle status
brandSchema.methods.toggleStatus = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Instance method to update product count
brandSchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({ 
    brand: this._id, 
    isActive: true 
  });
  this.productCount = count;
  await this.save();
};

// Instance method to update motorcycle count
brandSchema.methods.updateMotorcycleCount = async function() {
  const Motorcycle = mongoose.model('Motorcycle');
  const count = await Motorcycle.countDocuments({ 
    brand: this._id, 
    isActive: true 
  });
  this.motorcycleCount = count;
  await this.save();
};

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand;