const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { closeDb, getDb } = require("../api/_lib/db");
const { setupTeachers } = require("./setup-teachers");
const {
  legacyTeacherSchema,
  teacherDocumentSchema,
} = require("../api/_lib/schemas");

const root = path.resolve(__dirname, "..");

function loadLegacyTeachers() {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  try {
    const source = fs.readFileSync(path.join(root, "js", "data.js"), "utf8");
    dom.window.eval(source);
    const teachers = dom.window.XIRPL1_DATA?.GURU;
    if (!Array.isArray(teachers)) {
      throw new Error("Could not read the teacher source data.");
    }
    return teachers.map(teacher => legacyTeacherSchema.parse(teacher));
  } finally {
    dom.window.close();
  }
}

function buildLegacyTeachers(teachers, now = new Date()) {
  const seenIds = new Set();
  return teachers.map((teacher, index) => {
    const checkedTeacher = legacyTeacherSchema.parse(teacher);
    if (seenIds.has(checkedTeacher.id)) {
      throw new Error("Teacher source contains duplicate IDs.");
    }
    seenIds.add(checkedTeacher.id);
    return teacherDocumentSchema.parse({
      ...checkedTeacher,
      sortOrder: index + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  });
}

function parseArgs(args) {
  const apply = args.includes("--apply");
  if (apply && args.includes("--dry-run")) {
    throw new Error("Choose either --dry-run or --apply.");
  }
  const confirmDbArg = args.find(arg => arg.startsWith("--confirm-db="));
  return {
    apply,
    confirmedDatabase: confirmDbArg?.slice("--confirm-db=".length),
    confirmProduction: args.includes("--confirm-production"),
  };
}

function makeUpsertOperations(teachers) {
  return teachers.map(teacher => ({
    updateOne: {
      filter: { id: teacher.id },
      update: { $setOnInsert: teacher },
      upsert: true,
    },
  }));
}

async function runMigration(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const teachers = buildLegacyTeachers(loadLegacyTeachers());
  if (!options.apply) return { mode: "dry-run", teachers: teachers.length };

  const { readServerEnv } = require("../api/_lib/env");
  const env = readServerEnv();
  if (!options.confirmedDatabase || options.confirmedDatabase !== env.MONGODB_DB) {
    throw new Error("Apply requires --confirm-db=<exact MONGODB_DB>.");
  }
  if (!env.MONGODB_ENVIRONMENT) {
    throw new Error("Missing required server environment variable: MONGODB_ENVIRONMENT");
  }
  if (env.MONGODB_ENVIRONMENT === "production" && !options.confirmProduction) {
    throw new Error("Production writes require --confirm-production.");
  }

  const db = await getDb();
  await setupTeachers(db);
  const collection = db.collection("teachers");
  await collection.createIndex({ id: 1 }, { unique: true, name: "teacher_id_unique" });
  const result = await collection.bulkWrite(makeUpsertOperations(teachers), { ordered: true });
  return {
    mode: "apply",
    teachers: teachers.length,
    inserted: result.upsertedCount,
    alreadyExisted: result.matchedCount,
  };
}

if (require.main === module) {
  async function main() {
    let failed = false;
    try {
      console.log(JSON.stringify(await runMigration()));
    } catch (error) {
      console.error(error.message.startsWith("Missing required server environment variable:")
        ? error.message
        : "Teacher migration failed or was blocked. No record contents or credentials were printed.");
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
  buildLegacyTeachers,
  loadLegacyTeachers,
  makeUpsertOperations,
  parseArgs,
  runMigration,
};
