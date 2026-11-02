const { MongoClient } = require("mongodb");
const { requireMongoConfig } = require("./env");

const cacheKey = "__xirpl1MongoClientPromise";

async function getDb() {
  const { uri, database } = requireMongoConfig();
  if (!globalThis[cacheKey]) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
    globalThis[cacheKey] = client.connect().catch(error => {
      delete globalThis[cacheKey];
      throw error;
    });
  }
  const client = await globalThis[cacheKey];
  return client.db(database);
}

async function closeDb() {
  const clientPromise = globalThis[cacheKey];
  if (!clientPromise) return;
  delete globalThis[cacheKey];
  const client = await clientPromise;
  await client.close();
}

module.exports = { closeDb, getDb };
