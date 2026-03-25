require("dotenv").config();
const express = require("express");
const { connectDB } = require("./db");
const { seedDatabase } = require("./utils/seed");

const documentsRouter = require("./routes/documents");
const searchRouter = require("./routes/search");
const analyticsRouter = require("./routes/analytics");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev-friendly)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ── Routes ──
app.use("/api/documents", documentsRouter);
app.use("/api/search", searchRouter);
app.use("/api/analytics", analyticsRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date() }));

// 404 fallthrough
app.use((_req, res) => res.status(404).json({ error: "Route not found." }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ error: "An unexpected error occurred." });
});

// ── Startup ──
async function start() {
  try {
    await connectDB();
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`[API] Server running on http://0.0.0.0:${PORT}`);
      console.log(`[API] Health check: http://0.0.0.0:${PORT}/health`);
    });
  } catch (err) {
    console.error("[Startup] Fatal error:", err);
    process.exit(1);
  }
}

start();
