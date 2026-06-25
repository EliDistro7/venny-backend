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
const { createPresignedUploadUrl } = require("../config/r2");

const router = express.Router();

// Accept both "images" (max 10) and "videos" (max 5) in the same request
const uploadFields = upload.fields([
  { name: "images", maxCount: 10 },
  { name: "videos", maxCount: 5 },
]);


// POST /api/properties/presign
// body: { files: [{ name, type, category }] }  category = "image" | "video"
router.post("/presign", protect, async (req, res, next) => {
  try {
    const { files } = req.body; // [{ name, type, category }]
    const results = await Promise.all(
      files.map(({ name, type, category }) => {
        const prefix = category === "video" ? "properties/videos" : "properties/images";
        return createPresignedUploadUrl(prefix, name, type);
      })
    );
    res.json(results); // [{ url, key, publicUrl }]
  } catch (err) {
    next(err);
  }
});

router.get("/cities/stats", getCityStats);
router.get("/cities", getCities);
router.get("/", getProperties);
router.get("/:id", getProperty);

router.post("/", protect, uploadFields, createProperty);
router.put("/:id", protect, uploadFields, updateProperty);
router.delete("/:id", protect, deleteProperty);

module.exports = router;