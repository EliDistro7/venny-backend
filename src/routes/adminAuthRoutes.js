

const express = require("express");
const router = express.Router();

const { login, me } = require("../controllers/adminAuthController");
const { protectAdmin } = require("../middleware/protectAdmin");

router.post("/login", login);
router.get("/me", protectAdmin, me);

module.exports = router;