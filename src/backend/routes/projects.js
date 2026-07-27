const express = require("express");
const path = require("path");
const fs = require("fs");
const {
  DATA_DIR,
  readDataUserJson,
  readUserStatus,
  writeDataUserJson,
} = require("../services/storage");

const router = express.Router();

const PDF_PREFERENCES_FILE = "project_preferences.json";

function readProjectPdfPreference(username, projectId) {
  const preferences = readDataUserJson(username, PDF_PREFERENCES_FILE) || {};
  return preferences?.projects?.[projectId]?.pdf || null;
}

function saveProjectPdfPreference(username, projectId, preference) {
  const preferences = readDataUserJson(username, PDF_PREFERENCES_FILE) || {};
  preferences.projects = preferences.projects || {};
  preferences.projects[projectId] = preferences.projects[projectId] || {};
  preferences.projects[projectId].pdf = preference;
  writeDataUserJson(username, PDF_PREFERENCES_FILE, preferences);
  return preference;
}

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
  const safeFilename = path.basename(String(requestedFilename || "").trim());
  const projectName = safeFilename.replace(/\.[^/.]+$/, "");
  const nestedPath = path.join(inputDir, projectName, safeFilename);

  if (fs.existsSync(nestedPath)) {
    return nestedPath;
  }

  // Existing uploads used data/<user>/input/<filename>/<filename>.
  const legacyNestedPath = path.join(inputDir, safeFilename, safeFilename);
  if (fs.existsSync(legacyNestedPath)) {
    return legacyNestedPath;
  }

  // Existing uploads also used a flat data/<user>/input/<filename> structure.
  const legacyPath = path.join(inputDir, safeFilename);
  if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
    return legacyPath;
  }

  if (!fs.existsSync(inputDir)) {
    return null;
  }

  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  const target = normalizeFilename(safeFilename);
  const targetProject = normalizeFilename(projectName);
  const matched = entries.find((entry) => {
    const normalizedEntry = normalizeFilename(entry.name);
    return normalizedEntry === target || normalizedEntry === targetProject;
  });

  if (matched) {
    const candidatePath = path.join(inputDir, matched.name);
    if (matched.isDirectory()) {
      const nestedCandidate = path.join(candidatePath, safeFilename);
      if (fs.existsSync(nestedCandidate)) {
        return nestedCandidate;
      }
      const legacyNestedCandidate = path.join(candidatePath, matched.name);
      return fs.existsSync(legacyNestedCandidate) ? legacyNestedCandidate : null;
    }
    return matched.isFile() ? candidatePath : null;
  }

  const requestedExt = path.extname(safeFilename).toLowerCase();
  const candidateFiles = entries.filter((entry) => {
    const candidatePath = path.join(inputDir, entry.name);
    const isNestedPdf = entry.isDirectory() && (
      fs.existsSync(path.join(candidatePath, safeFilename)) ||
      fs.existsSync(path.join(candidatePath, entry.name))
    );
    if (!entry.isFile() && !isNestedPdf) return false;
    if (isNestedPdf) return true;
    if (!requestedExt) return true;
    return path.extname(entry.name).toLowerCase() === requestedExt;
  });

  let bestMatch = null;
  let bestDistance = Number.MAX_SAFE_INTEGER;

  for (const file of candidateFiles) {
    const dist = levenshteinDistance(target, normalizeFilename(file.name));
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = file.name;
    }
  }

  if (bestMatch && bestDistance <= 2) {
    const nestedCandidate = path.join(inputDir, bestMatch, safeFilename);
    if (fs.existsSync(nestedCandidate)) {
      return nestedCandidate;
    }
    const legacyNestedCandidate = path.join(inputDir, bestMatch, bestMatch);
    if (fs.existsSync(legacyNestedCandidate)) {
      return legacyNestedCandidate;
    }
    return path.join(inputDir, bestMatch);
  }

  return null;
}

