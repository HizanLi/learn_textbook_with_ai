const express = require("express");
const multer = require("multer");

const {
  writeDataUserFile,
  writeDataUserJson,
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

    const filename = req.file.originalname;
    
    console.log(`[UPLOAD] User: ${username}, File: ${filename}, Size: ${req.file.size} bytes`);
    
    // Store the original upload in data/<user>/input
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
