const fs = require("fs");
const path = require("path");

const BASE_DIR = path.resolve(__dirname, "..", "..", "..");
const USERS_DIR = path.join(BASE_DIR, "users");

function ensureUsersDir() {
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
}

function ensureUserDir(username) {
  ensureUsersDir();
  const safeName = username.trim();
  const userDir = path.join(USERS_DIR, safeName);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
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

module.exports = {
  USERS_DIR,
  ensureUserDir,
  writeUserFile,
  writeUserJson,
  readUserFile,
};