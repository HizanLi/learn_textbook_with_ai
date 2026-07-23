const fs = require("fs");
const path = require("path");

const BASE_DIR = path.resolve(__dirname, "..", "..", "..");
const DATA_DIR = path.join(BASE_DIR, "data");

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create directory ${dirPath}:`, err);
    throw err;
  }
}

function ensureDataDir() {
  ensureDir(DATA_DIR);
}

// All user-scoped runtime state lives under data/<user>.
function ensureDataUserDir(username) {
  ensureDataDir();
  const safeName = username.trim();
  const userDir = path.join(DATA_DIR, safeName);
  ensureDir(userDir);
  return userDir;
}

function ensureUserDir(username) {
  return ensureDataUserDir(username);
}

function ensureDataUserInputDir(username) {
  const userDir = ensureDataUserDir(username);
  const inputDir = path.join(userDir, "input");
  ensureDir(inputDir);
  return inputDir;
}

function getInputFilename(filename) {
  return path.basename(String(filename || "").trim());
}

function getInputProjectName(filename) {
  return getInputFilename(filename).replace(/\.[^/.]+$/, "");
}

function ensureDataUserProjectInputDir(username, filename) {
  const inputDir = ensureDataUserInputDir(username);
  const projectDir = path.join(inputDir, getInputProjectName(filename));
  ensureDir(projectDir);
  return projectDir;
}

function getDataInputFilePath(username, filename) {
  const safeFilename = getInputFilename(filename);
  return path.join(ensureDataUserProjectInputDir(username, safeFilename), safeFilename);
}

function writeDataUserFile(username, filename, buffer) {
  const userDir = ensureDataUserDir(username);
  const target = path.join(userDir, filename);
  fs.writeFileSync(target, buffer);
  return target;
}

function writeUserFile(username, filename, buffer) {
  return writeDataUserFile(username, filename, buffer);
}

function writeDataUserJson(username, filename, data) {
  const userDir = ensureDataUserDir(username);
  const target = path.join(userDir, filename);
  fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");
  return target;
}

function writeUserJson(username, filename, data) {
  return writeDataUserJson(username, filename, data);
}

function readDataUserFile(username, filename) {
  const userDir = ensureDataUserDir(username);
  const target = path.join(userDir, filename);
  if (!fs.existsSync(target)) {
    return null;
  }
  return fs.readFileSync(target, "utf-8");
}

function readUserFile(username, filename) {
  return readDataUserFile(username, filename);
}

function writeDataInputFile(username, filename, buffer) {
  try {
    const target = getDataInputFilePath(username, filename);
    fs.writeFileSync(target, buffer);
    console.log(`File saved to ${target}`);
    return target;
  } catch (err) {
    console.error(`Failed to save file for user ${username}:`, err);
    throw err;
  }
}

function readDataUserJson(username, filename) {
  try {
    const userDir = ensureDataUserDir(username);
    const target = path.join(userDir, filename);
    if (!fs.existsSync(target)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(target, "utf-8"));
  } catch (err) {
    console.error(`Failed to read JSON file ${filename}:`, err);
    return null;
  }
}

function readUserStatus(username) {
  try {
    return readDataUserJson(username, "user_status.json");
  } catch (err) {
    return null;
  }
}

function writeUserStatus(username, statusData) {
  return writeDataUserJson(username, "user_status.json", statusData);
}

function addUploadedProject(username, filename, originalName) {
  let status = readUserStatus(username) || {
    uploadedProjects: [],
    currentProject: null,
  };

  const createdAt = new Date().toISOString();
  const project = {
    id: `project-${Date.now()}`,
    filename: filename,
    originalName: originalName,
    remark: "",
    fileFormat: path.extname(originalName || filename).replace(".", "").toUpperCase() || "Unknown",
    createdAt,
    uploadedAt: createdAt,
    lastAccessedAt: null,
    status: "uploaded",
  };

  status.uploadedProjects.push(project);
  if (!status.currentProject) {
    status.currentProject = project.id;
  }

  writeUserStatus(username, status);
  return project;
}

function setCurrentProject(username, projectId) {
  let status = readUserStatus(username) || {
    uploadedProjects: [],
    currentProject: null,
  };
  status.currentProject = projectId;
  writeUserStatus(username, status);
  return status;
}

function findTextbookWithContent(username, projectName) {
  try {
    if (!username || !projectName) {
      return { found: false, path: null, searchedPaths: [] };
    }

    const subDirPatterns = ["hybrid_auto", "hybrid_ocr", "hybrid_txt"];
    const outputDir = path.join(DATA_DIR, username, "output");
    const safeProjectName = String(projectName).trim();
    const noExtProjectName = safeProjectName.replace(/\.[^/.]+$/, "");

    const candidateProjectDirs = Array.from(
      new Set([safeProjectName, noExtProjectName].filter(Boolean))
    );

    const searchedPaths = [];
    for (const candidateDir of candidateProjectDirs) {
      for (const subDir of subDirPatterns) {
        const candidatePath = path.join(
          outputDir,
          candidateDir,
          subDir,
          "textbook_with_content.json"
        );
        searchedPaths.push(candidatePath);
        if (fs.existsSync(candidatePath)) {
          return { found: true, path: candidatePath, searchedPaths };
        }
      }
    }

    return { found: false, path: null, searchedPaths };
  } catch (err) {
    console.error("Failed to find textbook_with_content.json:", err);
    return { found: false, path: null, searchedPaths: [], error: err.message };
  }
}

module.exports = {
  DATA_DIR,
  ensureDataUserDir,
  ensureUserDir,
  ensureDataUserInputDir,
  ensureDataUserProjectInputDir,
  getDataInputFilePath,
  writeDataUserFile,
  writeUserFile,
  writeDataUserJson,
  writeUserJson,
  readDataUserFile,
  readUserFile,
  writeDataInputFile,
  readDataUserJson,
  readUserStatus,
  writeUserStatus,
  addUploadedProject,
  setCurrentProject,
  findTextbookWithContent,
};
