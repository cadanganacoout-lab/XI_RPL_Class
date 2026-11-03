const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { JSDOM } = require("jsdom");
const { closeDb, getDb } = require("../api/_lib/db");
const {
  requireMongoConfig,
  requireSupabaseServiceConfig,
  readServerEnv,
} = require("../api/_lib/env");
const { encodeWebp, SOURCE_MAX_BYTES } = require("../api/_lib/media-image");
const {
  STORAGE_BUCKETS,
  publicObjectUrl,
  removeObject,
  uploadObject,
} = require("../api/_lib/media-storage");
const { projectRefFromUrl } = require("./setup-media-storage");

const root = path.resolve(__dirname, "..");

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

function loadLegacyData() {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  try {
    const source = fs.readFileSync(path.join(root, "js", "data.js"), "utf8");
    dom.window.eval(source);
    const data = dom.window.XIRPL1_DATA;
    if (!data || !Array.isArray(data.GALERI)) {
      throw new Error("Legacy class media data is unavailable.");
    }
    return data;
  } finally {
    dom.window.close();
  }
}

function localAssetPath(value) {
  if (typeof value !== "string" || !value.startsWith("asset/") || value.includes("\\")) {
    return null;
  }
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(resolved)) return null;
  const realPath = fs.realpathSync(resolved);
  const realRelative = path.relative(root, realPath);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) return null;
  const stats = fs.statSync(realPath);
  if (!stats.isFile() || stats.size < 1 || stats.size > SOURCE_MAX_BYTES) return null;
  return realPath;
}

function planMigration({ cards, teachers, existingGallery, legacyData }) {
  const plan = {
    cardAvatars: [],
    teacherAvatars: [],
    galleryPhotos: [],
    missingLocalAssets: 0,
    skippedExternalOrUnset: 0,
    skippedMissingCaption: 0,
  };
  const addCard = (record, type, id) => {
    if (record.avatar?.url) return;
    if (typeof record.foto !== "string" || !record.foto.startsWith("asset/")) {
      plan.skippedExternalOrUnset += 1;
      return;
    }
    const file = localAssetPath(record.foto);
    if (!file) {
      plan.missingLocalAssets += 1;
      return;
    }
    (type === "student" ? plan.cardAvatars : plan.teacherAvatars).push({
      record,
      targetType: type,
      targetId: id,
      file,
    });
  };
  for (const card of cards) addCard(card, "student", card.legacyId);
  for (const teacher of teachers) addCard(teacher, "teacher", teacher.id);

  const existingIds = new Set(existingGallery.map(photo => photo.legacyId).filter(Boolean));
  for (const [index, photo] of legacyData.GALERI.entries()) {
    if (existingIds.has(photo.id)) continue;
    const caption = typeof photo.caption === "string" ? photo.caption.trim() : "";
    if (!caption) {
      plan.skippedMissingCaption += 1;
      continue;
    }
    const file = localAssetPath(photo.foto);
    if (!file) {
      if (typeof photo.foto === "string" && photo.foto.startsWith("asset/")) {
        plan.missingLocalAssets += 1;
      } else {
        plan.skippedExternalOrUnset += 1;
      }
      continue;
    }
    plan.galleryPhotos.push({
      legacyId: photo.id,
      caption,
      sortOrder: index + 1,
      file,
    });
  }
  return plan;
}

function summary(plan) {
  return {
    students: plan.cardAvatars.length,
    teachers: plan.teacherAvatars.length,
    gallery: plan.galleryPhotos.length,
    missingLocalAssets: plan.missingLocalAssets,
    skippedExternalOrUnset: plan.skippedExternalOrUnset,
    skippedMissingCaption: plan.skippedMissingCaption,
  };
}

