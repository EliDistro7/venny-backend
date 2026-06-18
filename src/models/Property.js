const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
   
    type: { type: String, enum: ["sale", "rent"], required: true },
    category: {
      type: String,
      enum: ["apartment", "villa", "house", "land", "commercial"],
      required: true,
    },
    bedrooms: { type: Number, default: 0, min: 0 },
    bathrooms: { type: Number, default: 0, min: 0 },
    area: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["delivered", "work_in_progress"],
      default: "delivered",
    },
    images: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    description: { type: String, default: "" },
    amenities: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);
