const Brand = require('../models/Brand');
const Product = require('../models/Product');
const Category = require('../models/Category');
const fs = require('fs');
const path = require('path');

// Create uploads directory for brands if it doesn't exist
const brandUploadsDir = path.join(__dirname, '../uploads/brands');
if (!fs.existsSync(brandUploadsDir)) {
  fs.mkdirSync(brandUploadsDir, { recursive: true });
}

// Helper function to get image URL
const getImageUrl = (filename, type = 'logo') => {
  if (!filename || filename.trim() === '') {
    return '';
  }
  
  if (filename.startsWith('http') || filename.startsWith('data:') || filename.startsWith('/uploads/')) {
    return filename;
  }
  
  return `/uploads/brands/${filename}`;
};

// Helper function to save base64 image
const saveBase64Image = (base64Data, prefix = 'brand') => {
  if (!base64Data || !base64Data.startsWith('data:image/')) {
    return '';
  }

  try {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return '';
    }

    const mimeType = matches[1];
    const base64String = matches[2];
    const buffer = Buffer.from(base64String, 'base64');

    const ext = mimeType === 'jpeg' ? 'jpg' : mimeType;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `${prefix}-${uniqueSuffix}.${ext}`;
    const filepath = path.join(brandUploadsDir, filename);

    fs.writeFileSync(filepath, buffer);
    return filename;
  } catch (error) {
    console.error('Error saving base64 image:', error.message);
    return '';
  }
};

// Helper function to delete image file
const deleteImageFile = (filename) => {
  if (!filename) return;
  
  const filepath = path.join(brandUploadsDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlink(filepath, (err) => {
      if (err) {
        console.error('Error deleting image file:', err.message);
      }
    });
  }
};

// @desc    Get all brands
// @route   GET /api/brands
// @access  Public
exports.getAllBrands = async (req, res) => {
  try {
    const {
      search = '',
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'order',
      sortOrder = 'asc',
      withProducts = false,
      withCategories = false
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter
    let filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Build query
    let query = Brand.find(filter);
    
    // Apply pagination
    query = query.skip(skip).limit(parseInt(limit)).sort(sort);
    
    // Populate if needed
    if (withCategories === 'true') {
      query = query.populate('categories', 'name _id isActive');
    }
    
    if (withProducts === 'true') {
      query = query.populate({
        path: 'products',
        match: { isActive: true },
        options: { limit: 5, sort: { createdAt: -1 } },
        select: 'name price images isActive'
      });
    }
    
    const brands = await query;
    
    // Process images for response
    const processedBrands = brands.map(brand => {
      const brandObj = brand.toObject();
      
      if (brandObj.logo) {
        brandObj.logo = getImageUrl(brandObj.logo, 'logo');
      }
      
      if (brandObj.coverImage) {
        brandObj.coverImage = getImageUrl(brandObj.coverImage, 'cover');
      }
      
      return brandObj;
    });
    
    const total = await Brand.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      success: true,
      count: processedBrands.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      brands: processedBrands
    });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brands',
      error: error.message
    });
  }
};

// @desc    Get brand by ID
// @route   GET /api/brands/:id
// @access  Public
exports.getBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const brand = await Brand.findById(id)
      .populate('categories', 'name _id image isActive')
      .populate({
        path: 'products',
        match: { isActive: true },
        options: { limit: 20, sort: { createdAt: -1 } },
        select: 'name price images description isActive category'
      });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    // Process images for response
    const brandObj = brand.toObject();
    
    if (brandObj.logo) {
      brandObj.logo = getImageUrl(brandObj.logo, 'logo');
    }
    
    if (brandObj.coverImage) {
      brandObj.coverImage = getImageUrl(brandObj.coverImage, 'cover');
    }
    
    res.json({
      success: true,
      brand: brandObj
    });
  } catch (error) {
    console.error('Get brand by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brand',
      error: error.message
    });
  }
};

