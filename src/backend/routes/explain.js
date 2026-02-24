const express = require("express");
const { mockExplanation } = require("../services/mock");

const router = express.Router();

router.get("/explain/:id", (req, res) => {
  const { id } = req.params;
  const title = req.query.title || id;
  const keypoints = req.query.keypoints ? req.query.keypoints.split("|") : [];

  const explanation = mockExplanation(title, keypoints);
  res.json({ explanation });
});

module.exports = router;