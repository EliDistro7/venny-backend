const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    // ── Core content ───────────────────────────────────────────────────────
    title:       { type: String, required: true, trim: true },
    titleSw:     { type: String, trim: true, default: "" },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      // auto-generated from title if blank — see pre-save hook below
    },

    // Short teaser shown on cards / social previews
    excerpt:     { type: String, default: "", maxlength: 300 },
    excerptSw:   { type: String, default: "", maxlength: 300 },

    // Rich-text body (store as HTML or Markdown — your frontend decides)
    body:        { type: String, default: "" },
    bodySw:      { type: String, default: "" },

    // ── Event metadata ─────────────────────────────────────────────────────
    category: {
      type: String,
      enum: ["event", "milestone", "project", "behind-the-scenes", "testimonial", "other"],
      required: true,
    },

    eventDate: {
      type: Date,
      default: null,  // null means "not a dated event" (e.g. evergreen story)
    },

    location: { type: String, trim: true, default: "" },   // e.g. "Dar es Salaam"

    // ── Media ──────────────────────────────────────────────────────────────
    coverUrl:    { type: String, default: "" },  // R2 public URL — hero / card image
    // Additional gallery images (up to ~10 recommended)
    galleryUrls: { type: [String], default: [] },

    // Optional video (R2 public URL or external embed URL like YouTube)
    videoUrl:    { type: String, default: "" },

    // ── Social proof extras ────────────────────────────────────────────────
    // Tags for filtering on the frontend (e.g. ["award", "partnership"])
    tags: { type: [String], default: [] },

    // Number of people / clients involved — good for social proof copy
    attendees: { type: Number, default: null },

    // Optional pull-quote to highlight
    pullQuote:   { type: String, default: "" },
    pullQuoteSw: { type: String, default: "" },
    quoteAuthor: { type: String, default: "" }, // name + role, e.g. "Jane Doe, CEO"

    // ── Visibility ─────────────────────────────────────────────────────────
    published:  { type: Boolean, default: false },
    featured:   { type: Boolean, default: false },  // pin to top / hero section
    sortOrder:  { type: Number, default: 0 },        // manual ordering override
  },
  { timestamps: true }
);

// ── Auto-slug from title ───────────────────────────────────────────────────────
storySchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .substring(0, 80);
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
storySchema.index({ published: 1, createdAt: -1 });
storySchema.index({ slug: 1 }, { unique: true, sparse: true });
storySchema.index({ tags: 1 });
storySchema.index({ featured: 1, sortOrder: -1 });

module.exports = mongoose.model("Story", storySchema);