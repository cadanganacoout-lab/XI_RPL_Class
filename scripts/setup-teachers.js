const { isDeepStrictEqual } = require("node:util");
const { closeDb, getDb } = require("../api/_lib/db");
const { COLLECTION_SCHEMAS } = require("../api/_lib/collection-schemas");
const { INDEXES, ensureCollection } = require("./create-indexes");

async function setupTeachers(db) {
  const [existing] = await db
    .listCollections({ name: "teachers" }, { nameOnly: false })
    .toArray();
  let created = false;
  if (!existing) {
    created = await ensureCollection(db, "teachers", COLLECTION_SCHEMAS.teachers);
  } else {
    const currentSchema = existing.options?.validator?.$jsonSchema;
    if (!isDeepStrictEqual(currentSchema, COLLECTION_SCHEMAS.teachers)) {
      const previousSchema = JSON.parse(JSON.stringify(COLLECTION_SCHEMAS.teachers));
      previousSchema.required = previousSchema.required.filter(field => field !== "role");
      delete previousSchema.properties.role;
      if (!isDeepStrictEqual(currentSchema, previousSchema)) {
        throw new Error("Collection schema requires review: teachers");
      }
      await db.command({
        collMod: "teachers",
        validator: { $jsonSchema: COLLECTION_SCHEMAS.teachers },
        validationLevel: "strict",
        validationAction: "error",
      });
    }
  }
  for (const [keys, options] of INDEXES.teachers) {
    await db.collection("teachers").createIndex(keys, options);
  }
  return { collection: "teachers", created, indexesEnsured: INDEXES.teachers.length };
}

if (require.main === module) {
  async function main() {
    let failed = false;
    try {
      console.log(JSON.stringify(await setupTeachers(await getDb())));
    } catch (error) {
      const review = typeof error.message === "string" &&
        error.message.startsWith("Collection schema requires review: teachers");
      console.error(review
        ? error.message
        : "Could not set up the teachers collection; no credentials or database details were printed.");
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

module.exports = { setupTeachers };
