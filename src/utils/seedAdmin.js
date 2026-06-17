const Admin = require("../models/Admin");

/**
 * Ensures exactly one admin exists in the database. On a fresh database
 * this creates it from ADMIN_EMAIL / ADMIN_PASSWORD in .env. If an admin
 * already exists, this does nothing (so changing .env later won't reset
 * a password you've since changed via the dashboard, if that's added later).
 */
async function seedAdmin() {
  const existing = await Admin.countDocuments();

  if (existing > 0) {
    console.log("Admin already present, skipping seed.");
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — no admin was created. " +
        "Set them and restart the server to seed the first admin."
    );
    return;
  }

  await Admin.create({ email, password, name: "Admin" });
  console.log(`Seeded initial admin account: ${email}`);
}

module.exports = seedAdmin;