// @desc    Get brand by slug
// @route   GET /api/brands/slug/:slug
// @access  Public
exports.getBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const brand = await Brand.findOne({ slug })
      .populate('categories', 'name _id image isActive')
      .populate({
        path: 'products',
        match: { isActive: true },
        options: { limit: 20, sort: { createdAt: -1 } },
        select: 'name price images description isActive category'
      });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    // Process images for response
    const brandObj = brand.toObject();
    
    if (brandObj.logo) {
      brandObj.logo = getImageUrl(brandObj.logo, 'logo');
    }
    
    if (brandObj.coverImage) {
      brandObj.coverImage = getImageUrl(brandObj.coverImage, 'cover');
    }
    
    res.json({
      success: true,
      brand: brandObj
    });
  } catch (error) {
    console.error('Get brand by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brand',
      error: error.message
    });
  }
};

// @desc    Create new brand
// @route   POST /api/brands
// @access  Private/Admin
exports.createBrand = async (req, res) => {
  try {
    console.log('Creating brand with data:', req.body);
    
    const {
      name,
      description,
      country,
      foundedYear,
      website,
      phone,
      email,
      address,
      seoTitle,
      seoDescription,
      seoKeywords,
      order = 0,
      isActive = true,
      categories,
      primaryColor,
      secondaryColor,
      warrantyPolicy,
      socialMedia,
      serviceCenters
    } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required'
      });
    }
    
    // Check if brand already exists
    const existingBrand = await Brand.findOne({ 
      name: new RegExp(`^${name.trim()}$`, 'i') 
    });
    
    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: 'Brand with this name already exists'
      });
    }
    
    // Handle logo image
    let logoFilename = '';
    if (req.body.logo && req.body.logo.startsWith('data:image/')) {
      logoFilename = saveBase64Image(req.body.logo, 'logo');
    } else if (req.file && req.file.fieldname === 'logo') {
      logoFilename = req.file.filename;
    }
    
    // Handle cover image
    let coverImageFilename = '';
    if (req.body.coverImage && req.body.coverImage.startsWith('data:image/')) {
      coverImageFilename = saveBase64Image(req.body.coverImage, 'cover');
    } else if (req.files && req.files.coverImage) {
      coverImageFilename = req.files.coverImage[0].filename;
    }
    
    // Parse categories if provided
    let categoryIds = [];
    if (categories) {
      try {
        const parsedCategories = JSON.parse(categories);
        if (Array.isArray(parsedCategories)) {
          categoryIds = parsedCategories;
        }
      } catch (e) {
        // If not JSON, try as comma-separated string
        if (typeof categories === 'string') {
          categoryIds = categories.split(',').map(id => id.trim());
        }
      }
    }
    
    // Parse social media if provided
    let socialMediaObj = {};
    if (socialMedia) {
      try {
        socialMediaObj = typeof socialMedia === 'string' 
          ? JSON.parse(socialMedia) 
          : socialMedia;
      } catch (e) {
        console.error('Error parsing social media:', e);
      }
    }
    
    // Parse service centers if provided
    let serviceCentersArray = [];
    if (serviceCenters) {
      try {
        serviceCentersArray = typeof serviceCenters === 'string'
          ? JSON.parse(serviceCenters)
          : serviceCenters;
      } catch (e) {
        console.error('Error parsing service centers:', e);
      }
    }
    
    // Create brand
    const brand = new Brand({
      name: name.trim(),
      description: description ? description.trim() : '',
      logo: logoFilename,
      coverImage: coverImageFilename,
      country: country ? country.trim() : '',
      foundedYear: foundedYear ? parseInt(foundedYear) : undefined,
      website: website ? website.trim() : '',
      phone: phone ? phone.trim() : '',
      email: email ? email.trim() : '',
      address: address ? address.trim() : '',
      seoTitle: seoTitle ? seoTitle.trim() : '',
      seoDescription: seoDescription ? seoDescription.trim() : '',
      seoKeywords: seoKeywords ? seoKeywords.trim() : '',
      order: parseInt(order) || 0,
      isActive: !!isActive,
      categories: categoryIds,
      primaryColor: primaryColor || '#000000',
      secondaryColor: secondaryColor || '#ffffff',
      warrantyPolicy: warrantyPolicy ? warrantyPolicy.trim() : '',
      socialMedia: socialMediaObj,
      serviceCenters: serviceCentersArray
    });
    
    await brand.save();
    
    // Process response with full image URLs
    const brandObj = brand.toObject();
    
    if (brandObj.logo) {
      brandObj.logo = getImageUrl(brandObj.logo, 'logo');
    }
    
    if (brandObj.coverImage) {
      brandObj.coverImage = getImageUrl(brandObj.coverImage, 'cover');
    }
    
    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      brand: brandObj
    });
  } catch (error) {
    console.error('Create brand error:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating brand',
      error: error.message
    });
  }
};

