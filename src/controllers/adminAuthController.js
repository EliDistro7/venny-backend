const jwt = require("jsonwebtoken");
const Admin = require("../models/AdminBSS");

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

/**
 * POST /api/admin/auth/login
 * Body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('no email or password')
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // Explicitly select password (it's excluded by default)
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password");

    if (!admin || !(await admin.matchPassword(password))) {
      console.log('there is no admin')
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(admin._id);

    console.log('succesfull login');

    res.json({
      success: true,
      token,
      admin: {
        id:    admin._id,
        name:  admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/auth/me
 * Returns the currently authenticated admin (token verified by middleware).
 */
async function me(req, res) {
  res.json({
    success: true,
    admin: {
      id:    req.admin._id,
      name:  req.admin.name,
      email: req.admin.email,
    },
  });
}

module.exports = { login, me };