const express = require("express");
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
} = require("../controllers/propertyController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", getProperties);
router.get("/:id", getProperty);

router.post("/", protect, upload.array("images", 10), createProperty);
router.put("/:id", protect, upload.array("images", 10), updateProperty);
router.delete("/:id", protect, deleteProperty);

module.exports = router;
