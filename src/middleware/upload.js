const multer = require("multer");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// Disk storage instead of memory: large video files are written straight
// to a temp directory as they arrive, instead of being buffered fully in
// RAM. Files are streamed from disk to R2 in the controller, then deleted.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed"), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB per file (videos need more room)
    files: 20,                    // allow up to 20 files total
  },
});

module.exports = upload;