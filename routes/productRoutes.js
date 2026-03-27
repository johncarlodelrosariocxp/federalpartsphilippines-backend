const express = require("express");
const router = express.Router();
const { auth, adminAuth } = require("../middleware/auth");
const productController = require("../controllers/productController");

// =================== PUBLIC ROUTES ===================
router.get("/", productController.getAllProducts);
router.get("/featured", productController.getFeaturedProducts);
router.get("/search", productController.searchProducts);
router.get("/category/:categoryId", productController.getProductsByCategory);
router.get("/:id", productController.getProductById);
router.get("/:id/related", productController.getRelatedProducts);

// =================== PROTECTED ROUTES ===================
router.post("/:id/reviews", auth, productController.addReview);

// =================== ADMIN ROUTES ===================
// IMPORTANT: These routes need to be defined BEFORE the :id route
// Create product
router.post("/", auth, adminAuth, productController.createProduct);

// Admin get all products (including inactive)
router.get("/admin/all", auth, adminAuth, productController.getAllProductsForAdmin);

// Update product
router.put("/:id", auth, adminAuth, productController.updateProduct);

// Delete product
router.delete("/:id", auth, adminAuth, productController.deleteProduct);

// Update stock
router.patch("/:id/stock", auth, adminAuth, productController.updateStock);

// Toggle featured
router.patch("/:id/featured", auth, adminAuth, productController.toggleFeatured);

// Toggle active
router.patch("/:id/active", auth, adminAuth, productController.toggleActive);

// Bulk operations
router.post("/bulk/update", auth, adminAuth, productController.bulkUpdateProducts);
router.post("/bulk/delete", auth, adminAuth, productController.bulkDeleteProducts);
router.post("/bulk/status", auth, adminAuth, productController.bulkUpdateStatus);

// Stats and reports
router.get("/stats/overview", auth, adminAuth, productController.getProductStats);
router.get("/low-stock/list", auth, adminAuth, productController.getLowStockProducts);
router.get("/export/csv", auth, adminAuth, productController.exportProducts);

// Image operations
router.post("/:id/images", auth, adminAuth, productController.uploadProductImage);
router.delete("/:id/images/:imageIndex", auth, adminAuth, productController.deleteProductImage);

// Reviews
router.get("/:id/reviews", auth, adminAuth, productController.getProductReviews);
router.patch("/reviews/:reviewId", auth, adminAuth, productController.updateReviewStatus);

module.exports = router;