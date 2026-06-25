

const Property = require("../models/Property");
const { uploadImagesToR2, deleteImagesFromR2 } = require("../config/r2");


/**
 * Amenities can arrive as a JSON array string (preferred) or a
 * comma-separated string. This normalizes either into a string array.
 */
function parseAmenities(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((a) => String(a).trim()).filter(Boolean);

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((a) => String(a).trim()).filter(Boolean);
  } catch {
    // not JSON, fall through to comma-split
  }

  return raw.split(",").map((a) => a.trim()).filter(Boolean);
}

// GET /api/properties  (public, supports optional filters)
async function getProperties(req, res, next) {
  try {
    const { city, type, category, featured } = req.query;
    const filter = {};

    if (city && city !== "All Cities") filter.city = city;
    if (type && type !== "All") filter.type = type;
    if (category && category !== "All Types") filter.category = category;
    if (featured !== undefined) filter.featured = featured === "true";

    const properties = await Property.find(filter).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    next(err);
  }
}

async function getCityStats(req, res, next) {
  try {
    const stats = await Property.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          image: { $first: { $arrayElemAt: ["$images", 0] } },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, city: "$_id", count: 1, image: { $ifNull: ["$image", ""] } } },
    ]);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
// GET /api/properties/cities  (public)
async function getCities(req, res, next) {
  try {
    const cities = await Property.distinct("city");
    res.json(["All Cities", ...cities.sort()]);
  } catch (err) {
    next(err);
  }
}

// GET /api/properties/:id  (public)
async function getProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });
    res.json(property);
  } catch (err) {
    next(err);
  }
}

// POST /api/properties  (protected, multipart/form-data with an "images" field)
async function createProperty(req, res, next) {
  try {
    const imageUrls = req.files?.length ? await uploadImagesToR2(req.files) : [];
    console.log("imageUrls after R2 upload:", imageUrls);
    const property = await Property.create({
      title: req.body.title,
      location: req.body.location,
      city: req.body.city,
     
      type: req.body.type,
      category: req.body.category,
      bedrooms: Number(req.body.bedrooms) || 0,
      bathrooms: Number(req.body.bathrooms) || 0,
      area: Number(req.body.area),
      status: req.body.status || "delivered",
      featured: req.body.featured === "true" || req.body.featured === true,
      description: req.body.description || "",
      amenities: parseAmenities(req.body.amenities),
      images: imageUrls,
    });

    res.status(201).json(property);
  } catch (err) {
    next(err);
  }
}

// PUT /api/properties/:id  (protected, multipart/form-data)
// Accepts optional new "images" files to append, and an optional
// "removeImages" field (JSON array of existing URLs) to delete.
async function updateProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const fields = [
      "title",
      "location",
      "city",

      "type",
      "category",
      "status",
      "description",
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) property[field] = req.body[field];
    });

   
    if (req.body.bedrooms !== undefined) property.bedrooms = Number(req.body.bedrooms);
    if (req.body.bathrooms !== undefined) property.bathrooms = Number(req.body.bathrooms);
    if (req.body.area !== undefined) property.area = Number(req.body.area);
    if (req.body.featured !== undefined) {
      property.featured = req.body.featured === "true" || req.body.featured === true;
    }
    if (req.body.amenities !== undefined) {
      property.amenities = parseAmenities(req.body.amenities);
    }

    // Remove any images the admin deleted in the form
    if (req.body.removeImages) {
      let toRemove = [];
      try {
        toRemove = JSON.parse(req.body.removeImages);
      } catch {
        toRemove = [];
      }
      if (toRemove.length) {
        await deleteImagesFromR2(toRemove);
        property.images = property.images.filter((url) => !toRemove.includes(url));
      }
    }

    // Append any newly uploaded images
    if (req.files?.length) {
      const newUrls = await uploadImagesToR2(req.files);
      property.images = [...property.images, ...newUrls];
    }

    await property.save();
    res.json(property);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/properties/:id  (protected)
async function deleteProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    await deleteImagesFromR2(property.images);
    await property.deleteOne();

    res.json({ message: "Property deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getCityStats,
  getCities,
};
