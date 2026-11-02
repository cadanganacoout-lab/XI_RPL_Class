const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const test = require("node:test");
const {
  findPublishedCardBySlug,
  findPublishedCards,
} = require("../api/_lib/repos/cards");
const { findPublicUserByUsername } = require("../api/_lib/repos/users");
const { COLLECTION_SCHEMAS } = require("../api/_lib/collection-schemas");
const {
  toPublicCard,
  toPublicUser,
  userDocumentSchema,
} = require("../api/_lib/schemas");
const { ensureCollection, INDEXES } = require("../scripts/create-indexes");
const { validateNewPassword } = require("../api/_lib/password");
const {
  clearSessionCookie,
  createSession,
  getCookieName,
  hashSessionToken,
  sessionCookie,
} = require("../api/_lib/session");
const { hashRateKey, incrementRateLimit } = require("../api/_lib/rate-limit");
const {
  changePasswordBodySchema,
  enforceLimit,
  registerBodySchema,
} = require("../api/_routes/auth");
const {
  buildLegacyCards,
  loadLegacyStudents,
  makeUpsertOperations,
} = require("../scripts/migrate-legacy");

test("legacy migration maps all students without adding deferred fields", () => {
  const cards = buildLegacyCards(loadLegacyStudents(), new Date("2026-01-01T00:00:00Z"));

  assert.equal(cards.length, 33);
  assert.equal(cards[0].legacyId, "s01");
  assert.equal(cards[0].sortOrder, 1);
  assert.equal(new Set(cards.map(card => card.legacyId)).size, 33);
  assert.equal(new Set(cards.map(card => card.slug)).size, 33);
  assert.ok(cards.every(card => card.ownerUserId === null && card.isPublished));
  assert.ok(cards.every(card => !("motto" in card) && !("background" in card)));
  assert.ok(cards.every(card => card.portfolio === undefined || card.portfolio.startsWith("https://")));
});

test("legacy migration upserts only missing cards and preserves existing edits", () => {
  const card = buildLegacyCards(loadLegacyStudents())[0];
  const [operation] = makeUpsertOperations([card]);
  assert.deepEqual(operation.updateOne.filter, { legacyId: "s01" });
  assert.deepEqual(operation.updateOne.update, { $setOnInsert: card });
  assert.equal(operation.updateOne.upsert, true);
  assert.equal("$set" in operation.updateOne.update, false);
});

test("public serializers omit internal identifiers and credentials", () => {
  const user = toPublicUser({
    _id: new ObjectId(),
    username: "student_01",
    displayName: "Student",
    role: "student",
    passwordHash: "$2b$10$private",
    cardId: new ObjectId(),
    isActive: true,
  });
  assert.deepEqual(user, {
    username: "student_01",
    displayName: "Student",
    role: "student",
  });

  const card = toPublicCard({
    _id: new ObjectId(),
    legacyId: "s01",
    slug: "student-one",
    nama: "Student One",
    jabatan: "Siswa",
    hobi: "Membaca",
    catatan: "-",
    foto: "asset/profil/student.png",
    portfolio: "https://example.com/",
    sortOrder: 1,
    ownerUserId: new ObjectId(),
    isPublished: true,
  });
  assert.deepEqual(Object.keys(card).sort(), [
    "catatan",
    "foto",
    "hobi",
    "id",
    "jabatan",
    "nama",
    "portfolio",
    "slug",
    "sortOrder",
  ]);
  assert.equal("ownerUserId" in card, false);
  assert.equal("_id" in card, false);
});

