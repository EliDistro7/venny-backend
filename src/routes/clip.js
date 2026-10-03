const express  = require("express");
const { exec } = require("child_process");
const { mkdir, readdir, stat, unlink } = require("fs/promises");
const { existsSync, createReadStream, statSync } = require("fs");
const { promisify } = require("util");
const { randomUUID } = require("crypto");
const path = require("path");

const router    = express.Router();
const execAsync = promisify(exec);

// ─── config ───────────────────────────────────────────────────────────────────

const CLIPS_DIR = process.env.CLIPS_DIR ?? "/tmp/bss-clips";
const TTL_MS    = 30 * 60 * 1000; // 30 minutes
const MAX_CLIP_SECS = 3600;

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSeconds(t) {
  const trimmed = t.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function isYouTubeUrl(url) {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/.test(url);
}

async function pruneOldClips() {
  try {
    const files = await readdir(CLIPS_DIR);
    const now   = Date.now();
    for (const file of files) {
      const fp    = path.join(CLIPS_DIR, file);
      const stats = await stat(fp);
      if (now - stats.mtimeMs > TTL_MS) await unlink(fp);
    }
  } catch {
    // best-effort
  }
}

// ─── POST /api/clip/price ─────────────────────────────────────────────────────

router.post("/price", (req, res) => {
      if (!req.body) {
    return res.status(400).json({ error: "Request body missing or not JSON" });
  }
  const { start, end } = req.body;

  if (typeof start !== "string" || typeof end !== "string") {
    return res.status(400).json({ error: "start and end must be strings" });
  }

  const startSecs = toSeconds(start);
  const endSecs   = toSeconds(end);

  if (startSecs === null) return res.status(400).json({ error: `Cannot parse start time: "${start}"` });
  if (endSecs   === null) return res.status(400).json({ error: `Cannot parse end time: "${end}"` });
  if (endSecs <= startSecs) return res.status(400).json({ error: "end must be after start" });

  const durationSecs = endSecs - startSecs;
  if (durationSecs > MAX_CLIP_SECS) {
    return res.status(400).json({ error: `Maximum clip length is 60 minutes. Requested: ${durationSecs}s` });
  }

  const TIERS = [
    { upTo: 30,       rate: 3   },
    { upTo: 120,      rate: 2   },
    { upTo: Infinity, rate: 1.5 },
  ];

  const tier  = TIERS.find((t) => durationSecs <= t.upTo);
  const price = Math.max(Math.round(durationSecs * tier.rate), 10);
  const displayPrice = `$${(price / 100).toFixed(2)}`;

  const m = Math.floor(durationSecs / 60);
  const s = durationSecs % 60;
  const label = durationSecs < 60
    ? `${durationSecs}s clip`
    : s > 0 ? `${m}m ${s}s clip` : `${m}m clip`;

  return res.json({ durationSecs, price, displayPrice, label, startSecs, endSecs });
});

// ─── POST /api/clip/generate ──────────────────────────────────────────────────

router.post("/generate", async (req, res) => {
     if (!req.body) {
    return res.status(400).json({ error: "Request body missing or not JSON" });
  }
  const { url, start, end } = req.body;

  if (typeof url !== "string" || typeof start !== "string" || typeof end !== "string") {
    return res.status(400).json({ error: "url, start, end are required strings" });
  }

  if (!isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Only YouTube URLs are supported" });
  }

  const startSecs = toSeconds(start);
  const endSecs   = toSeconds(end);

  if (startSecs === null || endSecs === null || endSecs <= startSecs) {
    return res.status(400).json({ error: "Invalid time range" });
  }

  if (endSecs - startSecs > MAX_CLIP_SECS) {
    return res.status(400).json({ error: "Clip too long (max 60 minutes)" });
  }

  if (!existsSync(CLIPS_DIR)) await mkdir(CLIPS_DIR, { recursive: true });

  const fileId   = randomUUID();
  const filename = `clip-${fileId}.mp4`;
  const outPath  = path.join(CLIPS_DIR, filename);
  const section  = `*${formatTime(startSecs)}-${formatTime(endSecs)}`;

  const FORMAT = [
    "232+234", "231+234", "230+234", "229+234",
    "232+233", "best[protocol=m3u8_native]", "best",
  ].join("/");

const BGUTIL_URL = process.env.BGUTIL_BASE_URL ?? "http://127.0.0.1:4416";

const cmd = [
  "yt-dlp",
  "--download-sections", `"${section}"`,
  "--force-keyframes-at-cuts",
  "-f", `"${FORMAT}"`,
  "--no-playlist",
  "--merge-output-format", "mp4",
  "--extractor-args", "youtube:player_client=visionos",
  "--extractor-args", `"youtubepot-bgutilhttp:base_url=${BGUTIL_URL}"`,
  "-o", `"${outPath}"`,
  `"${url}"`,
].join(" ");


try {
  await execAsync(cmd, { timeout: 5 * 60 * 1000 });
} catch (err) {
  console.error("[clip/generate] yt-dlp error:", err.message);
  console.error("[clip/generate] stderr:", err.stderr);
  return res.status(500).json({ error: "Failed to download clip. The video may be unavailable or region-locked." });
}

  if (!existsSync(outPath)) {
    return res.status(500).json({ error: "Clip generation succeeded but output file not found." });
  }

  pruneOldClips();

  return res.json({
    fileId,
    filename: `clip-${formatTime(startSecs).replace(/:/g, "-")}_to_${formatTime(endSecs).replace(/:/g, "-")}.mp4`,
  });
});

// ─── GET /api/clip/download/:file ─────────────────────────────────────────────

const SAFE_FILENAME = /^clip-[0-9a-f-]{36}\.mp4$/i;

router.get("/download/:file", (req, res) => {
  const { file } = req.params;

  if (!SAFE_FILENAME.test(file)) {
    return res.status(400).json({ error: "Invalid file reference" });
  }

  const filePath = path.join(CLIPS_DIR, file);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found or expired. Clips are available for 30 minutes." });
  }

  const { size } = statSync(filePath);

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", size);
  res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
  res.setHeader("Cache-Control", "private, no-cache");

  createReadStream(filePath).pipe(res);
});

module.exports = router;