const express = require("express");
const router = express.Router();
const { getDB } = require("../db");

// ────────────────────────────────────────────────────
// GET /api/analytics/most-edited
// Returns top 10 documents by number of revisions
// ────────────────────────────────────────────────────
router.get("/most-edited", async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection("documents");

    const pipeline = [
      // Project only the fields we need + compute revision count
      {
        $project: {
          slug: 1,
          title: 1,
          version: 1,
          tags: 1,
          "metadata.updatedAt": 1,
          editCount: { $size: "$revision_history" },
        },
      },
      // Sort by edit count descending
      { $sort: { editCount: -1 } },
      // Top 10
      { $limit: 10 },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return res.status(200).json(results);
  } catch (err) {
    console.error("[GET /api/analytics/most-edited]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ────────────────────────────────────────────────────
// GET /api/analytics/tag-cooccurrence
// Returns pairs of tags that frequently appear together,
// sorted by co-occurrence count descending.
// ────────────────────────────────────────────────────
router.get("/tag-cooccurrence", async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection("documents");

    const pipeline = [
      // Only consider documents with at least 2 tags
      { $match: { $expr: { $gte: [{ $size: { $ifNull: ["$tags", []] } }, 2] } } },

      // Sort tags within each document for consistent pair ordering (tagA < tagB)
      {
        $project: {
          tags: { $sortArray: { input: "$tags", sortBy: 1 } },
        },
      },

      // Generate all ordered pairs using $reduce over the tags array.
      // For each tag at position i, pair it with every tag at position j > i.
      {
        $project: {
          pairs: {
            $reduce: {
              input: { $range: [0, { $size: "$tags" }] },
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: {
                        $slice: [
                          "$tags",
                          { $add: ["$$this", 1] },
                          { $size: "$tags" },
                        ],
                      },
                      as: "tagB",
                      in: {
                        tagA: { $arrayElemAt: ["$tags", "$$this"] },
                        tagB: "$$tagB",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // Flatten pairs array — one document per pair
      { $unwind: "$pairs" },

      // Group and count each unique pair
      {
        $group: {
          _id: { tagA: "$pairs.tagA", tagB: "$pairs.tagB" },
          count: { $sum: 1 },
        },
      },

      // Shape final output
      {
        $project: {
          _id: 0,
          tags: ["$_id.tagA", "$_id.tagB"],
          count: 1,
        },
      },

      { $sort: { count: -1 } },
      { $limit: 50 },
    ];

    const results = await collection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray();

    return res.status(200).json(results);
  } catch (err) {
    console.error("[GET /api/analytics/tag-cooccurrence]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