function resolveProjectOutputDir(username, projectName) {
  const noExtProjectName = String(projectName || "").trim().replace(/\.[^/.]+$/, "");
  const primaryDir = path.join(DATA_DIR, username, "output", noExtProjectName, "hybrid_auto");
  if (fs.existsSync(primaryDir)) {
    return primaryDir;
  }

  // Backward-compatible fallback for misspelled folder names in old runs.
  const fallbackDir = path.join(DATA_DIR, username, "output", noExtProjectName, "hybird_auo");
  if (fs.existsSync(fallbackDir)) {
    return fallbackDir;
  }

  return primaryDir;
}

router.get("/project-markdown", (req, res) => {
  const { username, projectName } = req.query;

  if (!username || !projectName) {
    return res.status(400).json({ error: "username and projectName are required" });
  }

  const safeUsername = String(username).trim();
  const safeProjectName = String(projectName).trim();
  const noExtProjectName = safeProjectName.replace(/\.[^/.]+$/, "");
  const projectOutputDir = resolveProjectOutputDir(safeUsername, noExtProjectName);
  const markdownPath = path.join(projectOutputDir, `${noExtProjectName}.md`);

  if (!fs.existsSync(markdownPath)) {
    return res.status(404).json({ error: `Markdown file not found: ${markdownPath}` });
  }

  try {
    const content = fs.readFileSync(markdownPath, "utf-8");
    return res.json({
      success: true,
      data: {
        markdownPath,
        content,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to read markdown: ${err.message}` });
  }
});

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

function getProjectTocPath(username, projectName) {
  return path.join(
    resolveProjectOutputDir(username, projectName),
    "textbook_toc.json"
  );
}

function getProjectTocSourcePath(username, projectName) {
  return path.join(
    resolveProjectOutputDir(username, projectName),
    "toc_source.txt"
  );
}

function getTocGeneratedFilePaths(projectOutputDir) {
  return [
    "textbook_toc.json",
    "textbook_with_content.json",
    "chunker_step_1.json",
  ].map((filename) => {
    const filePath = path.join(projectOutputDir, filename);
    if (!fs.existsSync(filePath)) {
      return {
        filename,
        path: filePath,
        exists: false,
      };
    }

    const stat = fs.statSync(filePath);
    return {
      filename,
      path: filePath,
      exists: true,
      inode: stat.ino,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      changedAt: stat.ctime.toISOString(),
    };
  });
}

async function parseProjectTocWithCore(username, projectName, tocString) {
  const safeUsername = String(username).trim();
  const noExtProjectName = String(projectName).trim().replace(/\.[^/.]+$/, "");
  const CORE_API = process.env.CORE_API || "http://127.0.0.1:8080";

  const chunkerResponse = await fetch(`${CORE_API}/api/chunker/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: safeUsername,
      file_name: `${noExtProjectName}.md`,
      output_filename: "chunker_step_1.json",
      description: `Chunking markdown for ${noExtProjectName}`,
    }),
  });
  const chunkerResult = await chunkerResponse.json();
  if (!chunkerResponse.ok) {
    throw new Error(chunkerResult.detail || chunkerResult.message || "Failed to process chunker step");
  }

  const tocResponse = await fetch(`${CORE_API}/api/analyze/parse-toc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: safeUsername,
      project_name: noExtProjectName,
      filename: noExtProjectName,
      toc_string: tocString,
      save_to_disk: true,
    }),
  });
  const tocResult = await tocResponse.json();
  if (!tocResponse.ok) {
    throw new Error(tocResult.detail || tocResult.message || "Failed to parse table of content");
  }

  return {
    chunker: chunkerResult.data,
    toc: tocResult.data,
  };
}

router.get("/project-toc", (req, res) => {
  const { username, projectName } = req.query;
  if (!username || !projectName) {
    return res.status(400).json({ error: "username and projectName are required" });
  }

  const tocPath = getProjectTocPath(String(username).trim(), String(projectName).trim());
  if (!fs.existsSync(tocPath)) {
    return res.status(404).json({ error: "textbook_toc.json not found" });
  }

  try {
    const toc = JSON.parse(fs.readFileSync(tocPath, "utf-8"));
    return res.json({ success: true, data: toc });
  } catch (err) {
    return res.status(500).json({ error: `Failed to read textbook_toc.json: ${err.message}` });
  }
});

router.get("/project-pdf-preferences", (req, res) => {
  const { username, projectId } = req.query;
  if (!username || !projectId) {
    return res.status(400).json({ error: "username and projectId are required" });
  }

  const preference = readProjectPdfPreference(
    String(username).trim(),
    String(projectId).trim()
  );
  return res.json({ success: true, data: preference });
});

router.post("/project-pdf-preferences", (req, res) => {
  const { username, projectId, pageOffset, lastPage } = req.body || {};
  if (!username || !projectId) {
    return res.status(400).json({ error: "username and projectId are required" });
  }

  const parsedOffset = Number(pageOffset);
  const parsedLastPage = Number(lastPage);
  if (!Number.isInteger(parsedOffset) || !Number.isInteger(parsedLastPage) || parsedLastPage < 1) {
    return res.status(400).json({ error: "pageOffset must be an integer and lastPage must be positive" });
  }

  const preference = saveProjectPdfPreference(
    String(username).trim(),
    String(projectId).trim(),
    {
      pageOffset: parsedOffset,
      lastPage: parsedLastPage,
      updatedAt: new Date().toISOString(),
    }
  );
  return res.json({ success: true, data: preference });
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
  const projectOutputDir = resolveProjectOutputDir(safeUsername, noExtProjectName);

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

    // Check step 3: textbook_with_content.json exists with key_topics_analysis
    const tocPath = path.join(projectOutputDir, "textbook_with_content.json");
    if (fs.existsSync(tocPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(tocPath, "utf-8"));
        const chapters = content?.chapters || [];
        const lastChapter = chapters[chapters.length - 1];
        const lastSection = lastChapter?.sections?.[lastChapter.sections.length - 1];
        console.log(`lastSection: ${lastSection}`);

        // Step 3 is complete only when the final node has an explicit key_topics_analysis key.
        const lastSubsection =
          lastSection?.sub_sections?.[lastSection.sub_sections.length - 1];
        const terminalNode = lastSubsection || lastSection;
        const hasKeyTopicsAnalysis =
          !!terminalNode &&
          Object.prototype.hasOwnProperty.call(terminalNode, "key_topics_analysis");

        if (hasKeyTopicsAnalysis) {
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

router.get("/project-processing-progress", async (req, res) => {
  const { username, projectName } = req.query;

  if (!username || !projectName) {
    return res
      .status(400)
      .json({ error: "username and projectName are required" });
  }

  const CORE_API = process.env.CORE_API || "http://127.0.0.1:8080";
  const params = new URLSearchParams({
    username: String(username).trim(),
    project_name: String(projectName).trim().replace(/\.[^/.]+$/, ""),
  });

  try {
    const response = await fetch(`${CORE_API}/api/analyze/progress?${params}`);
    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error(`Error fetching analysis progress: ${err.message}`);
    return res.status(502).json({ error: "Failed to fetch analysis progress" });
  }
});

router.post("/retry-section-analysis", async (req, res) => {
  const {
    username,
    projectName,
    chapterNumber,
    sectionId,
    subSectionId,
  } = req.body || {};

  if (!username || !projectName || !sectionId) {
    return res.status(400).json({
      error: "username, projectName, and sectionId are required",
    });
  }

  const safeUsername = String(username).trim();
  const noExtProjectName = String(projectName).trim().replace(/\.[^/.]+$/, "");
  const CORE_API = process.env.CORE_API || "http://127.0.0.1:8080";
  const parsedChapterNumber = Number(chapterNumber);

  try {
    const response = await fetch(`${CORE_API}/api/analyze/retry-section`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: safeUsername,
        project_name: noExtProjectName,
        chapter_number: Number.isFinite(parsedChapterNumber) ? parsedChapterNumber : null,
        section_id: String(sectionId),
        sub_section_id: subSectionId ? String(subSectionId) : null,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: result.detail || result.message || "Failed to regenerate section analysis",
      });
    }

    return res.json(result);
  } catch (err) {
    console.error(`Error retrying section analysis for ${safeUsername}/${noExtProjectName}: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
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
        throw new Error(result.detail || result.message || "Failed to process PDF");
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

router.post("/parse-project-toc", async (req, res) => {
  const { username, projectName, tocString } = req.body;

  if (!username || !projectName || !tocString) {
    return res.status(400).json({ error: "username, projectName, and tocString are required" });
  }

  const safeUsername = String(username).trim();
  const safeProjectName = String(projectName).trim();

  try {
    const data = await parseProjectTocWithCore(safeUsername, safeProjectName, tocString);
    const sourcePath = getProjectTocSourcePath(safeUsername, safeProjectName);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, tocString, "utf-8");

    return res.json({
      success: true,
      message: "Step 2 completed: chunker and TOC parsing finished",
      data,
    });
  } catch (err) {
    console.error(`Error parsing TOC for ${safeUsername}/${safeProjectName}: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/retry-project-toc", async (req, res) => {
  const { username, projectName, tocString } = req.body || {};
  if (!username || !projectName) {
    return res.status(400).json({ error: "username and projectName are required" });
  }

  const safeUsername = String(username).trim();
  const safeProjectName = String(projectName).trim();
  const projectOutputDir = resolveProjectOutputDir(safeUsername, safeProjectName);
  const sourcePath = getProjectTocSourcePath(safeUsername, safeProjectName);
  const tocPath = getProjectTocPath(safeUsername, safeProjectName);

  if (!fs.existsSync(projectOutputDir)) {
    return res.status(404).json({
      error: `Project output folder not found: ${projectOutputDir}`,
    });
  }

  const sourceToc = typeof tocString === "string" && tocString.trim()
    ? tocString.trim()
    : fs.existsSync(sourcePath)
      ? fs.readFileSync(sourcePath, "utf-8")
      : fs.existsSync(tocPath)
        ? fs.readFileSync(tocPath, "utf-8")
        : "";

  if (!sourceToc) {
    return res.status(400).json({
      error: "No saved TOC source is available. Please submit the textbook TOC again.",
    });
  }

  const beforeFiles = getTocGeneratedFilePaths(projectOutputDir);
  const deletedFiles = [];
  const missingFiles = [];
  for (const filename of beforeFiles.map((file) => file.filename)) {
    const filePath = path.join(projectOutputDir, filename);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
      deletedFiles.push(filePath);
    } else {
      missingFiles.push(filePath);
    }
  }

  console.log(
    `Retrying TOC for ${safeUsername}/${safeProjectName}. Deleted ${deletedFiles.length} files from ${projectOutputDir}`
  );

  try {
    const data = await parseProjectTocWithCore(safeUsername, safeProjectName, sourceToc);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, sourceToc, "utf-8");

    return res.json({
      success: true,
      message: "TOC files were deleted and regenerated",
      deletedFiles,
      missingFiles,
      beforeFiles,
      afterFiles: getTocGeneratedFilePaths(projectOutputDir),
      outputDir: projectOutputDir,
      data,
    });
  } catch (err) {
    console.error(`Error retrying TOC for ${safeUsername}/${safeProjectName}: ${err.message}`);
    return res.status(500).json({
      error: err.message,
      deletedFiles,
      missingFiles,
      beforeFiles,
      afterFiles: getTocGeneratedFilePaths(projectOutputDir),
      outputDir: projectOutputDir,
    });
  }
});

module.exports = router;
