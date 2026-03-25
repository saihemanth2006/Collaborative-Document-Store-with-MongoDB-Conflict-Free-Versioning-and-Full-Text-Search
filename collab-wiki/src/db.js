const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "collab_wiki";

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });

  await client.connect();
  db = client.db(dbName);
  console.log(`[DB] Connected to MongoDB: ${dbName}`);
  return db;
}

function getDB() {
  if (!db) throw new Error("Database not initialized. Call connectDB() first.");
  return db;
}

async function closeDB() {
  if (client) {
    await client.close();
    console.log("[DB] Connection closed.");
  }
}

module.exports = { connectDB, getDB, closeDB };
