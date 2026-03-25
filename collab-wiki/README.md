# Collaborative Document Store

A production-ready collaborative wiki backend built with **Node.js**, **Express.js**, and **MongoDB 7**. Implements optimistic concurrency control (OCC), full-text search, aggregation-pipeline analytics, lazy/background schema migration, and automatic seeding of 10,000 documents.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Optimistic Concurrency Control](#optimistic-concurrency-control)
- [Schema Migration](#schema-migration)
- [Running the Migration Script](#running-the-migration-script)
- [Data Model](#data-model)
- [Project Structure](#project-structure)

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd collab-wiki
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if needed — defaults work for local Docker development
```

### 3. Start all services

```bash
docker-compose up --build
```

This will:
1. Start a MongoDB 7 container with a persistent volume and health check
2. Build and start the Node.js API server (waits for MongoDB to be healthy)
3. On first run, automatically seed the `documents` collection with **10,000 documents**
4. Create all required indexes (`slug` unique, `title`+`content` text, `tags`, `metadata.updatedAt`)

The API will be available at **`http://localhost:3000`** once seeding completes (~30–60 seconds on first run).

### 4. Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}

curl "http://localhost:3000/api/search?q=mongodb"
# [...array of documents with relevance scores...]
```

### Stopping

```bash
docker-compose down        # stop containers, keep data volume
docker-compose down -v     # stop and delete data volume (full reset)
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     User Interaction                      │
│                     Client / Frontend                     │
└────┬──────────┬───────────────┬────────────┬─────────────┘
     │          │               │            │
  REST API  GET /docs/:slug  PUT /docs/:slug  GET /search
  Calls      (lazy migrate)     (OCC)        GET /analytics
     │          │               │            │
     ▼          ▼               ▼            ▼
┌──────────────────────────────────────────────────────────┐
│                 Backend API Server                        │
│            Express.js  ·  Node.js 20                     │
│                                                          │
│  POST   /api/documents          Create document          │
│  GET    /api/documents/:slug    Fetch + lazy migrate     │
│  PUT    /api/documents/:slug    OCC update               │
│  DELETE /api/documents/:slug    Delete document          │
│  GET    /api/search             Full-text search         │
│  GET    /api/analytics/most-edited        Aggregation    │
│  GET    /api/analytics/tag-cooccurrence   Aggregation    │
└─────────────────────────┬────────────────────────────────┘
                          │  Queries · Updates · Aggregations
                          ▼
┌──────────────────────────────────────────────────────────┐
│                      Data Layer                          │
│          MongoDB 7  ·  documents collection              │
│  Indexes: slug (unique), text (title+content), tags      │
└──────────────────────────▲───────────────────────────────┘
                           │  Reads & Writes in Batches
┌──────────────────────────┴───────────────────────────────┐
│            Maintenance  (run on demand)                  │
│       scripts/migrate_author_schema.js                   │
│       bulkWrite · idempotent · progress logging          │
└──────────────────────────────────────────────────────────┘
```

**Components:**

- **Backend API Server** – Express.js REST API handling all business logic: OCC, lazy schema migration, full-text search, and analytics aggregations.
- **MongoDB Database** – `mongo:7` Docker container with a persistent named volume. Stores the `documents` collection with embedded revision history.
- **Migration Script** – Standalone script for background schema migration. Runs independently from the API, processes documents in batches using `bulkWrite`.

---

## Environment Variables

Copy `.env.example` to `.env`:

| Variable        | Default                   | Description                              |
|-----------------|---------------------------|------------------------------------------|
| `MONGO_URI`     | `mongodb://mongo:27017`   | MongoDB connection string                |
| `DATABASE_NAME` | `collab_wiki`             | MongoDB database name                    |
| `PORT`          | `3000`                    | Port the API server listens on           |
| `NODE_ENV`      | `production`              | Runtime environment                      |

> In Docker Compose the service name `mongo` resolves automatically via Docker DNS. For local development outside Docker use `MONGO_URI=mongodb://localhost:27017`.

---

## API Reference

### Documents

#### `POST /api/documents` — Create a document

**Request body:**
```json
{
  "title": "My Document",
  "content": "# Hello\n\nContent here.",
  "tags": ["mongodb", "guide"],
  "authorName": "Jane Doe",
  "authorEmail": "jane@example.com"
}
```

**Response `201 Created`:** Full document object with server-generated `slug` and `version: 1`.

---

#### `GET /api/documents/:slug` — Retrieve a document

**Response `200 OK`:** Full document object. Old-schema `author` strings are transparently upgraded to objects in the response.  
**Response `404 Not Found`:** `{ "error": "Document not found." }`

---

#### `PUT /api/documents/:slug` — Update with OCC

The client **must** send the `version` it currently holds. The server atomically checks the version before applying the update.

**Request body:**
```json
{
  "title": "Updated Title",
  "content": "New content.",
  "version": 5
}
```

**Response `200 OK`:** Updated document with `version: 6` and new entry appended to `revision_history` (capped at 20).

**Response `409 Conflict`:** Returned when `version` is stale. Body contains the **current** document from the database so the client can perform a diff/merge.

**Response `404 Not Found`:** Document does not exist.

---

#### `DELETE /api/documents/:slug` — Delete a document

**Response `200 OK`:** `{ "message": "Document deleted successfully." }`  
**Response `404 Not Found`:** `{ "error": "Document not found." }`

---

### Search

#### `GET /api/search` — Full-text search

| Parameter | Required | Description |
|-----------|----------|-------------|
| `q`       | Yes      | Search term(s) |
| `tags`    | No       | Comma-separated; document must match **all** tags |

```bash
GET /api/search?q=mongodb
GET /api/search?q=mongodb&tags=guide
GET /api/search?q=kubernetes&tags=docker,devops
```

**Response `200 OK`:** Array of matching documents sorted by relevance `score` (descending). Each document includes a `score` field from MongoDB's `$meta: "textScore"`.

---

### Analytics

#### `GET /api/analytics/most-edited`

Top 10 documents by number of entries in `revision_history`, sorted descending.

**Response `200 OK`:**
```json
[
  { "title": "MongoDB", "slug": "mongodb", "editCount": 20 },
  { "title": "Docker",  "slug": "docker",  "editCount": 19 }
]
```

#### `GET /api/analytics/tag-cooccurrence`

Tag pairs that appear together most frequently across documents.

**Response `200 OK`:**
```json
[
  { "tags": ["backend", "nodejs"],     "count": 412 },
  { "tags": ["docker", "kubernetes"],  "count": 387 }
]
```

---

## Optimistic Concurrency Control

OCC prevents the "lost update" problem without database locking:

```
User A reads document  →  version: 5
User B reads document  →  version: 5

User B saves  →  PUT { version: 5 }  →  200 OK  →  version is now 6 in DB
User A saves  →  PUT { version: 5 }  →  409 Conflict (DB has version 6)
                                         Response body = current document (v6)
                                         Client shows diff, asks user to merge
```

The key is a **single atomic `findOneAndUpdate`**:

```js
db.collection('documents').findOneAndUpdate(
  { slug: 'my-doc', version: 5 },          // conditional filter
  {
    $set: { title, content, 'metadata.updatedAt': now },
    $inc: { version: 1 },                   // atomic increment
    $push: { revision_history: { $each: [...], $slice: -20 } }
  },
  { returnDocument: 'after' }
)
// Returns null if no document matched → version conflict
```

---

## Schema Migration

The `metadata.author` field evolved between two shapes:

| Schema  | Shape |
|---------|-------|
| Old (legacy) | `"author": "Jane Doe"` |
| New (current) | `"author": { "id": "user-123", "name": "Jane Doe", "email": "jane@example.com" }` |

### Lazy On-Read Migration

Every `GET /api/documents/:slug` response automatically upgrades old-schema documents **without writing to the database**:

```
DB stores:   metadata.author = "Jane Doe"
API returns: metadata.author = { "id": null, "name": "Jane Doe", "email": null }
```

Zero downtime — all API consumers receive the new schema immediately, regardless of database state.

### Background Migration

`scripts/migrate_author_schema.js` progressively upgrades old documents in the database itself.

---

## Running the Migration Script

### Via Docker Compose (recommended for production)

```bash
docker-compose exec api node scripts/migrate_author_schema.js
```

### Locally

```bash
# Ensure MONGO_URI points to your database
node scripts/migrate_author_schema.js
```

**Sample output:**
```
[Migration] Connected to MongoDB: mongodb://localhost:27017
[Migration] Found 1024 documents to migrate.
[Migration] Processing in batches of 1000...
[Migration] Batch 1: Processing 1000 documents...
[Migration] Batch 1 complete: 1000 updated | Total: 1000/1024 (97.7%)
[Migration] Batch 2: Processing 24 documents...
[Migration] Batch 2 complete: 24 updated  | Total: 1024/1024 (100.0%)
[Migration] No more documents to process.
[Migration] ✅ All documents now use the new author schema.
[Migration] Database connection closed.
```

The script is **idempotent** — safe to run multiple times. Uses MongoDB `bulkWrite` for efficient batch updates with a brief pause between batches to avoid impacting live traffic.

---

## Data Model

```json
{
  "_id": "ObjectId",
  "slug": "mongodb-guide",
  "title": "MongoDB Guide",
  "content": "# MongoDB Guide\n\nContent here...",
  "version": 12,
  "tags": ["mongodb", "database", "guide"],
  "metadata": {
    "author": {
      "id": "user-001",
      "name": "Alice Johnson",
      "email": "alice@wiki.example.com"
    },
    "createdAt": "2025-06-01T00:00:00.000Z",
    "updatedAt": "2025-09-15T12:34:00.000Z",
    "wordCount": 450
  },
  "revision_history": [
    {
      "version": 12,
      "updatedAt": "2025-09-15T12:34:00.000Z",
      "authorId": "user-001",
      "contentDiff": "Updated paragraph 3 and added examples."
    }
  ]
}
```

**Indexes:**

| Field(s) | Type | Purpose |
|----------|------|---------|
| `slug` | Unique | Primary lookup key — fast document fetch by URL |
| `{ title: "text", content: "text" }` | Text (weighted) | Full-text search with relevance scoring |
| `tags` | Multikey | Efficient tag filtering in search |
| `metadata.updatedAt` | Regular | Sorting by recency |

---

## Project Structure

```
collab-wiki/
├── docker-compose.yml                 # MongoDB + API services
├── Dockerfile                         # Node.js 20 Alpine multi-stage image
├── .env.example                       # Required environment variable docs
├── .dockerignore
├── .gitignore
├── package.json
├── README.md
├── scripts/
│   └── migrate_author_schema.js       # Background schema migration script
└── src/
    ├── index.js                       # App entry point, startup, seeding
    ├── db.js                          # MongoDB connection management
    ├── routes/
    │   ├── documents.js               # POST / GET / PUT (OCC) / DELETE
    │   ├── search.js                  # Full-text search with tag filtering
    │   └── analytics.js               # Aggregation pipeline endpoints
    └── utils/
        ├── seed.js                    # 10,000-document seeder + index creation
        ├── migration.js               # Lazy on-read author schema migration
        └── slugify.js                 # URL-safe slug generator
```
