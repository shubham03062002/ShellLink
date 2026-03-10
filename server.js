const express = require("express");
require("dotenv").config();
const cors = require("cors");

const systemRoutes = require("./routes/system");

const app = express();

const APP_SECRET = process.env.APP_SECRET;

/* CORS */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-SSH-Config",
    "X-ShellLink-Key"
  ]
}));

/* Handle preflight requests */
app.options("*", cors());

app.use(express.json());

/* Secret header validation middleware */

app.use((req, res, next) => {

  /* Skip validation for OPTIONS preflight */
  if (req.method === "OPTIONS") {
    return next();
  }

  const key = req.headers["x-shelllink-key"];

  if (!key || key !== APP_SECRET) {
    return res.status(403).json({
      error: "Unauthorized app access"
    });
  }

  next();

});

/* Routes */

app.use("/api", systemRoutes);

/* Health check route (useful for hosting platforms) */

app.get("/", (req, res) => {
  res.json({ status: "ShellLink backend running" });
});

/* Start server */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});