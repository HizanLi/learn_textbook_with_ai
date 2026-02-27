const express = require("express");
const {
  processProjectWithPython,
  getProjectProcessingStatus,
} = require("../services/processor");

const router = express.Router();

// Check and/or process a project
router.post("/process-project", async (req, res) => {
  try {
    const { username, projectId } = req.body;

    if (!username || !projectId) {
      return res
        .status(400)
        .json({ error: "username and projectId are required" });
    }

    // Get current status
    const currentStatus = getProjectProcessingStatus(username, projectId);

    if (!currentStatus) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If already processing, return current status
    if (currentStatus.status === "processing") {
      return res.json({
        status: currentStatus.status,
        message: "Project is currently being processed",
        project: currentStatus,
      });
    }

    // If already completed, return success
    if (currentStatus.status === "completed") {
      return res.json({
        status: currentStatus.status,
        message: "Project already processed",
        project: currentStatus,
      });
    }

    // If failed before, attempt reprocessing
    if (currentStatus.status === "failed" || currentStatus.status === "uploaded") {
      // Start processing
      const result = await processProjectWithPython(username, projectId);

      if (result.success) {
        res.json({
          status: "completed",
          message: result.message,
          project: result.project,
        });
      } else if (result.pythonUnavailable) {
        // Python server is not available - return 503 Service Unavailable
        res.status(503).json({
          status: "failed",
          error: result.message,
          errorType: "python_unavailable",
          project: result.project,
        });
      } else {
        res.status(500).json({
          status: "failed",
          error: result.message,
          errorType: "processing_error",
          project: result.project,
        });
      }
    }
  } catch (err) {
    console.error("[PROCESS-PROJECT ERROR]", err);
    res.status(500).json({ error: "Processing failed: " + err.message });
  }
});

// Get processing status
router.get("/project-status", (req, res) => {
  try {
    const { username, projectId } = req.query;

    if (!username || !projectId) {
      return res
        .status(400)
        .json({ error: "username and projectId are required" });
    }

    const status = getProjectProcessingStatus(username, projectId);

    if (!status) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(status);
  } catch (err) {
    console.error("[PROJECT-STATUS ERROR]", err);
    res.status(500).json({ error: "Failed to get status: " + err.message });
  }
});

module.exports = router;
