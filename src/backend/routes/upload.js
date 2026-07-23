const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  writeDataUserFile,
  writeDataUserJson,
  writeDataInputFile,
  addUploadedProject,
  readUserStatus,
  writeUserStatus,
} = require("../services/storage");
const { mockMarkdown } = require("../services/mock");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function requestPdfPreparation(username, filename) {
  try {
    const coreApi = process.env.CORE_API || "http://127.0.0.1:8080";
    const response = await fetch(`${coreApi}/api/mineru/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, file_name: filename }),
      signal: AbortSignal.timeout(30000),
    });
    const responseType = response.headers.get("content-type") || "";
    const payload = responseType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      return {
        success: false,
        error: payload?.detail || payload?.error || "PDF preparation failed",
      };
    }
    return payload;
  } catch (error) {
    return { success: false, error: error.message || "PDF preparation failed" };
  }
}

function savePreparationStatus(username, projectId, preparation) {
  const status = readUserStatus(username);
  const project = status?.uploadedProjects?.find((item) => item.id === projectId);
  if (!project) {
    return status;
  }

  project.splitPreparation = {
    status: preparation?.success === false
      ? "failed"
      : preparation?.data?.split
        ? "split_ready"
        : "not_required",
    pageCount: preparation?.data?.page_count ?? null,
    partCount: preparation?.data?.part_count ?? null,
    error: preparation?.success === false ? preparation.error : null,
    updatedAt: new Date().toISOString(),
  };
  writeUserStatus(username, status);
  return status;
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const username = req.body.username;
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }

    // Check for duplicated filename in user_status.json
    const userStatus = readUserStatus(username);
    if (userStatus && userStatus.uploadedProjects) {
      const isDuplicate = userStatus.uploadedProjects.some(
        (p) => p.originalName === req.file.originalname
      );
      if (isDuplicate) {
        return res.status(400).json({ error: "duplicated file" });
      }
    }

    const filename = path.basename(req.file.originalname);
    
    console.log(`[UPLOAD] User: ${username}, File: ${filename}, Size: ${req.file.size} bytes`);
    
    // Keep all artifacts for one upload together under data/<user>/input/<project-name>/.
    writeDataInputFile(username, filename, req.file.buffer);

    // Keep lightweight app state beside the user data root.
    const markdown = mockMarkdown(req.file.originalname);
    writeDataUserFile(username, "latest.md", Buffer.from(markdown, "utf-8"));
    writeDataUserJson(username, "latest_upload.json", {
      originalName: req.file.originalname,
      storedName: filename,
      uploadedAt: new Date().toISOString(),
    });

    // Add to user's uploaded projects and update user_status.json
    const project = addUploadedProject(username, filename, req.file.originalname);
    const preparation = await requestPdfPreparation(username, filename);
    const status = savePreparationStatus(username, project.id, preparation);

    res.json({
      markdown,
      project,
      status,
      preparation,
    });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

router.post("/prepare-project-pdf", async (req, res) => {
  const { username, projectId } = req.body || {};
  if (!username || !projectId) {
    return res.status(400).json({ error: "username and projectId are required" });
  }

  const status = readUserStatus(username);
  const project = status?.uploadedProjects?.find((item) => item.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const filename = project.filename || project.originalName;
  const preparation = await requestPdfPreparation(username, filename);
  const updatedStatus = savePreparationStatus(username, projectId, preparation);
  return res.json({
    success: preparation?.success !== false,
    preparation,
    status: updatedStatus,
  });
});

module.exports = router;
