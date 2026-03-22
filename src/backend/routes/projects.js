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

router.get("/project-processing-steps", (req, res) => {
  const { username, projectName } = req.query;

  if (!username || !projectName) {
    return res
      .status(400)
      .json({ error: "username and projectName are required" });
  }

  const safeUsername = String(username).trim();
  const safeProjectName = String(projectName).trim();
  const noExtProjectName = safeProjectName.replace(/\.[^/.]+$/, "");

  const outputDir = path.join(DATA_DIR, safeUsername, "output");
  const projectOutputDir = path.join(outputDir, noExtProjectName, "hybrid_auto");

  const steps = {
    step1: {
      name: "PDF to Markdown",
      complete: false,
    },
    step2: {
      name: "Markdown to JSON",
      complete: false,
    },
    step3: {
      name: "Generate Summary",
      complete: false,
    },
  };

  if (!fs.existsSync(projectOutputDir)) {
    return res.json(steps);
  }

  try {
    const files = fs.readdirSync(projectOutputDir);

    // Check step 1: markdown file exists
    const mdFile = files.find(
      (f) => f.toLowerCase().endsWith(".md")
    );
    if (mdFile) {
      steps.step1.complete = true;
    }

    // Check step 2: chunker_step_1.json and textbook_toc.json exist
    const hasChunkerStep1 = files.includes("chunker_step_1.json");
    const hasTocJson = files.includes("textbook_toc.json");
    if (hasChunkerStep1 && hasTocJson) {
      steps.step2.complete = true;
    }

    // Check step 3: textbook_with_content.json exists with content
    const tocPath = path.join(projectOutputDir, "textbook_with_content.json");
    if (fs.existsSync(tocPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(tocPath, "utf-8"));
        const chapters = content?.chapters || [];
        const lastChapter = chapters[chapters.length - 1];
        const lastSection = lastChapter?.sections?.[lastChapter.sections.length - 1];
        if (lastSection?.content) {
          steps.step3.complete = true;
        }
      } catch (err) {
        console.error(`Failed to parse textbook_with_content.json: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(
      `Error checking processing steps for ${safeUsername}/${safeProjectName}: ${err.message}`
    );
  }

  res.json(steps);
});

router.post("/trigger-processing-step", async (req, res) => {
  const { username, projectName, step } = req.body;

  if (!username || !projectName || !step) {
    return res
      .status(400)
      .json({ error: "username, projectName, and step are required" });
  }

  const safeUsername = String(username).trim();
  const safeProjectName = String(projectName).trim();
  const safeStep = String(step).trim();

  const noExtProjectName = safeProjectName.replace(/\.[^/.]+$/, "");

  const CORE_API = process.env.CORE_API || "http://127.0.0.1:8080";

  try {
    if (safeStep === "step1") {
      // Trigger Step 1: PDF to Markdown (MinerU)
      const response = await fetch(`${CORE_API}/api/mineru/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: safeUsername,
          file_name: `${noExtProjectName}.pdf`,
          description: `Processing PDF file for ${noExtProjectName}`,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to process PDF");
      }

      return res.json({
        status: "completed",
        message: "Step 1 (PDF to Markdown) processing completed",
        data: result.data,
      });
    } else if (safeStep === "step2") {
      // Trigger Step 2: Markdown to JSON (Chunking)
      const response = await fetch(`${CORE_API}/api/chunker/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: safeUsername,
          file_name: `${noExtProjectName}.md`,
          output_filename: "chunks.json",
          description: `Chunking markdown for ${noExtProjectName}`,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to chunk markdown");
      }

      return res.json({
        status: "completed",
        message: "Step 2 (Markdown to JSON) processing completed",
        data: result.data,
      });
    } else if (safeStep === "step3") {
      // Trigger Step 3: Generate Summary (LLM Analysis)
      const response = await fetch(`${CORE_API}/api/analyze/textbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: safeUsername,
          project_name: noExtProjectName,
          description: `Analyzing textbook content for ${noExtProjectName}`,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.detail || "Failed to analyze textbook");
      }

      return res.json({
        status: "completed",
        message: "Step 3 (Generate Summary) processing completed",
        data: result.data,
      });
    } else {
      return res
        .status(400)
        .json({ error: "Invalid step. Must be step1, step2, or step3." });
    }
  } catch (err) {
    console.error(
      `Error triggering ${safeStep} for ${safeUsername}/${safeProjectName}: ${err.message}`
    );
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
