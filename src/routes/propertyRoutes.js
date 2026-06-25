const express = require("express");
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getCities,
  getCityStats,
} = require("../controllers/propertyController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Accept both "images" (max 10) and "videos" (max 5) in the same request
const uploadFields = upload.fields([
  { name: "images", maxCount: 10 },
  { name: "videos", maxCount: 5 },
]);

router.get("/cities/stats", getCityStats);
router.get("/cities", getCities);
router.get("/", getProperties);
router.get("/:id", getProperty);

router.post("/", protect, uploadFields, createProperty);
router.put("/:id", protect, uploadFields, updateProperty);
router.delete("/:id", protect, deleteProperty);

module.exports = router;