// @desc    Update brand
// @route   PUT /api/brands/:id
// @access  Private/Admin
exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    const {
      name,
      description,
      country,
      foundedYear,
      website,
      phone,
      email,
      address,
      seoTitle,
      seoDescription,
      seoKeywords,
      order,
      isActive,
      categories,
      primaryColor,
      secondaryColor,
      warrantyPolicy,
      socialMedia,
      serviceCenters
    } = req.body;
    
    // Update fields
    if (name !== undefined && name.trim() !== '') {
      // Check if new name conflicts with other brands
      const existingBrand = await Brand.findOne({
        name: new RegExp(`^${name.trim()}$`, 'i'),
        _id: { $ne: id }
      });
      
      if (existingBrand) {
        return res.status(400).json({
          success: false,
          message: 'Brand with this name already exists'
        });
      }
      
      brand.name = name.trim();
    }
    
    if (description !== undefined) brand.description = description.trim();
    if (country !== undefined) brand.country = country.trim();
    if (foundedYear !== undefined) brand.foundedYear = parseInt(foundedYear) || undefined;
    if (website !== undefined) brand.website = website.trim();
    if (phone !== undefined) brand.phone = phone.trim();
    if (email !== undefined) brand.email = email.trim();
    if (address !== undefined) brand.address = address.trim();
    if (seoTitle !== undefined) brand.seoTitle = seoTitle.trim();
    if (seoDescription !== undefined) brand.seoDescription = seoDescription.trim();
    if (seoKeywords !== undefined) brand.seoKeywords = seoKeywords.trim();
    if (order !== undefined) brand.order = parseInt(order) || 0;
    if (isActive !== undefined) brand.isActive = !!isActive;
    if (primaryColor !== undefined) brand.primaryColor = primaryColor;
    if (secondaryColor !== undefined) brand.secondaryColor = secondaryColor;
    if (warrantyPolicy !== undefined) brand.warrantyPolicy = warrantyPolicy.trim();
    
    // Handle logo update
    if (req.body.logo && req.body.logo.startsWith('data:image/')) {
      // Delete old logo if exists
      if (brand.logo) {
        deleteImageFile(brand.logo);
      }
      // Save new logo
      const logoFilename = saveBase64Image(req.body.logo, 'logo');
      if (logoFilename) {
        brand.logo = logoFilename;
      }
    } else if (req.file && req.file.fieldname === 'logo') {
      // Delete old logo if exists
      if (brand.logo) {
        deleteImageFile(brand.logo);
      }
      brand.logo = req.file.filename;
    } else if (req.body.removeLogo === 'true') {
      // Remove logo
      if (brand.logo) {
        deleteImageFile(brand.logo);
        brand.logo = '';
      }
    }
    
    // Handle cover image update
    if (req.body.coverImage && req.body.coverImage.startsWith('data:image/')) {
      if (brand.coverImage) {
        deleteImageFile(brand.coverImage);
      }
      const coverImageFilename = saveBase64Image(req.body.coverImage, 'cover');
      if (coverImageFilename) {
        brand.coverImage = coverImageFilename;
      }
    } else if (req.files && req.files.coverImage) {
      if (brand.coverImage) {
        deleteImageFile(brand.coverImage);
      }
      brand.coverImage = req.files.coverImage[0].filename;
    } else if (req.body.removeCoverImage === 'true') {
      if (brand.coverImage) {
        deleteImageFile(brand.coverImage);
        brand.coverImage = '';
      }
    }
    
    // Update categories
    if (categories !== undefined) {
      try {
        const parsedCategories = JSON.parse(categories);
        if (Array.isArray(parsedCategories)) {
          brand.categories = parsedCategories;
        }
      } catch (e) {
        if (typeof categories === 'string') {
          brand.categories = categories.split(',').map(id => id.trim());
        }
      }
    }
    
    // Update social media
    if (socialMedia !== undefined) {
      try {
        const parsedSocialMedia = typeof socialMedia === 'string' 
          ? JSON.parse(socialMedia) 
          : socialMedia;
        brand.socialMedia = parsedSocialMedia;
      } catch (e) {
        console.error('Error parsing social media:', e);
      }
    }
    
    // Update service centers
    if (serviceCenters !== undefined) {
      try {
        const parsedServiceCenters = typeof serviceCenters === 'string'
          ? JSON.parse(serviceCenters)
          : serviceCenters;
        brand.serviceCenters = parsedServiceCenters;
      } catch (e) {
        console.error('Error parsing service centers:', e);
      }
    }
    
    await brand.save();
    
    // Process response with full image URLs
    const brandObj = brand.toObject();
    
    if (brandObj.logo) {
      brandObj.logo = getImageUrl(brandObj.logo, 'logo');
    }
    
    if (brandObj.coverImage) {
      brandObj.coverImage = getImageUrl(brandObj.coverImage, 'cover');
    }
    
    res.json({
      success: true,
      message: 'Brand updated successfully',
      brand: brandObj
    });
  } catch (error) {
    console.error('Update brand error:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating brand',
      error: error.message
    });
  }
};

