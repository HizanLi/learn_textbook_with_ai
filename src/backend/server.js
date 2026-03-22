const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const processRoutes = require("./routes/process");
const summarizeRoutes = require("./routes/summarize");
const explainRoutes = require("./routes/explain");
const llmRoutes = require("./routes/llm");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", async (req, res) => {
  const CORE_API = process.env.CORE_API || "http://127.0.0.1:8080";
  let coreStatus = "unknown";
  let minerUStatus = "unknown";
  
  try {
    const response = await fetch(`${CORE_API}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      coreStatus = data.status || "healthy";
      // MinerU status comes from the core service's health check
      if (data.services && data.services.mineru) {
        // Normalizing: MinerU returns "ready", "unavailable", or "error"
        minerUStatus = data.services.mineru.status || "unknown";
      }
    } else {
      coreStatus = "unhealthy";
      minerUStatus = "unhealthy";
    }
  } catch (err) {
    console.error("Health check error:", err);
    coreStatus = "unavailable";
    minerUStatus = "unavailable";
  }

  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    services: {
      backend: "healthy",
      core: coreStatus,
      minerU: minerUStatus
    }
  });
});

app.use("/api", authRoutes);
app.use("/api", uploadRoutes);
app.use("/api", processRoutes);
app.use("/api", summarizeRoutes);
app.use("/api", explainRoutes);
app.use("/api", llmRoutes);

const PORT = process.env.BACKEND_PORT || 4000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});