const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

// ── Images ────────────────────────────────────────────────────────────────────

async function uploadImageToR2(file) {
  const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
  const key = `properties/images/${crypto.randomUUID()}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `${PUBLIC_URL}/${key}`;
}

async function uploadImagesToR2(files = []) {
  return Promise.all(files.map(uploadImageToR2));
}

async function deleteImageFromR2(url) {
  if (!url || !url.startsWith(PUBLIC_URL)) return;
  const key = url.replace(`${PUBLIC_URL}/`, "");

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error(`Failed to delete R2 image ${key}:`, err.message);
  }
}

async function deleteImagesFromR2(urls = []) {
  await Promise.all(urls.map(deleteImageFromR2));
}

// ── Videos ────────────────────────────────────────────────────────────────────

async function uploadVideoToR2(file) {
  const ext = (file.originalname.split(".").pop() || "mp4").toLowerCase();
  const key = `properties/videos/${crypto.randomUUID()}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `${PUBLIC_URL}/${key}`;
}

async function uploadVideosToR2(files = []) {
  return Promise.all(files.map(uploadVideoToR2));
}

async function deleteVideoFromR2(url) {
  if (!url || !url.startsWith(PUBLIC_URL)) return;
  const key = url.replace(`${PUBLIC_URL}/`, "");

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error(`Failed to delete R2 video ${key}:`, err.message);
  }
}

async function deleteVideosFromR2(urls = []) {
  await Promise.all(urls.map(deleteVideoFromR2));
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  r2,
  uploadImageToR2,
  uploadImagesToR2,
  deleteImageFromR2,
  deleteImagesFromR2,
  uploadVideoToR2,
  uploadVideosToR2,
  deleteVideoFromR2,
  deleteVideosFromR2,
};