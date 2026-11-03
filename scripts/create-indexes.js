const { isDeepStrictEqual } = require("node:util");
const { getDb } = require("../api/_lib/db");
const { COLLECTION_SCHEMAS } = require("../api/_lib/collection-schemas");

const INDEXES = {
  users: [
    [{ username: 1 }, { unique: true, name: "user_username_unique" }],
    [{ role: 1 }, { name: "user_role" }],
  ],
  sessions: [
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: "session_expiry_ttl" }],
    [{ userId: 1 }, { name: "session_user" }],
  ],
  cards: [
    [{ slug: 1 }, { unique: true, name: "card_slug_unique" }],
    [{ legacyId: 1 }, { unique: true, name: "card_legacy_id_unique" }],
    [
      { ownerUserId: 1 },
      {
        unique: true,
        partialFilterExpression: { ownerUserId: { $type: "objectId" } },
        name: "card_owner_unique",
      },
    ],
  ],
  teachers: [
    [{ id: 1 }, { unique: true, name: "teacher_id_unique" }],
    [{ sortOrder: 1, id: 1 }, { name: "teacher_order" }],
  ],
  rate_limits: [
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: "rate_limit_expiry_ttl" }],
  ],
  gallery_photos: [
    [{ legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } }, name: "gallery_legacy_id_unique" }],
    [{ isPublished: 1, sortOrder: 1 }, { name: "gallery_public_order" }],
  ],
  media_uploads: [
    [{ expiresAt: 1, status: 1 }, { name: "media_upload_expiry" }],
    [{ actorUserId: 1, status: 1 }, { name: "media_upload_actor_status" }],
  ],
  media_cleanup: [
    [{ status: 1, createdAt: 1 }, { name: "media_cleanup_pending" }],
  ],
  media_audit: [
    [{ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60, name: "media_audit_ttl" }],
  ],
};

async function ensureCollection(db, name, jsonSchema) {
  const [existing] = await db
    .listCollections({ name }, { nameOnly: false })
    .toArray();
  if (existing) {
    const currentSchema = existing.options?.validator?.$jsonSchema;
    if (!isDeepStrictEqual(currentSchema, jsonSchema)) {
      throw new Error(`Collection schema requires review: ${name}`);
    }
    return false;
  }
  try {
    await db.createCollection(name, {
      validator: { $jsonSchema: jsonSchema },
      validationLevel: "strict",
      validationAction: "error",
    });
    return true;
  } catch (error) {
    if (error.code === 48) return false;
    throw error;
  }
}

async function createIndexes(db) {
  const createdCollections = [];
  for (const [name, jsonSchema] of Object.entries(COLLECTION_SCHEMAS)) {
    if (await ensureCollection(db, name, jsonSchema)) createdCollections.push(name);
  }

  for (const [name, indexes] of Object.entries(INDEXES)) {
    const collection = db.collection(name);
    for (const [keys, options] of indexes) {
      await collection.createIndex(keys, options);
    }
  }
  return {
    collectionsEnsured: Object.keys(COLLECTION_SCHEMAS).length,
    collectionsCreated: createdCollections.length,
    indexesEnsured: Object.values(INDEXES).reduce(
      (count, indexes) => count + indexes.length,
      0,
    ),
  };
}

if (require.main === module) {
  const { closeDb } = require("../api/_lib/db");
  async function main() {
    let failed = false;
    try {
      console.log(JSON.stringify(await createIndexes(await getDb())));
    } catch {
      console.error("Could not create database indexes; no credentials or database details were printed.");
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

module.exports = { INDEXES, createIndexes, ensureCollection };
