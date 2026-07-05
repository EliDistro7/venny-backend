const Project = require("../models/Project");
const Property = require("../models/Property");
const { uploadImagesToR2, deleteImagesFromR2 } = require("../config/r2");

// ─── GET /api/projects  (public) ────────────────────────────────────────────
// Optional filters: city, status, featured


async function getProjects(req, res, next) {
  try {
    const { city, status, featured } = req.query;
    console.log('RAW QUERY:', req.query);          // ← add this
    const filter = {};

    if (city && city !== "All Cities") filter.city = city;
    if (status) filter.status = status;
    if (featured === "true")  filter.featured = true;    // ← fix this
    if (featured === "false") filter.featured = false;   // ← fix this

    console.log('FILTER APPLIED:', filter);        // ← add this
    const projects = await Project.find(filter)
      .populate("properties")
      .sort({ createdAt: -1 });

  
    res.json(projects);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/projects/:id  (public) ────────────────────────────────────────
async function getProject(req, res, next) {
  try {

const project = await Project.findById(req.params.id).populate("properties");
console.log("PROJECT PROPERTIES:", JSON.stringify(project.properties, null, 2));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/projects  (protected) ────────────────────────────────────────
// Body: { name, description, location, city, featured, status, propertyIds? }
// File: optional "coverImage" field via multer
async function createProject(req, res, next) {
  try {
    // Cover image — presigned-URL path or multer path
    let coverImage = "";
    if (req.body.coverImageUrl) {
      coverImage = req.body.coverImageUrl; // already uploaded to R2
    } else if (req.file) {
      const [url] = await uploadImagesToR2([req.file]);
      coverImage = url;
    }

    // Parse incoming property IDs (JSON array string or plain array)
    let propertyIds = [];
    if (req.body.propertyIds) {
      try { propertyIds = JSON.parse(req.body.propertyIds); } catch { propertyIds = []; }
    }

    const project = await Project.create({
      name: req.body.name,
      description: req.body.description || "",
      location: req.body.location,
      city: req.body.city,
      coverImage,
      featured: req.body.featured === "true" || req.body.featured === true,
      status: req.body.status || "active",
      properties: propertyIds,
    });

    res.status(201).json(await project.populate("properties"));
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/projects/:id  (protected) ─────────────────────────────────────
async function updateProject(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Scalar fields
    const fields = ["name", "description", "location", "city", "status"];
    fields.forEach((f) => { if (req.body[f] !== undefined) project[f] = req.body[f]; });

    if (req.body.featured !== undefined) {
      project.featured = req.body.featured === "true" || req.body.featured === true;
    }

    // Cover image replacement
    if (req.body.coverImageUrl) {
      // New presigned-URL upload — delete old one first
      if (project.coverImage) await deleteImagesFromR2([project.coverImage]);
      project.coverImage = req.body.coverImageUrl;
    } else if (req.file) {
      if (project.coverImage) await deleteImagesFromR2([project.coverImage]);
      const [url] = await uploadImagesToR2([req.file]);
      project.coverImage = url;
    }

    // Property list management — three modes:
    //
    //   propertyIds   → replace the whole list (full control)
    //   addProperties → append without duplicates
    //   removeProperties → pluck specific IDs out
    if (req.body.propertyIds !== undefined) {
      try { project.properties = JSON.parse(req.body.propertyIds); } catch { /* ignore */ }
    } else {
      if (req.body.addProperties) {
        let toAdd = [];
        try { toAdd = JSON.parse(req.body.addProperties); } catch { /* ignore */ }
        const existing = project.properties.map(String);
        const deduped = toAdd.filter((id) => !existing.includes(String(id)));
        project.properties.push(...deduped);
      }

      if (req.body.removeProperties) {
        let toRemove = [];
        try { toRemove = JSON.parse(req.body.removeProperties); } catch { /* ignore */ }
        const removeSet = new Set(toRemove.map(String));
        project.properties = project.properties.filter((id) => !removeSet.has(String(id)));
      }
    }

    await project.save();
    res.json(await project.populate("properties"));
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/projects/:id  (protected) ──────────────────────────────────
// Deletes the project record only — properties themselves are left untouched.
// Pass ?deleteProperties=true to also hard-delete all linked properties.
async function deleteProject(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.coverImage) await deleteImagesFromR2([project.coverImage]);

    if (req.query.deleteProperties === "true") {
      // Cascade: delete every property that belongs to this project
      const { deleteImagesFromR2: delImg, deleteVideosFromR2: delVid } = require("../config/r2");
      const props = await Property.find({ _id: { $in: project.properties } });
      await Promise.all(
        props.map(async (p) => {
          await delImg(p.images);
          await delVid(p.videos);
          await p.deleteOne();
        })
      );
    }

    await project.deleteOne();
    res.json({ message: "Project deleted" });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/projects/stats  (public) ──────────────────────────────────────
// Returns per-city counts — useful for a "Browse by city" widget
async function getProjectCityStats(req, res, next) {
  try {
    const stats = await Project.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          image: { $first: "$coverImage" },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          city: "$_id",
          count: 1,
          image: { $ifNull: ["$image", ""] },
        },
      },
    ]);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectCityStats,
};