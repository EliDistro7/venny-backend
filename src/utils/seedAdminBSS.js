/**
 * Seed an admin account.
 * Usage:
 *   node scripts/seedAdmin.js
 *
 * Reads from env (or falls back to defaults below).
 * Run once — safe to re-run: it upserts by email.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/AdminBSS");

const MONGO_URI = process.env.MONGO_URI;

const SEED = {
  name:     process.env.ADMINBSS_NAME     || "BSS Admin",
  email:    process.env.ADMINBSS_EMAIL    || "admin@bss.co.tz",
  password: process.env.ADMINBSS_PASSWORD || "ChangeMe123!",
};

async function seed() {
  if (!MONGO_URI) {
    console.error("❌  MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅  Connected to MongoDB");

  const existing = await Admin.findOne({ email: SEED.email });

  if (existing) {
    // Update password (re-hashing handled by pre-save hook)
    existing.name     = SEED.name;
    existing.password = SEED.password;
    await existing.save();
    console.log(`🔄  Admin updated: ${SEED.email}`);
  } else {
    await Admin.create(SEED);
    console.log(`🌱  Admin created: ${SEED.email}`);
  }

  await mongoose.disconnect();
  console.log("👋  Done");
}

seed().catch((err) => {
  console.error("Seeder error:", err.message);
  process.exit(1);
});