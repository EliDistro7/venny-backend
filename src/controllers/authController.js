const Admin = require("../models/Admin");
const generateToken = require("../utils/generateToken");

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      token: generateToken(admin._id),
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({
    id: req.admin._id,
    email: req.admin.email,
    name: req.admin.name,
  });
}

module.exports = { login, me };
