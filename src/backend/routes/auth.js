const express = require("express");
const { ensureUserDir } = require("../services/storage");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username is required" });
  }

  const userDir = ensureUserDir(username);
  return res.json({ username, userDir });
});

module.exports = router;