const crypto = require("crypto");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const Portfolio = require("../models/Portfolio");
const {
  r2,
  uploadFileStreamToR2,
  deleteImageFromR2,
} = require("../config/r2");                // ← adjust path to your r2 helper

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

// ── helpers ───────────────────────────────────────────────────────────────────

// Delete an EPUB from R2 by its stored key
async function deleteEpubFromR2(key) {
  if (!key) return;
  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error(`Failed to delete R2 epub ${key}:`, err.message);
  }
}

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

/**
 * GET /api/portfolio
 * Returns all published items. Supports ?category= filter.
 */
async function listPortfolio(req, res, next) {
  try {
    const filter = { published: true };
    if (req.query.category) filter.category = req.query.category;

    const items = await Portfolio.find(filter)
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/portfolio/:id
 * Single published item (no EPUB URL — use the /epub-url endpoint for that).
 */
async function getPortfolioItem(req, res, next) {
  try {
    const item = await Portfolio.findOne({
      _id: req.params.id,
      published: true,
    }).select("-__v");

    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/portfolio/:id/epub-url
 * Returns a short-lived presigned GET URL for the EPUB file.
 * Only issued for published items that have an epub attached.
 */
async function getEpubUrl(req, res, next) {
  try {
    const item = await Portfolio.findOne({
      _id: req.params.id,
      published: true,
    });

    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    if (!item.epubKey) return res.status(404).json({ success: false, message: "No EPUB attached to this item" });

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: item.epubKey });
    // 1-hour window — enough for a reading session
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });

    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

/**
 * GET /api/portfolio/admin/all
 * All items (published + drafts) for the admin panel.
 */
async function adminListAll(req, res, next) {
  try {
    const items = await Portfolio.find().sort({ createdAt: -1 }).select("-__v");
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/portfolio
 * Create a new portfolio item (metadata only — files uploaded separately).
 */
async function createPortfolioItem(req, res, next) {
  try {
    const { title, titleSw, category, client, year, description, descriptionSw, published } = req.body;

    const item = await Portfolio.create({
      title,
      titleSw,
      category,
      client,
      year,
      description,
      descriptionSw,
      published: published === true || published === "true",
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/portfolio/:id
 * Update metadata fields (not files — those have their own endpoints).
 */
async function updatePortfolioItem(req, res, next) {
  try {
    const allowed = ["title", "titleSw", "category", "client", "year", "description", "descriptionSw", "published"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const item = await Portfolio.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/portfolio/:id
 * Delete item + its R2 files.
 */
async function deletePortfolioItem(req, res, next) {
  try {
    const item = await Portfolio.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    // Clean up R2
    if (item.coverUrl) await deleteImageFromR2(item.coverUrl);
    if (item.epubKey) await deleteEpubFromR2(item.epubKey);

    await item.deleteOne();

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/portfolio/:id/cover
 * Upload (or replace) the cover image. Accepts multipart/form-data field: cover
 */
async function uploadCover(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided" });

    const item = await Portfolio.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    // Delete old cover from R2 if one exists
    if (item.coverUrl) await deleteImageFromR2(item.coverUrl);

    // Upload new cover
    const publicUrl = await uploadFileStreamToR2(req.file, "portfolio/covers", "jpg");

    item.coverUrl = publicUrl;
    await item.save();

    res.json({ success: true, data: { coverUrl: item.coverUrl } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/portfolio/:id/epub
 * Upload (or replace) the EPUB file. Accepts multipart/form-data field: epub
 */
async function uploadEpub(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided" });

    const item = await Portfolio.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    if (item.epubKey) await deleteEpubFromR2(item.epubKey);

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const key = `portfolio/epubs/${crypto.randomUUID()}.${ext}`;
    const fs = require("fs");
    const { Upload } = require("@aws-sdk/lib-storage");

    const mimeMap = {
      pdf:  "application/pdf",
      epub: "application/epub+zip",
    };

    const stream = fs.createReadStream(req.file.path);
    const upload = new Upload({
      client: r2,
      params: {
        Bucket: BUCKET,
        Key: key,
        Body: stream,
        ContentType: mimeMap[ext] || "application/octet-stream",
      },
      partSize: 10 * 1024 * 1024,
      queueSize: 1,
    });

    await upload.done();

    fs.unlink(req.file.path, (err) => {
      if (err) console.error(`Failed to remove temp file ${req.file.path}:`, err.message);
    });

    item.epubKey = key;
    await item.save();

    res.json({ success: true, data: { epubKey: item.epubKey } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/portfolio/:id/epub
 * Remove the EPUB from R2 and clear the key on the document.
 */
async function deleteEpub(req, res, next) {
  try {
    const item = await Portfolio.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    if (!item.epubKey) return res.status(404).json({ success: false, message: "No EPUB attached" });

    await deleteEpubFromR2(item.epubKey);
    item.epubKey = "";
    await item.save();

    res.json({ success: true, message: "EPUB removed" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};