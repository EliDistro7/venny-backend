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

/**
 * Uploads a single in-memory file (from multer) to the R2 bucket
 * and returns its public URL.
 */
async function uploadImageToR2(file) {
  const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
  const key = `properties/${crypto.randomUUID()}.${ext}`;

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

/**
 * Uploads multiple files in parallel, returns array of public URLs.
 */
async function uploadImagesToR2(files = []) {
  return Promise.all(files.map(uploadImageToR2));
}

/**
 * Deletes an image from R2 given its full public URL.
 * Silently no-ops if the URL doesn't belong to this bucket's public base.
 */
async function deleteImageFromR2(url) {
  if (!url || !url.startsWith(PUBLIC_URL)) return;
  const key = url.replace(`${PUBLIC_URL}/`, "");

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error(`Failed to delete R2 object ${key}:`, err.message);
  }
}

async function deleteImagesFromR2(urls = []) {
  await Promise.all(urls.map(deleteImageFromR2));
}

module.exports = {
  r2,
  uploadImageToR2,
  uploadImagesToR2,
  deleteImageFromR2,
  deleteImagesFromR2,
};
