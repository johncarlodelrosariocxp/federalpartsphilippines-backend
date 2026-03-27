// backend/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { auth, adminAuth } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

// =================== DASHBOARD STATS ===================
router.get("/dashboard/stats", auth, adminAuth, adminController.getDashboardStats);

// =================== USER MANAGEMENT ===================
router.get("/users", auth, adminAuth, adminController.getAllUsers);
router.get("/users/:id", auth, adminAuth, adminController.getUserById);
router.put("/users/:id", auth, adminAuth, adminController.updateUser);
router.delete("/users/:id", auth, adminAuth, adminController.deleteUser);
router.post("/users/bulk/delete", auth, adminAuth, adminController.bulkDeleteUsers);
router.put("/users/:id/role", auth, adminAuth, adminController.updateUserRole);

// =================== PRODUCT MANAGEMENT ===================
router.get("/products", auth, adminAuth, adminController.getAllProductsAdmin);
router.get("/products/:id", auth, adminAuth, adminController.getProductDetailsAdmin);
router.post("/products", auth, adminAuth, adminController.createProductAdmin);
router.put("/products/:id", auth, adminAuth, adminController.updateProductAdmin);
router.delete("/products/:id", auth, adminAuth, adminController.deleteProductAdmin);
router.post("/products/bulk/delete", auth, adminAuth, adminController.bulkDeleteProductsAdmin);
router.patch("/products/:id/status", auth, adminAuth, adminController.toggleProductStatus);

// =================== CATEGORY MANAGEMENT ===================
router.get("/categories", auth, adminAuth, adminController.getAllCategoriesAdmin);
router.get("/categories/:id", auth, adminAuth, adminController.getCategoryDetailsAdmin);
router.post("/categories", auth, adminAuth, adminController.createCategoryAdmin);
router.put("/categories/:id", auth, adminAuth, adminController.updateCategoryAdmin);
router.delete("/categories/:id", auth, adminAuth, adminController.deleteCategoryAdmin);
router.post("/categories/bulk/delete", auth, adminAuth, adminController.bulkDeleteCategoriesAdmin);
router.patch("/categories/:id/status", auth, adminAuth, adminController.toggleCategoryStatus);

// =================== BRAND MANAGEMENT ===================
router.get("/brands", auth, adminAuth, adminController.getAllBrandsAdmin);
router.get("/brands/:id", auth, adminAuth, adminController.getBrandDetailsAdmin);
router.post("/brands", auth, adminAuth, adminController.createBrandAdmin);
router.put("/brands/:id", auth, adminAuth, adminController.updateBrandAdmin);
router.delete("/brands/:id", auth, adminAuth, adminController.deleteBrandAdmin);
router.post("/brands/bulk/delete", auth, adminAuth, adminController.bulkDeleteBrandsAdmin);
router.patch("/brands/:id/status", auth, adminAuth, adminController.toggleBrandStatus);

// =================== ORDERS MANAGEMENT ===================
router.get("/orders", auth, adminAuth, adminController.getAllOrders);
router.get("/orders/:id", auth, adminAuth, adminController.getOrderDetails);
router.put("/orders/:id/status", auth, adminAuth, adminController.updateOrderStatus);
router.delete("/orders/:id", auth, adminAuth, adminController.deleteOrder);

// =================== SYSTEM MANAGEMENT ===================
router.get("/system/info", auth, adminAuth, adminController.getSystemInfo);
router.post("/system/backup", auth, adminAuth, adminController.createBackup);
router.post("/system/clear-cache", auth, adminAuth, adminController.clearCache);
router.get("/logs", auth, adminAuth, adminController.getSystemLogs);

module.exports = router;