const express = require("express");
const router  = express.Router();
const json    = express.json();

const {
  listStories,
  getStory,
  adminListAll,
  createStory,
  updateStory,
  deleteStory,
  uploadCover,
  deleteCover,
  uploadGalleryImages,
  getStoryAdmin,
  deleteGalleryImage,
  reorderGallery,
} = require("../controllers/storyController");

const upload        = require("../middleware/upload");
const { protect }   = require("../middleware/auth");

// ── Public (non-parameterized) ────────────────────────────────────────────────
router.get("/", listStories);

// ── Admin (non-parameterized — must come before /:id routes) ─────────────────
router.get("/admin/all", protect, adminListAll);
router.get("/admin/:id", protect, getStoryAdmin);

// ── Admin CRUD (JSON body) ────────────────────────────────────────────────────
router.post("/",      protect, json, createStory);
router.put("/:id",    protect, json, updateStory);
router.delete("/:id", protect, json, deleteStory);

// ── Cover (multipart — no json middleware) ────────────────────────────────────
router.post("/:id/cover",   protect, upload.single("cover"), uploadCover);
router.delete("/:id/cover", protect,                         deleteCover);

// ── Gallery (multipart for upload, json for delete/reorder) ──────────────────
router.post("/:id/gallery",        protect, upload.array("images", 10), uploadGalleryImages);
router.delete("/:id/gallery",      protect, json,                        deleteGalleryImage);
router.put("/:id/gallery/reorder", protect, json,                        reorderGallery);

// ── Public (parameterized — must be last) ─────────────────────────────────────
router.get("/:idOrSlug", getStory);

module.exports = router;