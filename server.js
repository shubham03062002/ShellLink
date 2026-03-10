const express = require("express");
require("dotenv").config();
const cors = require("cors");

const systemRoutes = require("./routes/system");

const app = express();

const APP_SECRET = process.env.APP_SECRET;

/* CORS */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-SSH-Config",
    "X-ShellLink-Key"
  ]
}));

app.use(express.json());

/* Secret header validation middleware */

app.use((req, res, next) => {

  const key = req.headers["x-shelllink-key"];

  if (key !== APP_SECRET) {
    return res.status(403).json({
      error: "Unauthorized app access"
    });
  }

  next();

});

/* Routes */

app.use("/api", systemRoutes);

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});