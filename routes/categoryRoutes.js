const express = require("express");
const router = express.Router();
const { auth, adminAuth } = require("../middleware/auth");
const categoryController = require("../controllers/categoryController");
const upload = require("../middleware/upload");

// Public routes
router.get("/", categoryController.getAllCategories);
router.get("/root", categoryController.getRootCategories);
router.get("/tree", categoryController.getCategoryTree);
router.get("/search", categoryController.searchCategories);
router.get("/stats", categoryController.getCategoryStats);
router.get("/:id", categoryController.getCategoryById);
router.get("/:id/path", categoryController.getCategoryPath);

// Admin routes
router.post("/", auth, adminAuth, upload.single("image"), categoryController.createCategory);
router.put("/:id", auth, adminAuth, upload.single("image"), categoryController.updateCategory);
router.delete("/:id", auth, adminAuth, categoryController.deleteCategory);
router.post("/bulk/update", auth, adminAuth, categoryController.bulkUpdateCategories);
router.post("/reassign-products", auth, adminAuth, categoryController.reassignCategoryProducts);
router.put("/move/:id", auth, adminAuth, categoryController.moveCategory);
router.post("/root", auth, adminAuth, categoryController.addRootCategory);

module.exports = router;