async function uploadLegacyAsset({ config, fetchImpl, file, targetType, targetId, mediaType }) {
  const source = fs.readFileSync(file);
  const webp = await encodeWebp(source, mediaType);
  const bucketName = mediaType === "avatar"
    ? (config.buckets?.avatar || STORAGE_BUCKETS.avatar)
    : (config.buckets?.gallery || STORAGE_BUCKETS.gallery);
  const objectPath = targetType === "gallery"
    ? `${randomUUID()}.webp`
    : `${targetType}/${targetId}/${randomUUID()}.webp`;
  await uploadObject(config, fetchImpl, bucketName, objectPath, webp);
  return {
    url: publicObjectUrl(config, bucketName, objectPath),
    path: objectPath,
    bucket: bucketName,
  };
}

async function runMigration({
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
  const db = await getDatabase();
  const [cards, teachers, existingGallery] = await Promise.all([
    db.collection("cards").find({}, { projection: { legacyId: 1, foto: 1, avatar: 1 } }).toArray(),
    db.collection("teachers").find({}, { projection: { id: 1, foto: 1, avatar: 1 } }).toArray(),
    db.collection("gallery_photos").find({}, { projection: { legacyId: 1 } }).toArray(),
  ]);
  const plan = planMigration({
    cards,
    teachers,
    existingGallery,
    legacyData: loadLegacyData(),
  });
  if (!options.apply) {
    return {
      mode: "dry-run",
      database,
      projectRef,
      counts: summary(plan),
    };
  }
  if (env.MONGODB_ENVIRONMENT !== "development" || env.SUPABASE_ENVIRONMENT !== "development") {
    throw new Error("Media migration requires both database and Supabase development environments.");
  }
  if (options.confirmedDatabase !== database) {
    throw new Error(`Apply requires --confirm-db=${database}.`);
  }
  if (options.confirmedProject !== projectRef) {
    throw new Error(`Apply requires --confirm-project=${projectRef}.`);
  }

  const counts = { migrated: 0, skippedConcurrentChange: 0, failed: 0 };
  const migrateCard = async item => {
    const collection = item.targetType === "student" ? "cards" : "teachers";
    const idField = item.targetType === "student" ? "legacyId" : "id";
    const { url, path: objectPath, bucket } = await uploadLegacyAsset({
      config,
      fetchImpl,
      file: item.file,
      targetType: item.targetType,
      targetId: item.targetId,
      mediaType: "avatar",
    });
    const now = new Date();
    try {
      const result = await db.collection(collection).updateOne(
        { [idField]: item.targetId, avatar: { $exists: false }, foto: item.record.foto },
        { $set: { avatar: { url, path: objectPath, updatedAt: now }, updatedAt: now } },
      );
      if (result.matchedCount !== 1) {
        await removeObject(config, fetchImpl, bucket, objectPath);
        counts.skippedConcurrentChange += 1;
        return;
      }
      counts.migrated += 1;
    } catch (error) {
      await removeObject(config, fetchImpl, bucket, objectPath);
      throw error;
    }
  };

  for (const item of [...plan.cardAvatars, ...plan.teacherAvatars]) {
    await migrateCard(item);
  }

  for (const item of plan.galleryPhotos) {
    const { url, path: objectPath, bucket } = await uploadLegacyAsset({
      config,
      fetchImpl,
      file: item.file,
      targetType: "gallery",
      targetId: "gallery",
      mediaType: "gallery",
    });
    const now = new Date();
    const photo = {
      legacyId: item.legacyId,
      caption: item.caption,
      url,
      path: objectPath,
      sortOrder: item.sortOrder,
      isPublished: true,
      storageDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.collection("gallery_photos").insertOne(photo);
      counts.migrated += 1;
    } catch (error) {
      await removeObject(config, fetchImpl, bucket, objectPath);
      if (error.code === 11000) {
        counts.skippedConcurrentChange += 1;
        continue;
      }
      throw error;
    }
  }
  return { mode: "apply", counts };
}

if (require.main === module) {
  async function main() {
    let failed = false;
    try {
      console.log(JSON.stringify(await runMigration()));
    } catch (error) {
      console.error(error.message.startsWith("Missing required server environment variable:")
        ? error.message
        : "Media migration failed or was blocked. No credentials or media paths were printed.");
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
  localAssetPath,
  parseArgs,
  planMigration,
  runMigration,
  summary,
};
