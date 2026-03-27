const express = require("express");
const router = express.Router();
const { auth, adminAuth } = require("../middleware/auth");
const brandController = require("../controllers/brandController");
const upload = require("../middleware/uploadBrand");

// Public routes
router.get("/", brandController.getAllBrands);
router.get("/popular", brandController.getPopularBrands);
router.get("/slug/:slug", brandController.getBrandBySlug);
router.get("/:id", brandController.getBrandById);
router.get("/:id/products", brandController.getBrandProducts);

// Admin routes
router.post("/", auth, adminAuth, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), brandController.createBrand);

router.put("/:id", auth, adminAuth, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), brandController.updateBrand);

router.delete("/:id", auth, adminAuth, brandController.deleteBrand);
router.patch("/:id/toggle-status", auth, adminAuth, brandController.toggleBrandStatus);
router.get("/stats/with-stats", auth, adminAuth, brandController.getBrandsWithStats);
router.put("/bulk/update", auth, adminAuth, brandController.bulkUpdateBrands);
router.delete("/bulk/delete", auth, adminAuth, brandController.bulkDeleteBrands);
router.post("/seed/initial", auth, adminAuth, brandController.seedInitialBrands);
router.delete("/clear/all", auth, adminAuth, brandController.clearAllBrands);

module.exports = router;