// @desc    Delete brand
// @route   DELETE /api/brands/:id
// @access  Private/Admin
exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    // Check if brand has associated products
    const productCount = await Product.countDocuments({ brand: id, isActive: true });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete brand with associated products. Remove products first.'
      });
    }
    
    // Delete images
    if (brand.logo) {
      deleteImageFile(brand.logo);
    }
    
    if (brand.coverImage) {
      deleteImageFile(brand.coverImage);
    }
    
    // Soft delete (set isActive to false)
    brand.isActive = false;
    await brand.save();
    
    res.json({
      success: true,
      message: 'Brand deactivated successfully'
    });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting brand',
      error: error.message
    });
  }
};

// @desc    Toggle brand status
// @route   PATCH /api/brands/:id/toggle-status
// @access  Private/Admin
exports.toggleBrandStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    brand.isActive = !brand.isActive;
    await brand.save();
    
    res.json({
      success: true,
      message: `Brand ${brand.isActive ? 'activated' : 'deactivated'} successfully`,
      brand: {
        _id: brand._id,
        name: brand.name,
        isActive: brand.isActive
      }
    });
  } catch (error) {
    console.error('Toggle brand status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling brand status',
      error: error.message
    });
  }
};

// @desc    Get brand products
// @route   GET /api/brands/:id/products
// @access  Public
exports.getBrandProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 20,
      category,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    // Build product filter
    const filter = { 
      brand: id,
      isActive: true 
    };
    
    if (category && category !== 'all' && category !== 'null') {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const products = await Product.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort)
      .populate('category', 'name _id');
    
    // Process product images for response
    const processedProducts = products.map(product => {
      const productObj = product.toObject();
      
      // Ensure images have full URLs
      if (productObj.images && Array.isArray(productObj.images)) {
        productObj.images = productObj.images
          .filter(img => img && img.trim() !== '')
          .map(img => {
            if (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/uploads/')) {
              return img;
            }
            return `/uploads/products/${img}`;
          });
      } else {
        productObj.images = [];
      }
      
      return productObj;
    });
    
    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      success: true,
      brand: {
        _id: brand._id,
        name: brand.name,
        logo: brand.logo ? getImageUrl(brand.logo, 'logo') : ''
      },
      count: processedProducts.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      products: processedProducts
    });
  } catch (error) {
    console.error('Get brand products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brand products',
      error: error.message
    });
  }
};

