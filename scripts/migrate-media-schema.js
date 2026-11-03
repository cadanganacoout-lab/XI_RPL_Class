const { closeDb, getDb } = require("../api/_lib/db");
const { requireMongoConfig, readServerEnv } = require("../api/_lib/env");
const { COLLECTION_SCHEMAS } = require("../api/_lib/collection-schemas");
const { createIndexes } = require("./create-indexes");

function parseArgs(args) {
  const databaseArg = args.find(argument => argument.startsWith("--confirm-db="));
  if (args.includes("--dry-run") && args.includes("--apply")) {
    throw new Error("Choose either --dry-run or --apply.");
  }
  return {
    apply: args.includes("--apply"),
    confirmedDatabase: databaseArg?.slice("--confirm-db=".length),
  };
}

async function updateExistingValidator(db, name) {
  const [existing] = await db.listCollections({ name }, { nameOnly: false }).toArray();
  if (!existing) return false;
  await db.command({
    collMod: name,
    validator: { $jsonSchema: COLLECTION_SCHEMAS[name] },
    validationLevel: "strict",
    validationAction: "error",
  });
  return true;
}

async function runMigration({
  args = process.argv.slice(2),
  getDatabase = getDb,
  getEnv = readServerEnv,
} = {}) {
  const options = parseArgs(args);
  const env = getEnv();
  const { database } = requireMongoConfig();
  if (!options.apply) {
    return {
      mode: "dry-run",
      database,
      environment: env.MONGODB_ENVIRONMENT || "unset",
      collections: Object.keys(COLLECTION_SCHEMAS),
    };
  }
  if (env.MONGODB_ENVIRONMENT !== "development") {
    throw new Error("Media schema changes require MONGODB_ENVIRONMENT=development.");
  }
  if (options.confirmedDatabase !== database) {
    throw new Error(`Apply requires --confirm-db=${database}.`);
  }

  const db = await getDatabase();
  const validatorsUpdated = [];
  for (const name of ["cards", "teachers"]) {
    if (await updateExistingValidator(db, name)) validatorsUpdated.push(name);
  }
  const indexes = await createIndexes(db);
  return { mode: "apply", validatorsUpdated, ...indexes };
}

if (require.main === module) {
  async function main() {
    let failed = false;
    try {
      console.log(JSON.stringify(await runMigration()));
    } catch (error) {
      console.error(error.message.startsWith("Missing required server environment variable:")
        ? error.message
        : "Media schema migration failed or was blocked. No credentials were printed.");
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
  parseArgs,
  runMigration,
  updateExistingValidator,
};
