const mongoose = require("mongoose");

/**
 * One document per named content block.
 * key  — unique slug e.g. "hero", "stats", "whyUs", "cta"
 * data — free-form object; shape is documented in seed.js, not enforced here
 */
const contentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Content", contentSchema);