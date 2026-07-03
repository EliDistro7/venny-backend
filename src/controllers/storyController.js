const crypto = require("crypto");
const fs = require("fs");
const { Upload } = require("@aws-sdk/lib-storage");

const Story = require("../models/Story");
const {
  r2,
  uploadFileStreamToR2,
  uploadImagesToR2,
  deleteImageFromR2,
  deleteImagesFromR2,
  deleteVideoFromR2,
} = require("../config/r2");

const BUCKET = process.env.R2_BUCKET_NAME;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Build the Mongo filter for public story listings.
 * Supports: ?category=  ?tag=  ?featured=true  ?search=
 */
function buildPublicFilter(query) {
  const filter = { published: true };

  if (query.category) filter.category = query.category;
  if (query.tag)      filter.tags = query.tag;           // array field — Mongo matches element
  if (query.featured === "true") filter.featured = true;

  if (query.search) {
    const re = new RegExp(query.search.trim(), "i");
    filter.$or = [{ title: re }, { titleSw: re }, { excerpt: re }, { tags: re }];
  }

  return filter;
}

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

/**
 * GET /api/stories
 * Published stories. Supports filtering + pagination.
 *
 * Query params:
 *   category, tag, featured, search   — filtering (see buildPublicFilter)
 *   page   (default 1)
 *   limit  (default 12, max 50)
 *   sort   "newest" | "oldest" | "eventDate" (default "newest")
 */
