#!/usr/bin/env node
/**
 * scripts/migrate_author_schema.js
 *
 * Background migration script: converts old "author" string fields to
 * the new structured object format across all documents in the collection.
 *
 * OLD schema:  metadata.author = "Jane Doe"
 * NEW schema:  metadata.author = { id: null, name: "Jane Doe", email: null }
 *
 * Usage:
 *   node scripts/migrate_author_schema.js
 *   # or via npm:
 *   npm run migrate
 *
 * The script runs in batches to avoid overwhelming the database.
 * It is safe to run multiple times (idempotent).
 */

require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DATABASE_NAME = process.env.DATABASE_NAME || "collab_wiki";
const BATCH_SIZE = 1000;

async function runMigration() {
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    console.log(`[Migration] Connected to MongoDB: ${MONGO_URI}`);

    const db = client.db(DATABASE_NAME);
    const collection = db.collection("documents");

    // Count documents that need migrating
    const totalToMigrate = await collection.countDocuments({
      "metadata.author": { $type: "string" },
    });

    if (totalToMigrate === 0) {
      console.log("[Migration] No documents require migration. All documents already use the new schema.");
      return;
    }

    console.log(`[Migration] Found ${totalToMigrate} documents to migrate.`);
    console.log(`[Migration] Processing in batches of ${BATCH_SIZE}...`);

    let totalMigrated = 0;
    let batchNumber = 0;

    while (true) {
      batchNumber++;

      // Fetch a batch of documents with the old string author schema
      const batch = await collection
        .find({ "metadata.author": { $type: "string" } })
        .project({ _id: 1, "metadata.author": 1 })
        .limit(BATCH_SIZE)
        .toArray();

      if (batch.length === 0) {
        console.log("[Migration] No more documents to process.");
        break;
      }

      console.log(`[Migration] Batch ${batchNumber}: Processing ${batch.length} documents...`);

      // Build bulk write operations
      const bulkOps = batch.map((doc) => {
        const authorName = doc.metadata.author; // currently a string
        return {
          updateOne: {
            filter: { _id: doc._id, "metadata.author": { $type: "string" } },
            update: {
              $set: {
                "metadata.author": {
                  id: null,
                  name: authorName,
                  email: null,
                },
              },
            },
          },
        };
      });

      // Execute all updates in a single round-trip
      const result = await collection.bulkWrite(bulkOps, { ordered: false });
      const migratedInBatch = result.modifiedCount;
      totalMigrated += migratedInBatch;

      const percentComplete = ((totalMigrated / totalToMigrate) * 100).toFixed(1);
      console.log(
        `[Migration] Batch ${batchNumber} complete: ${migratedInBatch} updated | ` +
        `Total: ${totalMigrated}/${totalToMigrate} (${percentComplete}%)`
      );

      // Short pause to avoid overwhelming the DB
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Verify
    const remaining = await collection.countDocuments({
      "metadata.author": { $type: "string" },
    });

    console.log("\n[Migration] ─────────────────────────────────────────");
    console.log(`[Migration] Migration complete!`);
    console.log(`[Migration] Documents migrated : ${totalMigrated}`);
    console.log(`[Migration] Documents remaining: ${remaining}`);

    if (remaining === 0) {
      console.log("[Migration] ✅ All documents now use the new author schema.");
    } else {
      console.warn(`[Migration] ⚠️  ${remaining} documents still have the old schema. Re-run to continue.`);
    }
  } catch (err) {
    console.error("[Migration] Fatal error:", err);
    process.exit(1);
  } finally {
    await client.close();
    console.log("[Migration] Database connection closed.");
  }
}

runMigration();
