const express = require("express");
const fs = require("fs");
const {
  ensureUserDir,
  readUserStatus,
  setCurrentProject,
  findTextbookWithContent,
  writeUserStatus,
} = require("../services/storage");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username is required" });
  }

  const userDir = ensureUserDir(username);
  const status = readUserStatus(username) || {
    uploadedProjects: [],
    currentProject: null,
  };
  return res.json({ username, userDir, status });
});

router.get("/user-status", (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  const status = readUserStatus(username) || {
    uploadedProjects: [],
    currentProject: null,
  };

  return res.json(status);
});

router.post("/set-current-project", (req, res) => {
  const { username, projectId } = req.body;
  if (!username || !projectId) {
    return res
      .status(400)
      .json({ error: "username and projectId are required" });
  }

  const status = setCurrentProject(username, projectId);
  return res.json(status);
});

router.post("/select-project", (req, res) => {
  const { username, projectName } = req.body || {};
  if (!username || !projectName) {
    return res
      .status(400)
      .json({ error: "username and projectName are required" });
  }

  const status = readUserStatus(username) || {
    uploadedProjects: [],
    currentProject: null,
  };

  const normalized = String(projectName).trim();
  const noExt = normalized.replace(/\.[^/.]+$/, "");
  const matchedProject = (status.uploadedProjects || []).find((p) => {
    const fileName = String(p.filename || "").trim();
    const originalName = String(p.originalName || "").trim();
    const fileNameNoExt = fileName.replace(/\.[^/.]+$/, "");
    const originalNameNoExt = originalName.replace(/\.[^/.]+$/, "");

    return (
      normalized === fileName ||
      normalized === originalName ||
      noExt === fileNameNoExt ||
      noExt === originalNameNoExt
    );
  });

  if (matchedProject) {
    status.currentProject = matchedProject.id;
    writeUserStatus(username, status);
  }

  const lookupName = matchedProject?.filename || matchedProject?.originalName || normalized;
  const result = findTextbookWithContent(username, lookupName);
  let textbookWithContentData = null;

  if (result.found && result.path) {
    try {
      const raw = fs.readFileSync(result.path, "utf-8");
      textbookWithContentData = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Failed to read textbook_with_content.json: ${err.message}`,
        textbookWithContent: {
          found: true,
          path: result.path,
          searchedPaths: result.searchedPaths,
          content: null,
        },
      });
    }
  }

  if (matchedProject && result.found) {
    matchedProject.status = "completed";
    if (matchedProject.error) {
      delete matchedProject.error;
    }
    writeUserStatus(username, status);
  }

  return res.json({
    success: true,
    currentProject: status.currentProject,
    project: matchedProject || null,
    textbookWithContent: {
      found: result.found,
      path: result.path,
      searchedPaths: result.searchedPaths,
      content: textbookWithContentData,
    },
  });
});

module.exports = router;