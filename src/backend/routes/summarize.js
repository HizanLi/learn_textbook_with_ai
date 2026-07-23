const express = require("express");
const { readDataUserFile, writeDataUserJson } = require("../services/storage");
const { mockKeypoints } = require("../services/mock");

const router = express.Router();

router.get("/summarize", (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  const markdown = readDataUserFile(username, "latest.md") || "# Overview\n\n## Summary";
  const sections = mockKeypoints(markdown);
  writeDataUserJson(username, "latest_keypoints.json", sections);

  res.json({ sections });
});

module.exports = router;
