const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const { verifyPassword } = require("../api/_lib/password");
const {
  createAdmin,
  createStudent,
  confirmWrite,
  generateTemporaryPassword,
  parseOptions,
  requireDatabaseTarget,
  resetPassword,
  setActive,
} = require("../scripts/_lib/admin-users");

const databaseEnv = {
  MONGODB_DB: "class-dev",
  MONGODB_ENVIRONMENT: "development",
};

function createDatabase({ cardOwnerUserId = null } = {}) {
  const users = new Map();
  const card = {
    _id: new ObjectId(),
    slug: "student-one",
    ownerUserId: cardOwnerUserId,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const calls = { userInserts: 0, cardUpdates: 0, deletedSessions: 0 };
  const db = {
    users,
    card,
    calls,
    collection(name) {
      if (name === "users") {
        return {
          async findOne(filter) {
            if (filter.username) return users.get(filter.username) || null;
            return (
              [...users.values()].find(user => user._id.equals(filter._id)) ||
              null
            );
          },
          async insertOne(user) {
            calls.userInserts += 1;
            if (users.has(user.username)) {
              const error = new Error("duplicate key");
              error.code = 11000;
              throw error;
            }
            users.set(user.username, user);
          },
          async updateOne(filter, update) {
            const user = [...users.values()].find(
              value => value._id.equals(filter._id),
            );
            if (!user) return { matchedCount: 0 };
            Object.assign(user, update.$set);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "cards") {
        return {
          async findOne(filter) {
            return card.slug === filter.slug ? card : null;
          },
          async updateOne(filter, update) {
            calls.cardUpdates += 1;
            if (
              !card._id.equals(filter._id) ||
              card.ownerUserId !== filter.ownerUserId
            ) {
              return { matchedCount: 0 };
            }
            Object.assign(card, update.$set);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "sessions") {
        return {
          async deleteMany(filter) {
            calls.deletedSessions += 1;
            return { deletedCount: 2, filter };
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
  return db;
}

function dependencies(db) {
  return {
    db,
    env: databaseEnv,
    now: new Date("2026-02-01T00:00:00Z"),
    async confirmWrite() {},
  };
}

test("admin CLI parses only known options and rejects duplicates", () => {
  assert.deepEqual(
    parseOptions(
      ["--username", "admin_01", "--dry-run", "--confirm-db", "class-dev"],
      ["username", "confirm-db"],
      ["dry-run"],
    ),
    { username: "admin_01", "dry-run": true, "confirm-db": "class-dev" },
  );
  assert.throws(
    () =>
      parseOptions(
        ["--username", "admin_01", "--username", "admin_02"],
        ["username"],
      ),
    /Duplicate option/,
  );
  assert.throws(
    () => parseOptions(["--role", "admin"], ["username"]),
    /Unknown option/,
  );
});

test("temporary passwords use the required length", () => {
  assert.equal(generateTemporaryPassword().length, 16);
});

test("database writes require exact target and an explicit production flag", async () => {
  const productionEnv = {
    ...databaseEnv,
    MONGODB_DB: "class-prod",
    MONGODB_ENVIRONMENT: "production",
  };
  assert.throws(
    () => requireDatabaseTarget({ "confirm-db": "class-prod" }, productionEnv),
    /--confirm-production/,
  );
  assert.equal(
    requireDatabaseTarget(
      {
        "confirm-db": "class-prod",
        "confirm-production": true,
      },
      productionEnv,
    ).MONGODB_DB,
    "class-prod",
  );

  const input = new PassThrough();
  const output = new PassThrough();
  input.isTTY = true;
  output.isTTY = true;
  const confirmation = confirmWrite("class-dev", "development", input, output);
  input.write("ya\n");
  await confirmation;
  input.destroy();
  output.destroy();
});

test("admin creation is dry-run safe and requires the exact database target", async () => {
  const db = createDatabase();
  const dryRun = await createAdmin(
    {
      username: "Admin_01",
      name: "Site Admin",
      "confirm-db": "class-dev",
      "dry-run": true,
    },
    dependencies(db),
  );
  assert.deepEqual(dryRun, {
    mode: "dry-run",
    role: "admin",
    username: "admin_01",
  });
  assert.equal(db.calls.userInserts, 0);

  await assert.rejects(
    createAdmin(
      {
        username: "admin_02",
        name: "Another Admin",
        "confirm-db": "wrong-db",
        "dry-run": true,
      },
      dependencies(db),
    ),
    /exact configured MONGODB_DB/,
  );
});

test("student creation claims an unowned card and requires password rotation", async () => {
  const db = createDatabase();
  const result = await createStudent(
    {
      username: "Student_01",
      name: "Student One",
      card: "student-one",
      "confirm-db": "class-dev",
    },
    dependencies(db),
  );

  const user = db.users.get("student_01");
  assert.equal(result.role, "student");
  assert.equal(result.card, "student-one");
  assert.equal(await verifyPassword(result.password, user.passwordHash), true);
  assert.equal(user.mustChangePassword, true);
  assert.equal(user.cardId.equals(db.card._id), true);
  assert.equal(db.card.ownerUserId.equals(user._id), true);
});

test("student creation refuses a card that already has an owner", async () => {
  const db = createDatabase({ cardOwnerUserId: new ObjectId() });
  await assert.rejects(
    createStudent(
      {
        username: "Student_02",
        name: "Student Two",
        card: "student-one",
        "confirm-db": "class-dev",
        "dry-run": true,
      },
      dependencies(db),
    ),
    /already has an account owner/,
  );
  assert.equal(db.calls.userInserts, 0);
});

test("password reset revokes sessions and marks the new password temporary", async () => {
  const db = createDatabase();
  const userId = new ObjectId();
  db.users.set("member_01", {
    _id: userId,
    username: "member_01",
    passwordHash: "old-hash",
    mustChangePassword: false,
  });
  const result = await resetPassword(
    {
      username: "MEMBER_01",
      "confirm-db": "class-dev",
    },
    dependencies(db),
  );
  const user = db.users.get("member_01");
  assert.equal(db.calls.deletedSessions, 1);
  assert.equal(user.mustChangePassword, true);
  assert.equal(await verifyPassword(result.password, user.passwordHash), true);
});

test("deactivating an account revokes its sessions", async () => {
  const db = createDatabase();
  db.users.set("member_02", {
    _id: new ObjectId(),
    username: "member_02",
    isActive: true,
  });
  await setActive(
    {
      username: "member_02",
      active: "false",
      "confirm-db": "class-dev",
    },
    dependencies(db),
  );
  assert.equal(db.users.get("member_02").isActive, false);
  assert.equal(db.calls.deletedSessions, 1);
});
