const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    titleSw: { type: String, trim: true, default: "" },

    category: {
      type: String,
      enum: ["profile", "website", "app", "card", "proposal"],
      required: true,
    },

    client: { type: String, required: true, trim: true },
    year: { type: String, required: true },

    description: { type: String, default: "" },
    descriptionSw: { type: String, default: "" },

    // Optional external link (e.g. live site or app store URL)
    link: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (value) {
          if (!value) return true; // optional — empty is fine
          return /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(value);
        },
        message: (props) => `${props.value} is not a valid URL`,
      },
    },

    // R2 public URL for the grid thumbnail
    coverUrl: { type: String, default: "" },
    // R2 object key — used to generate presigned EPUB read URLs + for deletion
    epubKey: { type: String, default: "" },

    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);