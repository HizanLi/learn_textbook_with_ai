require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const processRoutes = require("./routes/process");
const summarizeRoutes = require("./routes/summarize");
const explainRoutes = require("./routes/explain");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", authRoutes);
app.use("/api", uploadRoutes);
app.use("/api", processRoutes);
app.use("/api", summarizeRoutes);
app.use("/api", explainRoutes);

const PORT = process.env.BACKEND_PORT || 4000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});