async function listStories(req, res, next) {
  try {
    const filter = buildPublicFilter(req.query);

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const skip  = (page - 1) * limit;

    const sortMap = {
      newest:    { createdAt: -1 },
      oldest:    { createdAt:  1 },
      eventDate: { eventDate: -1, createdAt: -1 },
    };
    const sort = sortMap[req.query.sort] || { featured: -1, sortOrder: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      Story.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v -body -bodySw") // omit heavy body from list view
        .lean(),
      Story.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stories/:idOrSlug
 * Single published story — full body included.
 * Accepts either a MongoDB ObjectId or a slug string.
 */
async function getStory(req, res, next) {
  try {
    const { idOrSlug } = req.params;
    const isId = /^[a-f\d]{24}$/i.test(idOrSlug);

    const query = isId
      ? { _id: idOrSlug, published: true }
      : { slug: idOrSlug, published: true };

    const item = await Story.findOne(query).select("-__v").lean();
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

/**
 * GET /api/stories/admin/all
 * All stories (published + drafts) for the admin panel.
 * Supports same filters as listStories but without the published=true gate.
 */
async function adminListAll(req, res, next) {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.tag)      filter.tags = req.query.tag;

    const items = await Story.find(filter)
      .sort({ createdAt: -1 })
      .select("-__v -body -bodySw")
      .lean();

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/stories
 * Create a new story (metadata only — media uploaded via separate endpoints).
 *
 * Body fields (all optional except title + category):
 *   title, titleSw, slug, category, excerpt, excerptSw,
 *   body, bodySw, eventDate, location, tags, attendees,
 *   pullQuote, pullQuoteSw, quoteAuthor, videoUrl,
 *   published, featured, sortOrder
 */
async function createStory(req, res, next) {
  try {
    const allowed = [
      "title", "titleSw", "slug", "category",
      "excerpt", "excerptSw", "body", "bodySw",
      "eventDate", "location", "tags", "attendees",
      "pullQuote", "pullQuoteSw", "quoteAuthor",
      "videoUrl", "published", "featured", "sortOrder",
    ];

    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    // Coerce booleans coming in as strings
    if (data.published !== undefined) data.published = data.published === true || data.published === "true";
    if (data.featured  !== undefined) data.featured  = data.featured  === true || data.featured  === "true";

    // Coerce tags — accept comma-separated string or array
    if (typeof data.tags === "string") {
      data.tags = data.tags.split(",").map((t) => t.trim()).filter(Boolean);
    }

    const item = await Story.create(data);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/stories/:id
 * Update metadata (not media — those have their own endpoints).
 */
async function updateStory(req, res, next) {
  try {
    const allowed = [
      "title", "titleSw", "slug", "category",
      "excerpt", "excerptSw", "body", "bodySw",
      "eventDate", "location", "tags", "attendees",
      "pullQuote", "pullQuoteSw", "quoteAuthor",
      "videoUrl", "published", "featured", "sortOrder",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.published !== undefined) updates.published = updates.published === true || updates.published === "true";
    if (updates.featured  !== undefined) updates.featured  = updates.featured  === true || updates.featured  === "true";

    if (typeof updates.tags === "string") {
      updates.tags = updates.tags.split(",").map((t) => t.trim()).filter(Boolean);
    }

    const item = await Story.findByIdAndUpdate(
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
 * DELETE /api/stories/:id
 * Delete story + all its R2 media.
 */
async function deleteStory(req, res, next) {
  try {
    const item = await Story.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    // Clean up R2 assets in parallel
    const cleanupTasks = [];
    if (item.coverUrl)                   cleanupTasks.push(deleteImageFromR2(item.coverUrl));
    if (item.galleryUrls?.length)        cleanupTasks.push(deleteImagesFromR2(item.galleryUrls));
    if (item.videoUrl?.startsWith("http")) cleanupTasks.push(deleteVideoFromR2(item.videoUrl));

    await Promise.allSettled(cleanupTasks); // don't abort delete if R2 cleanup fails

    await item.deleteOne();
    res.json({ success: true, message: "Story deleted" });
  } catch (err) {
    next(err);
  }
}


// storyController.js
const getStoryAdmin = async  (req, res) => {
  try {
    const story = await Story.findById(req.params.id).lean();
    if (!story) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: story });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── MEDIA ENDPOINTS ───────────────────────────────────────────────────────────

/**
 * POST /api/stories/:id/cover
 * Upload or replace the hero/cover image. Field: cover
 */
async function uploadCover(req, res, next) {
  try {
   
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided" });

    const item = await Story.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    if (item.coverUrl) await deleteImageFromR2(item.coverUrl);

    const publicUrl = await uploadFileStreamToR2(req.file, "stories/covers", "jpg");
    item.coverUrl = publicUrl;
    await item.save();

    res.json({ success: true, data: { coverUrl: item.coverUrl } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/stories/:id/cover
 * Remove the cover image from R2 and clear the field.
 */
async function deleteCover(req, res, next) {
  try {
    const item = await Story.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    if (!item.coverUrl) return res.status(404).json({ success: false, message: "No cover image" });

    await deleteImageFromR2(item.coverUrl);
    item.coverUrl = "";
    await item.save();

    res.json({ success: true, message: "Cover removed" });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/stories/:id/gallery
 * Append one or more images to the gallery. Field: images (multi)
 * Returns the updated galleryUrls array.
 */
async function uploadGalleryImages(req, res, next) {
  try {
     console.log("req.body:", req.body); 
    if (!req.files?.length) return res.status(400).json({ success: false, message: "No files provided" });

    const item = await Story.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    const urls = await Promise.all(
      req.files.map((f) => uploadFileStreamToR2(f, "stories/gallery", "jpg"))
    );

    item.galleryUrls.push(...urls);
    await item.save();

    res.json({ success: true, data: { galleryUrls: item.galleryUrls } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/stories/:id/gallery
 * Remove a specific gallery image by URL.
 * Body: { url: "https://..." }
 */
async function deleteGalleryImage(req, res, next) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: "url is required" });

    const item = await Story.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    const idx = item.galleryUrls.indexOf(url);
    if (idx === -1) return res.status(404).json({ success: false, message: "Image not found in gallery" });

    await deleteImageFromR2(url);
    item.galleryUrls.splice(idx, 1);
    await item.save();

    res.json({ success: true, data: { galleryUrls: item.galleryUrls } });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/stories/:id/gallery/reorder
 * Reorder gallery images.
 * Body: { urls: ["url1", "url2", ...] }  (complete ordered array)
 */
async function reorderGallery(req, res, next) {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls)) return res.status(400).json({ success: false, message: "urls must be an array" });

    const item = await Story.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    // Validate — only allow URLs already on this story
    const existing = new Set(item.galleryUrls);
    const invalid  = urls.filter((u) => !existing.has(u));
    if (invalid.length) {
      return res.status(400).json({ success: false, message: "Unknown gallery URLs", invalid });
    }

    item.galleryUrls = urls;
    await item.save();

    res.json({ success: true, data: { galleryUrls: item.galleryUrls } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStories,
  getStory,
  adminListAll,
  getStoryAdmin,
  createStory,
  updateStory,
  deleteStory,
  uploadCover,
  deleteCover,
  uploadGalleryImages,
  deleteGalleryImage,
  reorderGallery,
};