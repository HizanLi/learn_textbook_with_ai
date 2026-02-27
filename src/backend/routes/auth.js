const express = require("express");
const { ensureUserDir, readUserStatus, setCurrentProject } = require("../services/storage");

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

module.exports = router;