const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes      = require("./routes/authRoutes");
const propertyRoutes  = require("./routes/propertyRoutes");
const contentRoutes   = require("./routes/contentRoutes");
const portfolioRoutes = require("./routes/portfolioRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_2,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth",       authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/content",    contentRoutes);
app.use("/api/portfolio",  portfolioRoutes);
app.use("/api/admin/auth", adminAuthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;