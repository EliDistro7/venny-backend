const express = require("express");
const router = express.Router();
const Content = require("../models/Content");
const { protect } = require("../middleware/auth"); // re-use your existing auth middleware

// ── Public ────────────────────────────────────────────────────────────────

/**
 * GET /api/content
 * Returns all content blocks as { key: data, ... }
 * Called by the Next.js public site (server component or getStaticProps).
 */
router.get("/", async (req, res, next) => {
  try {
    const blocks = await Content.find().lean();
    const map = {};
    blocks.forEach((b) => { map[b.key] = b.data; });
    res.json(map);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/content/:key
 * Returns a single block's data object.
 */
router.get("/:key", async (req, res, next) => {
  try {
    const block = await Content.findOne({ key: req.params.key.toLowerCase() }).lean();
    if (!block) return res.status(404).json({ message: "Content block not found" });
    res.json(block.data);
  } catch (err) {
    next(err);
  }
});

// ── Admin (protected) ─────────────────────────────────────────────────────

/**
 * PUT /api/content/:key
 * Upserts a content block. Creates it if it doesn't exist yet.
 * Body: the data object directly (not wrapped).
 */
router.put("/:key", protect, async (req, res, next) => {
  try {
    const key = req.params.key.toLowerCase();
    const data = req.body;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ message: "Body must be a JSON object" });
    }

    const block = await Content.findOneAndUpdate(
      { key },
      { key, data },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ key: block.key, data: block.data, updatedAt: block.updatedAt });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/content/:key  (optional — useful during development)
 */
router.delete("/:key", protect, async (req, res, next) => {
  try {
    const deleted = await Content.findOneAndDelete({ key: req.params.key.toLowerCase() });
    if (!deleted) return res.status(404).json({ message: "Content block not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;