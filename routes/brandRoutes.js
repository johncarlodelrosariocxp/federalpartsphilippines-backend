const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory for brands if it doesn't exist
const brandUploadsDir = path.join(__dirname, '../uploads/brands');
if (!fs.existsSync(brandUploadsDir)) {
  fs.mkdirSync(brandUploadsDir, { recursive: true });
}

// Configure multer storage for brand images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, brandUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'logo' ? 'logo-' : 'cover-';
    cb(null, prefix + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
  }
};

// Initialize multer upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 2 // Maximum 2 files (logo and cover)
  },
  fileFilter: fileFilter
});

// Public routes
router.get('/', brandController.getAllBrands);
router.get('/popular', brandController.getPopularBrands);
router.get('/slug/:slug', brandController.getBrandBySlug);
router.get('/:id', brandController.getBrandById);
router.get('/:id/products', brandController.getBrandProducts);

// Admin routes
router.post('/', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), brandController.createBrand);

router.put('/:id', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), brandController.updateBrand);

router.delete('/:id', brandController.deleteBrand);
router.patch('/:id/toggle-status', brandController.toggleBrandStatus);

// Stats and bulk operations
router.get('/stats/with-stats', brandController.getBrandsWithStats);
router.put('/bulk/update', brandController.bulkUpdateBrands);
router.delete('/bulk/delete', brandController.bulkDeleteBrands);

// Seed routes (for development/testing)
router.post('/seed/initial', brandController.seedInitialBrands);
router.delete('/clear/all', brandController.clearAllBrands);

module.exports = router;