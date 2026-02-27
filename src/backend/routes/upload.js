const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  writeUserFile,
  writeUserJson,
  writeDataInputFile,
  addUploadedProject,
  readUserStatus,
} = require("../services/storage");
const { mockMarkdown } = require("../services/mock");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), (req, res) => {
  try {
    const username = req.body.username;
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }

    const ext = path.extname(req.file.originalname) || ".bin";
    const filename = `${req.file.originalname.replace(ext, "")}-${Date.now()}${ext}`;
    
    console.log(`[UPLOAD] User: ${username}, File: ${filename}, Size: ${req.file.size} bytes`);
    
    // Store in data/user/input directory
    writeDataInputFile(username, filename, req.file.buffer);

    // Also store in legacy users directory for backward compatibility
    writeUserFile(username, filename, req.file.buffer);

    // Generate markdown
    const markdown = mockMarkdown(req.file.originalname);
    writeUserFile(username, "latest.md", Buffer.from(markdown, "utf-8"));
    writeUserJson(username, "latest_upload.json", {
      originalName: req.file.originalname,
      storedName: filename,
      uploadedAt: new Date().toISOString(),
    });

    // Add to user's uploaded projects and update user_status.json
    const project = addUploadedProject(username, filename, req.file.originalname);

    res.json({
      markdown,
      project,
      status: readUserStatus(username),
    });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

module.exports = router;