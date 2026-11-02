const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { closeDb, getDb } = require("../api/_lib/db");
const { cardDocumentSchema, legacyStudentSchema } = require("../api/_lib/schemas");

const root = path.resolve(__dirname, "..");

function loadLegacyStudents() {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  try {
    const source = fs.readFileSync(path.join(root, "js", "data.js"), "utf8");
    dom.window.eval(source);
    const students = dom.window.XIRPL1_DATA?.SISWA;
    if (!Array.isArray(students)) {
      throw new Error("Could not read the student source data.");
    }
    return students.map(student => legacyStudentSchema.parse(student));
  } finally {
    dom.window.close();
  }
}

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildLegacyCards(students, now = new Date()) {
  const seenIds = new Set();
  const seenSlugs = new Set();

  return students.map((student, index) => {
    const checkedStudent = legacyStudentSchema.parse(student);
    if (seenIds.has(checkedStudent.id)) {
      throw new Error("Student source contains duplicate legacy IDs.");
    }
    seenIds.add(checkedStudent.id);

    const baseSlug = slugify(checkedStudent.nama) || checkedStudent.id;
    let slug = baseSlug;
    if (seenSlugs.has(slug)) slug = `${baseSlug}-${checkedStudent.id}`;
    if (seenSlugs.has(slug)) {
      throw new Error("Student source contains conflicting card slugs.");
    }
    seenSlugs.add(slug);

    const card = {
      legacyId: checkedStudent.id,
      slug,
      nama: checkedStudent.nama,
      jabatan: checkedStudent.jabatan,
      hobi: checkedStudent.hobi,
      catatan: checkedStudent.catatan,
      foto: checkedStudent.foto,
      ...(checkedStudent.portfolio
        ? { portfolio: checkedStudent.portfolio }
        : {}),
      sortOrder: index + 1,
      ownerUserId: null,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    };
    return cardDocumentSchema.parse(card);
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

function makeUpsertOperations(cards) {
  return cards.map(card => ({
    updateOne: {
      filter: { legacyId: card.legacyId },
      update: { $setOnInsert: card },
      upsert: true,
    },
  }));
}

async function runMigration(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const cards = buildLegacyCards(loadLegacyStudents());
  if (!options.apply) {
    return { mode: "dry-run", cards: cards.length, linkedAccounts: 0 };
  }

  const { readServerEnv } = require("../api/_lib/env");
  const env = readServerEnv();
  if (!options.confirmedDatabase || options.confirmedDatabase !== env.MONGODB_DB) {
    throw new Error("Apply requires --confirm-db=<exact MONGODB_DB>.");
  }
  if (!env.MONGODB_ENVIRONMENT) {
    throw new Error("Missing required server environment variable: MONGODB_ENVIRONMENT");
  }
  if (
    env.MONGODB_ENVIRONMENT === "production" &&
    !options.confirmProduction
  ) {
    throw new Error("Production writes require --confirm-production.");
  }

  const db = await getDb();
  const collection = db.collection("cards");
  await collection.createIndex({ legacyId: 1 }, { unique: true, name: "card_legacy_id_unique" });
  const operations = makeUpsertOperations(cards);
  const result = await collection.bulkWrite(operations, { ordered: true });
  return {
    mode: "apply",
    cards: cards.length,
    inserted: result.upsertedCount,
    alreadyExisted: result.matchedCount,
  };
}

if (require.main === module) {
  async function main() {
    let failed = false;
    try {
      const summary = await runMigration();
      console.log(JSON.stringify(summary));
    } catch (error) {
      const safeMessage = error.message.startsWith("Missing required server environment variable:")
        ? error.message
        : "Migration failed or was blocked. No record contents or credentials were printed.";
      console.error(safeMessage);
      failed = true;
    }

    try {
      await closeDb();
    } catch {
      console.error("Could not close the database connection cleanly.");
      failed = true;
    }

    if (failed) {
      process.exitCode = 1;
    }
  }

  main();
}

module.exports = {
  buildLegacyCards,
  loadLegacyStudents,
  makeUpsertOperations,
  parseArgs,
  runMigration,
  slugify,
};
