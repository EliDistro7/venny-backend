const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

/**
 * Verifies the Bearer token in the Authorization header and attaches
 * the matching admin document to req.admin. Rejects with 401 otherwise.
 */
async function protect(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({ message: "Not authorized, admin no longer exists" });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid or expired token" });
  }
}

module.exports = { protect };
