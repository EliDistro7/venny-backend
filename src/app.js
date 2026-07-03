const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes      = require("./routes/authRoutes");
const propertyRoutes  = require("./routes/propertyRoutes");
const contentRoutes   = require("./routes/contentRoutes");
const portfolioRoutes = require("./routes/portfolioRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const storyRoutes = require("./routes/storyRoutes"); 
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


app.use("/api/auth",       express.json(), authRoutes);
app.use("/api/properties", propertyRoutes);  // has its own multer handling
app.use("/api/content",    express.json(), contentRoutes);
app.use("/api/portfolio",  express.json(), portfolioRoutes);
app.use("/api/admin/auth", express.json(), adminAuthRoutes);
app.use("/api/stories",    storyRoutes);    

app.use(notFound);
app.use(errorHandler);

module.exports = app;