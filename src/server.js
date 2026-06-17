require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const seedAdmin = require("./utils/seedAdmin");

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`NyumbaTZ API running on http://localhost:${PORT}`);
  });
})();
