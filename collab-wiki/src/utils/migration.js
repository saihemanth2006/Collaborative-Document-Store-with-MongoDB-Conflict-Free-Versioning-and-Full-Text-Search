/**
 * Schema migration helpers.
 * Handles lazy on-read transformation of the author field from old (string) to new (object) schema.
 */

/**
 * Transform a document's author field if it uses the old string schema.
 * Old: metadata.author = "Jane Doe"
 * New: metadata.author = { id: null, name: "Jane Doe", email: null }
 *
 * @param {Object} doc - The raw document from MongoDB
 * @returns {Object} - Document with normalized author schema
 */
function applyLazyMigration(doc) {
  if (!doc || !doc.metadata) return doc;

  if (typeof doc.metadata.author === "string") {
    const authorName = doc.metadata.author;
    doc.metadata.author = {
      id: null,
      name: authorName,
      email: null,
    };
  }

  return doc;
}

module.exports = { applyLazyMigration };
