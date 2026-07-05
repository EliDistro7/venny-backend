const express = require("express");
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectCityStats,
} = require("../controllers/projectController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { createPresignedUploadUrl } = require("../config/r2");

const router = express.Router();

// Single cover-image field (reuses your existing multer instance)
const uploadCover = upload.single("coverImage");

// POST /api/projects/presign
// body: { name, type }  — generates one presigned URL for the cover image
router.post("/presign", protect, express.json(), async (req, res, next) => {
  try {
    const { name, type } = req.body;
    const result = await createPresignedUploadUrl("projects/covers", name, type);
    res.json(result); // { url, key, publicUrl }
  } catch (err) {
    next(err);
  }
});

router.get("/cities/stats", getProjectCityStats);
router.get("/", getProjects);
router.get("/:id", getProject);

router.post("/", protect, uploadCover, createProject);
router.put("/:id", protect, uploadCover, updateProject);
router.delete("/:id", protect, deleteProject);

module.exports = router;