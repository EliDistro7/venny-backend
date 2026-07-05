const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // Location info (mirrors your property convention)
    location: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },

    // Cover image shown in listings (single URL, same R2 bucket)
    coverImage: { type: String, default: "" },

    // Properties that belong to this project
    properties: [{ type: mongoose.Schema.Types.ObjectId, ref: "Property" }],

    featured: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["active", "completed", "on_hold"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProjectVenny", projectSchema);