// @desc    Get brands with stats (for admin dashboard)
// @route   GET /api/brands/stats/with-stats
// @access  Private/Admin
exports.getBrandsWithStats = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ order: 1, name: 1 });
    
    // Get product counts for each brand
    const brandsWithStats = await Promise.all(
      brands.map(async (brand) => {
        const brandObj = brand.toObject();
        
        // Get product count
        const productCount = await Product.countDocuments({ 
          brand: brand._id, 
          isActive: true 
        });
        
        brandObj.productCount = productCount;
        
        // Add image URLs
        if (brandObj.logo) {
          brandObj.logo = getImageUrl(brandObj.logo, 'logo');
        }
        
        return brandObj;
      })
    );
    
    // Calculate totals
    const totalBrands = brandsWithStats.length;
    const totalProducts = brandsWithStats.reduce((sum, brand) => sum + brand.productCount, 0);
    const activeBrands = brandsWithStats.filter(brand => brand.isActive).length;
    
    res.json({
      success: true,
      count: totalBrands,
      stats: {
        totalBrands,
        activeBrands,
        inactiveBrands: totalBrands - activeBrands,
        totalProducts
      },
      brands: brandsWithStats
    });
  } catch (error) {
    console.error('Get brands with stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brands with stats',
      error: error.message
    });
  }
};

