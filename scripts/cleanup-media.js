const { ObjectId } = require("mongodb");
const { closeDb, getDb } = require("../api/_lib/db");
const {
  requireMongoConfig,
  requireSupabaseServiceConfig,
  readServerEnv,
} = require("../api/_lib/env");
const { ApiError } = require("../api/_lib/http");
const { removeObject } = require("../api/_lib/media-storage");
const { projectRefFromUrl } = require("./setup-media-storage");

function parseArgs(args) {
  const databaseArg = args.find(argument => argument.startsWith("--confirm-db="));
  const projectArg = args.find(argument => argument.startsWith("--confirm-project="));
  if (args.includes("--dry-run") && args.includes("--apply")) {
    throw new Error("Choose either --dry-run or --apply.");
  }
  return {
    apply: args.includes("--apply"),
    confirmedDatabase: databaseArg?.slice("--confirm-db=".length),
    confirmedProject: projectArg?.slice("--confirm-project=".length),
  };
}

async function retryPendingCleanup(db, config, fetchImpl, limit = 100) {
  const pending = await db.collection("media_cleanup")
    .find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  let cleaned = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await removeObject(config, fetchImpl, item.bucket, item.path);
      const completedAt = new Date();
      if (item.bucket === (config.buckets?.gallery || "gallery") && item.reason === "deletion") {
        await db.collection("gallery_photos").updateOne(
          { path: item.path, isPublished: false },
          { $set: { storageDeleted: true, updatedAt: completedAt } },
        );
      }
      await db.collection("media_cleanup").updateOne(
        { _id: item._id, status: "pending" },
        {
          $set: { status: "complete", lastAttemptAt: completedAt, updatedAt: completedAt },
          $inc: { attempts: 1 },
        },
      );
      cleaned += 1;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      await db.collection("media_cleanup").updateOne(
        { _id: item._id, status: "pending" },
        {
          $set: { lastAttemptAt: new Date(), updatedAt: new Date() },
          $inc: { attempts: 1 },
        },
      );
      failed += 1;
    }
  }
  return { cleaned, failed };
}

async function cleanupExpiredUploads(db, config, fetchImpl, now = new Date(), limit = 100) {
  const intents = await db.collection("media_uploads")
    .find({
      status: { $in: ["pending", "processing"] },
      expiresAt: { $lte: now },
    })
    .sort({ expiresAt: 1 })
    .limit(limit)
    .toArray();
  let cleaned = 0;
  let failed = 0;
  for (const intent of intents) {
    try {
      await removeObject(config, fetchImpl, intent.bucket, intent.path);
      await db.collection("media_uploads").deleteOne({
        _id: intent._id,
        status: { $in: ["pending", "processing"] },
      });
      cleaned += 1;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      await db.collection("media_cleanup").insertOne({
        _id: new ObjectId(),
        bucket: intent.bucket,
        path: intent.path,
        reason: "staging",
        status: "pending",
        attempts: 1,
        lastAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.collection("media_uploads").updateOne(
        { _id: intent._id, status: { $in: ["pending", "processing"] } },
        { $set: { status: "failed" } },
      );
      failed += 1;
    }
  }
  return { cleaned, failed };
}

async function runCleanup({
  args = process.argv.slice(2),
  getDatabase = getDb,
  getEnv = readServerEnv,
  getStorageConfig = requireSupabaseServiceConfig,
  fetchImpl = globalThis.fetch,
} = {}) {
  const options = parseArgs(args);
  const env = getEnv();
  const { database } = requireMongoConfig();
  const config = getStorageConfig();
  const projectRef = projectRefFromUrl(config.url);
  if (!options.apply) {
    return {
      mode: "dry-run",
      database,
      projectRef,
      environment: env.MONGODB_ENVIRONMENT || "unset",
    };
  }
  if (env.MONGODB_ENVIRONMENT !== "development" || env.SUPABASE_ENVIRONMENT !== "development") {
    throw new Error("Media cleanup requires both database and Supabase development environments.");
  }
  if (options.confirmedDatabase !== database) {
    throw new Error(`Apply requires --confirm-db=${database}.`);
  }
  if (options.confirmedProject !== projectRef) {
    throw new Error(`Apply requires --confirm-project=${projectRef}.`);
  }

  const db = await getDatabase();
  const expiredUploads = await cleanupExpiredUploads(db, config, fetchImpl);
  const pendingCleanup = await retryPendingCleanup(db, config, fetchImpl);
  return { mode: "apply", expiredUploads, pendingCleanup };
}

if (require.main === module) {
  async function main() {
    let failed = false;
    try {
      console.log(JSON.stringify(await runCleanup()));
    } catch (error) {
      console.error(error.message.startsWith("Missing required server environment variable:")
        ? error.message
        : "Media cleanup failed or was blocked. No credentials were printed.");
      failed = true;
    }
    try {
      await closeDb();
    } catch {
      console.error("Could not close the database connection cleanly.");
      failed = true;
    }
    if (failed) process.exitCode = 1;
  }
  main();
}

module.exports = {
  cleanupExpiredUploads,
  parseArgs,
  retryPendingCleanup,
  runCleanup,
};
