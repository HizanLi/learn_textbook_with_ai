const express = require("express");
const multer = require("multer");
const path = require("path");

const { writeUserFile, writeUserJson } = require("../services/storage");
const { mockMarkdown } = require("../services/mock");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), (req, res) => {
  const username = req.body.username;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "file is required" });
  }

  const ext = path.extname(req.file.originalname) || ".bin";
  const filename = `upload-${Date.now()}${ext}`;
  writeUserFile(username, filename, req.file.buffer);

  const markdown = mockMarkdown(req.file.originalname);
  writeUserFile(username, "latest.md", Buffer.from(markdown, "utf-8"));
  writeUserJson(username, "latest_upload.json", {
    originalName: req.file.originalname,
    storedName: filename,
    uploadedAt: new Date().toISOString(),
  });

  res.json({ markdown });
});

module.exports = router;