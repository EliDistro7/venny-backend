const express = require("express");
const router = express.Router();

const {
  listPortfolio,
  getPortfolioItem,
  getEpubUrl,
  adminListAll,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  uploadCover,
  uploadEpub,
  deleteEpub,
} = require("../controllers/portfolioController");

const upload = require("../middleware/upload");
const { protectAdmin } = require("../middleware/protectAdmin");

// ── Public (non-parameterized) ────────────────────────────────────────────────
router.get("/", listPortfolio);

// ── Admin (must come before /:id so "admin" isn't swallowed as an id) ────────
router.use("/admin", protectAdmin);
router.get("/admin/all", adminListAll);
router.post("/", protectAdmin, createPortfolioItem);
router.put("/:id", protectAdmin, updatePortfolioItem);
router.delete("/:id", protectAdmin, deletePortfolioItem);
router.post("/:id/cover", protectAdmin, upload.single("cover"), uploadCover);
router.post("/:id/epub",  protectAdmin, upload.single("epub"),  uploadEpub);
router.delete("/:id/epub", protectAdmin, deleteEpub);

// ── Public (parameterized — last so nothing above gets shadowed) ──────────────
router.get("/:id", getPortfolioItem);
router.get("/:id/epub-url", getEpubUrl);

module.exports = router;