// @desc    Bulk update brands
// @route   PUT /api/brands/bulk/update
// @access  Private/Admin
exports.bulkUpdateBrands = async (req, res) => {
  try {
    const { brandIds, updateData } = req.body;
    
    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide brand IDs to update'
      });
    }
    
    // Filter out invalid ObjectIds
    const validBrandIds = brandIds.filter(id => 
      mongoose.Types.ObjectId.isValid(id)
    );
    
    if (validBrandIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid brand IDs provided'
      });
    }
    
    // Prepare update data (remove fields that shouldn't be bulk updated)
    const safeUpdateData = { ...updateData };
    delete safeUpdateData._id;
    delete safeUpdateData.logo;
    delete safeUpdateData.coverImage;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.updatedAt;
    delete safeUpdateData.slug;
    
    // Update brands
    const result = await Brand.updateMany(
      { _id: { $in: validBrandIds } },
      { $set: safeUpdateData },
      { runValidators: true }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} brand(s) updated successfully`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (error) {
    console.error('Bulk update brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating brands',
      error: error.message
    });
  }
};

// @desc    Bulk delete brands
// @route   DELETE /api/brands/bulk/delete
// @access  Private/Admin
exports.bulkDeleteBrands = async (req, res) => {
  try {
    const { brandIds } = req.body;
    
    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide brand IDs to delete'
      });
    }
    
    // Filter out invalid ObjectIds
    const validBrandIds = brandIds.filter(id => 
      mongoose.Types.ObjectId.isValid(id)
    );
    
    if (validBrandIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid brand IDs provided'
      });
    }
    
    // Check if any brands have associated products
    const brandsWithProducts = await Product.aggregate([
      {
        $match: {
          brand: { $in: validBrandIds.map(id => mongoose.Types.ObjectId(id)) },
          isActive: true
        }
      },
      {
        $group: {
          _id: '$brand',
          productCount: { $sum: 1 }
        }
      }
    ]);
    
    if (brandsWithProducts.length > 0) {
      const brandNames = await Brand.find(
        { _id: { $in: brandsWithProducts.map(b => b._id) } },
        'name'
      );
      
      return res.status(400).json({
        success: false,
        message: 'Some brands have associated products',
        brandsWithProducts: brandNames.map(b => b.name)
      });
    }
    
    // Soft delete brands (set isActive to false)
    const result = await Brand.updateMany(
      { _id: { $in: validBrandIds } },
      { $set: { isActive: false } }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} brand(s) deactivated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk delete brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk deleting brands',
      error: error.message
    });
  }
};

// @desc    Get popular brands (with most products)
// @route   GET /api/brands/popular
// @access  Public
exports.getPopularBrands = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get brands with product counts
    const popularBrands = await Brand.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'products',
          let: { brandId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$brand', '$$brandId'] },
                    { $eq: ['$isActive', true] }
                  ]
                }
              }
            }
          ],
          as: 'brandProducts'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$brandProducts' }
        }
      },
      {
        $match: {
          productCount: { $gt: 0 }
        }
      },
      {
        $sort: { productCount: -1, order: 1, name: 1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          name: 1,
          logo: 1,
          slug: 1,
          productCount: 1
        }
      }
    ]);
    
    // Process image URLs
    const processedBrands = popularBrands.map(brand => ({
      ...brand,
      logo: brand.logo ? getImageUrl(brand.logo, 'logo') : ''
    }));
    
    res.json({
      success: true,
      count: processedBrands.length,
      brands: processedBrands
    });
  } catch (error) {
    console.error('Get popular brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular brands',
      error: error.message
    });
  }
};

// @desc    Seed initial brands (Suzuki, Honda, Yamaha)
// @route   POST /api/brands/seed/initial
// @access  Private/Admin
exports.seedInitialBrands = async (req, res) => {
  try {
    // Check if brands already exist
    const existingBrands = await Brand.find({
      name: { $in: ['Suzuki', 'Honda', 'Yamaha'] }
    });
    
    if (existingBrands.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some brands already exist. Please delete them first or use update.',
        existingBrands: existingBrands.map(b => b.name)
      });
    }
    
    const initialBrands = [
      {
        name: 'Suzuki',
        description: 'Suzuki Motor Corporation is a Japanese multinational corporation headquartered in Minami-ku, Hamamatsu. Suzuki manufactures automobiles, motorcycles, all-terrain vehicles (ATVs), outboard marine engines, wheelchairs and a variety of other small internal combustion engines.',
        country: 'Japan',
        foundedYear: 1909,
        website: 'https://www.suzuki.com.ph',
        order: 1,
        seoTitle: 'Suzuki Motorcycles & Parts Philippines | Official',
        seoDescription: 'Official Suzuki motorcycles, parts, and accessories in the Philippines. Find your perfect Suzuki motorcycle today.',
        seoKeywords: 'suzuki, suzuki philippines, suzuki motorcycles, suzuki parts, suzuki accessories, suzuki service',
        primaryColor: '#ff0000',
        secondaryColor: '#ffffff',
        warrantyPolicy: '12 months warranty on all motorcycles and parts',
        socialMedia: {
          facebook: 'https://facebook.com/SuzukiMotorcyclesPH',
          instagram: 'https://instagram.com/SuzukiMotorcyclesPH',
          youtube: 'https://youtube.com/SuzukiPH'
        },
        serviceCenters: [
          {
            name: 'Suzuki Main Service Center',
            address: '123 Suzuki Street, Makati City',
            phone: '(02) 8888-8888',
            city: 'Makati',
            isActive: true
          }
        ]
      },
      {
        name: 'Honda',
        description: 'Honda Motor Company is a Japanese public multinational conglomerate corporation primarily known as a manufacturer of automobiles, motorcycles, and power equipment. Honda has been the world\'s largest motorcycle manufacturer since 1959.',
        country: 'Japan',
        foundedYear: 1948,
        website: 'https://www.honda.com.ph',
        order: 2,
        seoTitle: 'Honda Motorcycles Philippines | The Power of Dreams',
        seoDescription: 'Official Honda motorcycles, scooters, and parts in the Philippines. Experience quality and reliability with Honda.',
        seoKeywords: 'honda, honda philippines, honda motorcycles, honda scooters, honda parts, honda accessories',
        primaryColor: '#ff0000',
        secondaryColor: '#ffffff',
        warrantyPolicy: '24 months warranty on motorcycles, 12 months on parts',
        socialMedia: {
          facebook: 'https://facebook.com/HondaPhilippines',
          instagram: 'https://instagram.com/HondaPhilippines',
          youtube: 'https://youtube.com/HondaPH'
        },
        serviceCenters: [
          {
            name: 'Honda Main Service Center',
            address: '456 Honda Avenue, Quezon City',
            phone: '(02) 7777-7777',
            city: 'Quezon City',
            isActive: true
          }
        ]
      },
      {
        name: 'Yamaha',
        description: 'Yamaha Motor Co., Ltd. is a Japanese manufacturer of motorcycles, marine products such as boats and outboard motors, and other motorized products. The company was established in 1955 upon separation from Nippon Gakki Co., Ltd. (now Yamaha Corporation).',
        country: 'Japan',
        foundedYear: 1955,
        website: 'https://www.yamaha-motor.com.ph',
        order: 3,
        seoTitle: 'Yamaha Motor Philippines | Revs Your Heart',
        seoDescription: 'Official Yamaha motorcycles, scooters, and parts in the Philippines. Experience performance and style with Yamaha.',
        seoKeywords: 'yamaha, yamaha philippines, yamaha motorcycles, yamaha scooters, yamaha parts, yamaha accessories',
        primaryColor: '#0033cc',
        secondaryColor: '#ffffff',
        warrantyPolicy: '18 months warranty on all products',
        socialMedia: {
          facebook: 'https://facebook.com/YamahaMotorPhilippines',
          instagram: 'https://instagram.com/YamahaMotorPH',
          youtube: 'https://youtube.com/YamahaMotorPH'
        },
        serviceCenters: [
          {
            name: 'Yamaha Main Service Center',
            address: '789 Yamaha Road, Pasig City',
            phone: '(02) 6666-6666',
            city: 'Pasig',
            isActive: true
          }
        ]
      }
    ];
    
    const createdBrands = await Brand.insertMany(initialBrands);
    
    res.status(201).json({
      success: true,
      message: 'Initial brands seeded successfully',
      count: createdBrands.length,
      brands: createdBrands.map(brand => ({
        _id: brand._id,
        name: brand.name,
        slug: brand.slug,
        country: brand.country
      }))
    });
  } catch (error) {
    console.error('Seed initial brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding initial brands',
      error: error.message
    });
  }
};

// @desc    Clear all brands (for development/testing)
// @route   DELETE /api/brands/clear/all
// @access  Private/Admin
exports.clearAllBrands = async (req, res) => {
  try {
    // Check if any brands have associated products
    const brandsWithProducts = await Product.aggregate([
      {
        $group: {
          _id: '$brand',
          productCount: { $sum: 1 }
        }
      },
      {
        $match: {
          productCount: { $gt: 0 }
        }
      }
    ]);
    
    if (brandsWithProducts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot clear brands that have associated products',
        brandsWithProductsCount: brandsWithProducts.length
      });
    }
    
    // Get all brands to delete their images
    const allBrands = await Brand.find({});
    
    // Delete image files
    allBrands.forEach(brand => {
      if (brand.logo) {
        deleteImageFile(brand.logo);
      }
      if (brand.coverImage) {
        deleteImageFile(brand.coverImage);
      }
    });
    
    // Delete all brands
    const result = await Brand.deleteMany({});
    
    res.json({
      success: true,
      message: 'All brands cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear all brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing brands',
      error: error.message
    });
  }
};