test("public card repository uses validated filters and field projections", async () => {
  let observedQuery;
  const activeOwnerId = new ObjectId();
  const card = {
    legacyId: "s01",
    slug: "student-one",
    nama: "Student One",
    jabatan: "Siswa",
    hobi: "-",
    catatan: "-",
    foto: "asset/profil/student.png",
    sortOrder: 1,
  };
  const db = {
    collection(name) {
      if (name === "users") {
        return {
          find(filter, options) {
            assert.deepEqual(filter, {
              role: { $in: ["student", "admin"] },
              isActive: true,
            });
            assert.deepEqual(options.projection, { _id: 1 });
            return { toArray: async () => [{ _id: activeOwnerId }] };
          },
        };
      }
      assert.equal(name, "cards");
      return {
        find(filter, options) {
          observedQuery = { filter, options };
          return {
            sort(sort) {
              assert.deepEqual(sort, { sortOrder: 1, legacyId: 1 });
              return { toArray: async () => [card] };
            },
          };
        },
        async findOne(filter, options) {
          observedQuery = { filter, options };
          return card;
        },
      };
    },
  };

  const cards = await findPublishedCards(db);
  assert.equal(cards.length, 1);
  assert.deepEqual(observedQuery.filter, {
    isPublished: true,
    $or: [
      { ownerUserId: null },
      { ownerUserId: { $in: [activeOwnerId] } },
    ],
  });
  assert.equal(observedQuery.options.projection.ownerUserId, undefined);
  assert.equal(observedQuery.options.projection._id, 0);

  await assert.rejects(findPublishedCardBySlug(db, { $ne: "" }));
  assert.deepEqual(await findPublishedCardBySlug(db, "student-one"), {
    id: "s01",
    slug: "student-one",
    nama: "Student One",
    jabatan: "Siswa",
    hobi: "-",
    catatan: "-",
    foto: "asset/profil/student.png",
    sortOrder: 1,
  });
  assert.deepEqual(observedQuery.filter, {
    slug: "student-one",
    isPublished: true,
    $or: [
      { ownerUserId: null },
      { ownerUserId: { $in: [activeOwnerId] } },
    ],
  });
});

test("user repository rejects query operators and exposes only public fields", async () => {
  let observedOptions;
  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        async findOne(filter, options) {
          assert.deepEqual(filter, {
            username: "sample_user",
            isActive: true,
          });
          observedOptions = options;
          return {
            username: "sample_user",
            displayName: "Sample User",
            role: "member",
          };
        },
      };
    },
  };

  await assert.rejects(findPublicUserByUsername(db, { $ne: "" }));
  assert.deepEqual(await findPublicUserByUsername(db, "SAMPLE_USER"), {
    username: "sample_user",
    displayName: "Sample User",
    role: "member",
  });
  assert.deepEqual(observedOptions.projection, {
    _id: 0,
    username: 1,
    displayName: 1,
    role: 1,
  });
});

test("member accounts cannot link student cards", () => {
  const member = {
    _id: new ObjectId(),
    username: "sample_user",
    displayName: "Sample User",
    passwordHash: "$2b$10$" + "a".repeat(53),
    role: "member",
    cardId: new ObjectId(),
    mustChangePassword: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };
  assert.equal(userDocumentSchema.safeParse(member).success, false);
});

test("signup and password-change schemas reject mass assignment", () => {
  const signup = {
    username: "New_Member",
    displayName: "New Member",
    password: "A-longer-password!",
  };
  assert.equal(registerBodySchema.parse(signup).username, "new_member");
  assert.equal(
    registerBodySchema.safeParse({ ...signup, role: "admin" }).success,
    false,
  );
  assert.equal(
    registerBodySchema.safeParse({
      ...signup,
      cardId: "507f1f77bcf86cd799439011",
    }).success,
    false,
  );
  assert.equal(
    changePasswordBodySchema.safeParse({
      currentPassword: "old-password",
      newPassword: "new-password-long",
      role: "admin",
    }).success,
    false,
  );
});

test("new passwords enforce byte length and common-password checks", () => {
  assert.throws(() => validateNewPassword("short", "student"));
  assert.throws(() => validateNewPassword("password123", "student"));
  assert.throws(() => validateNewPassword("welcome2025", "student"));
  assert.throws(() =>
    validateNewPassword("new-password-long", "NEW-PASSWORD-LONG"),
  );
  assert.throws(() => validateNewPassword("😀".repeat(19), "student"));
  assert.doesNotThrow(() =>
    validateNewPassword("unik-bukan-umum-2026", "student"),
  );
});

