const express = require("express");
const router = express.Router();
const { getDB } = require("../db");

// ────────────────────────────────────────────────────
// GET /api/search?q=<term>&tags=<tag1>,<tag2>
// Full-text search with optional tag filtering
// ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { q, tags } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Query parameter 'q' is required." });
    }

    const db = getDB();
    const collection = db.collection("documents");

    // Build query
    const query = {
      $text: { $search: q.trim() },
    };

    // Optional tag filtering – document must have ALL specified tags
    if (tags) {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) {
        query.tags = { $all: tagList };
      }
    }

    const projection = {
      score: { $meta: "textScore" },
    };

    const results = await collection
      .find(query, { projection })
      .sort({ score: { $meta: "textScore" } })
      .limit(50)
      .toArray();

    return res.status(200).json(results);
  } catch (err) {
    console.error("[GET /api/search]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
