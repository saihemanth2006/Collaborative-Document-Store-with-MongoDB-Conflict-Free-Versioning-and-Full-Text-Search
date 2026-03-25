const express = require("express");
const router = express.Router();
const { getDB } = require("../db");
const { generateSlug } = require("../utils/slugify");
const { applyLazyMigration } = require("../utils/migration");

// ────────────────────────────────────────────────────
// POST /api/documents  –  Create a new document
// ────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { title, content, tags, authorName, authorEmail } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required." });
    }

    const db = getDB();
    const collection = db.collection("documents");

    // Generate slug, ensure uniqueness
    let slug = generateSlug(title);
    let attempt = 0;
    while (await collection.findOne({ slug })) {
      attempt++;
      slug = `${generateSlug(title)}-${attempt}`;
    }

    const now = new Date();
    const doc = {
      slug,
      title,
      content,
      version: 1,
      tags: Array.isArray(tags) ? tags : [],
      metadata: {
        author: {
          id: null,
          name: authorName || "Anonymous",
          email: authorEmail || null,
        },
        createdAt: now,
        updatedAt: now,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      },
      revision_history: [
        {
          version: 1,
          updatedAt: now,
          authorId: null,
          contentDiff: "Initial creation.",
        },
      ],
    };

    await collection.insertOne(doc);

    return res.status(201).json(doc);
  } catch (err) {
    console.error("[POST /api/documents]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ────────────────────────────────────────────────────
// GET /api/documents/:slug  –  Retrieve a document
// ────────────────────────────────────────────────────
router.get("/:slug", async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection("documents");

    const doc = await collection.findOne({ slug: req.params.slug });

    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    // Phase 6: Lazy migration – transform old author schema on read
    const transformed = applyLazyMigration(doc);

    return res.status(200).json(transformed);
  } catch (err) {
    console.error("[GET /api/documents/:slug]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ────────────────────────────────────────────────────
// PUT /api/documents/:slug  –  Update with OCC
// ────────────────────────────────────────────────────
router.put("/:slug", async (req, res) => {
  try {
    const { title, content, version } = req.body;

    if (version === undefined || version === null) {
      return res.status(400).json({ error: "version is required for optimistic concurrency control." });
    }
    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required." });
    }

    const expectedVersion = Number(version);
    const newVersion = expectedVersion + 1;
    const now = new Date();

    const db = getDB();
    const collection = db.collection("documents");

    // Generate a simple diff summary
    const contentDiff = `Updated title to "${title}" and modified content (revision ${newVersion}).`;

    // Atomic conditional update – the heart of OCC
    const result = await collection.findOneAndUpdate(
      { slug: req.params.slug, version: expectedVersion },
      {
        $set: {
          title,
          content,
          "metadata.updatedAt": now,
          "metadata.wordCount": content.split(/\s+/).filter(Boolean).length,
        },
        $inc: { version: 1 },
        $push: {
          revision_history: {
            $each: [
              {
                version: newVersion,
                updatedAt: now,
                authorId: null,
                contentDiff,
              },
            ],
            $slice: -20, // Keep only the last 20 revisions
          },
        },
      },
      { returnDocument: "after" }
    );

    // If result is null, either slug not found or version mismatch
    if (!result) {
      // Check if the document actually exists
      const current = await collection.findOne({ slug: req.params.slug });
      if (!current) {
        return res.status(404).json({ error: "Document not found." });
      }
      // Version conflict – return the latest version with 409
      // The spec says the response body must CONTAIN the latest document
      const transformed = applyLazyMigration(current);
      return res.status(409).json(transformed);
    }

    const transformed = applyLazyMigration(result);
    return res.status(200).json(transformed);
  } catch (err) {
    console.error("[PUT /api/documents/:slug]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ────────────────────────────────────────────────────
// DELETE /api/documents/:slug  –  Delete a document
// ────────────────────────────────────────────────────
router.delete("/:slug", async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection("documents");

    const result = await collection.deleteOne({ slug: req.params.slug });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Document not found." });
    }

    return res.status(200).json({ message: "Document deleted successfully." });
  } catch (err) {
    console.error("[DELETE /api/documents/:slug]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