test("sessions store only a hash and apply safe cookie attributes", async () => {
  let storedSession;
  const db = {
    collection(name) {
      assert.equal(name, "sessions");
      return {
        async insertOne(session) {
          storedSession = session;
        },
      };
    },
  };
  const session = await createSession(db, new ObjectId(), "browser/1".repeat(40));
  const token = session.cookie.split(";")[0].split("=")[1];

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(storedSession._id, /^[a-f0-9]{64}$/);
  assert.notEqual(storedSession._id, token);
  assert.equal(hashSessionToken(token), storedSession._id);
  assert.equal(storedSession.userAgent.length, 200);
  assert.match(session.cookie, /HttpOnly/);
  assert.match(session.cookie, /SameSite=Lax/);
  assert.match(session.cookie, /Path=\//);
  assert.doesNotMatch(session.cookie, /Domain=/);
});

test("production session cookies use Secure and the __Host- prefix", () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalCookieName = process.env.SESSION_COOKIE_NAME;
  process.env.NODE_ENV = "production";
  process.env.SESSION_COOKIE_NAME = "xirpl1_session";
  try {
    assert.equal(getCookieName(), "__Host-xirpl1_session");
    assert.match(sessionCookie("opaque-token", 600), /; Secure/);
    assert.match(clearSessionCookie(), /; Secure/);
    assert.doesNotMatch(sessionCookie("opaque-token", 600), /Domain=/);
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
    if (originalCookieName === undefined) delete process.env.SESSION_COOKIE_NAME;
    else process.env.SESSION_COOKIE_NAME = originalCookieName;
  }
});

test("rate-limit identifiers are hashed and counters increment atomically", async () => {
  const records = new Map();
  const db = {
    collection(name) {
      assert.equal(name, "rate_limits");
      return {
        async findOneAndUpdate(filter, update) {
          const current = records.get(filter._id);
          if (!current || current.expiresAt <= filter.expiresAt.$gt) return null;
          current.count += update.$inc.count;
          return { count: current.count };
        },
        async updateOne(filter, update) {
          const current = records.get(filter._id);
          if (!current || current.expiresAt > filter.expiresAt.$lte) {
            return { modifiedCount: 0 };
          }
          records.set(filter._id, {
            count: update.$set.count,
            expiresAt: update.$set.expiresAt,
          });
          return { modifiedCount: 1 };
        },
        async insertOne(record) {
          if (records.has(record._id)) {
            const error = new Error("duplicate");
            error.code = 11000;
            throw error;
          }
          records.set(record._id, record);
        },
      };
    },
  };
  const parts = ["login-ip", "192.0.2.1"];

  assert.equal(await incrementRateLimit(db, parts, 900), 1);
  assert.equal(await incrementRateLimit(db, parts, 900), 2);
  assert.match(hashRateKey(parts), /^[a-f0-9]{64}$/);
  assert.equal(records.has(JSON.stringify(parts)), false);
});

test("auth rate limits return Retry-After when the threshold is exceeded", async () => {
  let count = 0;
  const db = {
    collection(name) {
      assert.equal(name, "rate_limits");
      return {
        async findOneAndUpdate() {
          count += 1;
          return { count };
        },
        async findOne() {
          return { count, expiresAt: new Date(Date.now() + 60_000) };
        },
      };
    },
  };
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  await enforceLimit(db, response, ["login", "user"], 1, 900);
  await assert.rejects(
    enforceLimit(db, response, ["login", "user"], 1, 900),
    error => error.status === 429 && error.code === "RATE_LIMITED",
  );
  assert.ok(Number(response.headers["Retry-After"]) > 0);
});

test("MongoDB indexes enforce unique ownership and TTL expiry", () => {
  assert.equal(INDEXES.users[0][1].unique, true);
  assert.equal(INDEXES.sessions[0][1].expireAfterSeconds, 0);
  assert.deepEqual(INDEXES.cards[2][1].partialFilterExpression, {
    ownerUserId: { $type: "objectId" },
  });
  assert.equal(INDEXES.rate_limits[0][1].expireAfterSeconds, 0);
  assert.equal(COLLECTION_SCHEMAS.messages, undefined);
});

test("index setup refuses to silently reuse collections with a different schema", async () => {
  const db = {
    listCollections() {
      return {
        async toArray() {
          return [{ options: { validator: { $jsonSchema: { bsonType: "object" } } } }];
        },
      };
    },
  };
  await assert.rejects(
    ensureCollection(db, "cards", COLLECTION_SCHEMAS.cards),
    /Collection schema requires review: cards/,
  );
});
