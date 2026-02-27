const fs = require("fs");
const path = require("path");

const BASE_DIR = path.resolve(__dirname, "..", "..", "..");
const USERS_DIR = path.join(BASE_DIR, "users");
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

function ensureUsersDir() {
  ensureDir(USERS_DIR);
}

function ensureDataDir() {
  ensureDir(DATA_DIR);
}

function ensureUserDir(username) {
  ensureUsersDir();
  const safeName = username.trim();
  const userDir = path.join(USERS_DIR, safeName);
  ensureDir(userDir);
  return userDir;
}

function ensureDataUserDir(username) {
  ensureDataDir();
  const safeName = username.trim();
  const userDir = path.join(DATA_DIR, safeName);
  ensureDir(userDir);
  return userDir;
}

function ensureDataUserInputDir(username) {
  const userDir = ensureDataUserDir(username);
  const inputDir = path.join(userDir, "input");
  ensureDir(inputDir);
  return inputDir;
}

function writeUserFile(username, filename, buffer) {
  const userDir = ensureUserDir(username);
  const target = path.join(userDir, filename);
  fs.writeFileSync(target, buffer);
  return target;
}

function writeUserJson(username, filename, data) {
  const userDir = ensureUserDir(username);
  const target = path.join(userDir, filename);
  fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");
  return target;
}

function readUserFile(username, filename) {
  const userDir = ensureUserDir(username);
  const target = path.join(userDir, filename);
  if (!fs.existsSync(target)) {
    return null;
  }
  return fs.readFileSync(target, "utf-8");
}

// New functions for data/user structure
function writeDataInputFile(username, filename, buffer) {
  try {
    const inputDir = ensureDataUserInputDir(username);
    const target = path.join(inputDir, filename);
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

function writeDataUserJson(username, filename, data) {
  try {
    const userDir = ensureDataUserDir(username);
    const target = path.join(userDir, filename);
    fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");
    console.log(`JSON saved to ${target}`);
    return target;
  } catch (err) {
    console.error(`Failed to save JSON file ${filename}:`, err);
    throw err;
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

  const project = {
    id: `project-${Date.now()}`,
    filename: filename,
    originalName: originalName,
    uploadedAt: new Date().toISOString(),
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

module.exports = {
  USERS_DIR,
  DATA_DIR,
  ensureUserDir,
  ensureDataUserInputDir,
  writeUserFile,
  writeUserJson,
  readUserFile,
  writeDataInputFile,
  readDataUserJson,
  writeDataUserJson,
  readUserStatus,
  writeUserStatus,
  addUploadedProject,
  setCurrentProject,
};