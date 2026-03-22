const express = require("express");
const path = require("path");
const fs = require("fs");
const { DATA_DIR, readUserStatus } = require("../services/storage");

const router = express.Router();

function normalizeFilename(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function resolvePdfPath(username, requestedFilename) {
  const inputDir = path.join(DATA_DIR, username, "input");
  const directPath = path.join(inputDir, requestedFilename);

  if (fs.existsSync(directPath)) {
    return directPath;
  }

  if (!fs.existsSync(inputDir)) {
    return null;
  }

  const files = fs.readdirSync(inputDir);
  const target = normalizeFilename(requestedFilename);
  const matched = files.find((file) => normalizeFilename(file) === target);

  if (matched) {
    return path.join(inputDir, matched);
  }

  const requestedExt = path.extname(requestedFilename || "").toLowerCase();
  const candidateFiles = files.filter((file) => {
    if (!requestedExt) return true;
    return path.extname(file).toLowerCase() === requestedExt;
  });

  let bestMatch = null;
  let bestDistance = Number.MAX_SAFE_INTEGER;

  for (const file of candidateFiles) {
    const dist = levenshteinDistance(target, normalizeFilename(file));
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = file;
    }
  }

  if (bestMatch && bestDistance <= 2) {
    return path.join(inputDir, bestMatch);
  }

  return null;
}

router.get("/project-pdf", (req, res) => {
  const { username, filename, projectId } = req.query;

  if (!username || (!filename && !projectId)) {
    return res
      .status(400)
      .json({ error: "username and filename are required" });
  }

  let resolvedFilename = filename;

  // Backward compatibility if caller still passes projectId
  if (!resolvedFilename && projectId) {
    const userStatus = readUserStatus(username);
    if (!userStatus || !userStatus.uploadedProjects) {
      return res.status(404).json({ error: "User or projects not found" });
    }

    const project = userStatus.uploadedProjects.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    resolvedFilename = project.filename || project.originalName;
  }

  const safeUsername = String(username).trim();
  const safeFilename = String(resolvedFilename).trim();
  const pdfPath = resolvePdfPath(safeUsername, safeFilename);

  console.log(
    `Serving PDF for user: ${safeUsername}, filename: ${safeFilename}, path: ${pdfPath || "NOT_FOUND"}`
  );

  if (!pdfPath) {
    return res.status(404).json({ error: "PDF file not found" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
  
  const fileStream = fs.createReadStream(pdfPath);
  fileStream.pipe(res);
});

module.exports = router;
