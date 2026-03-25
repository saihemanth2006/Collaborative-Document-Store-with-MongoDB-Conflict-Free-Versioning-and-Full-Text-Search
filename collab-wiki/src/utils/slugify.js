/**
 * Slug generation utility using slugify-compatible logic without external dep issues.
 */

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")          // Replace spaces/underscores with hyphens
    .replace(/[^\w-]+/g, "")          // Remove non-word chars except hyphens
    .replace(/--+/g, "-")             // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, "")          // Trim hyphens from start/end
    .substring(0, 80);                // Cap length
}

module.exports = { generateSlug };
