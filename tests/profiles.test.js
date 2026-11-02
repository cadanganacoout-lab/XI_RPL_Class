const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { ObjectId } = require("mongodb");
const apiHandler = require("../api/[...path].js");
const { hashPassword } = require("../api/_lib/password");
const { getCookieName, hashSessionToken } = require("../api/_lib/session");

function createResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = "") {
      this.body += value;
      this.writableEnded = true;
    },
  };
}

function createRequest(method, url, { body, headers = {} } = {}) {
  const request = Readable.from(
    body === undefined ? [] : [Buffer.from(JSON.stringify(body))],
  );
  request.method = method;
  request.url = url;
  request.headers = { ...headers };
  if (body !== undefined) request.headers["content-type"] = "application/json";
  return request;
}

function createDatabase({ role = "student", isActive = true, mustChangePassword = false } = {}) {
  const userId = new ObjectId();
  const cardId = new ObjectId();
  const token = "A".repeat(43);
  const sessionId = hashSessionToken(token);
  const now = new Date("2026-01-01T00:00:00.000Z");
  const user = {
    _id: userId,
    username: role === "member" ? "member_01" : "student_01",
    displayName: "Test User",
    role,
    cardId: role === "member" ? null : cardId,
    passwordHash: "$2b$12$" + "A".repeat(53),
    createdAt: now,
    updatedAt: now,
    mustChangePassword,
    isActive,
    lastLoginAt: now,
  };
  const session = {
    _id: sessionId,
    userId,
    expiresAt: new Date(now.getTime() + 60_000),
    lastSeenAt: now,
  };
  const card = {
    _id: cardId,
    legacyId: "s01",
    slug: "student-one",
    nama: "Student One",
    jabatan: "Siswa",
    hobi: "Membaca",
    catatan: "-",
    foto: "asset/profil/student-one.webp",
    sortOrder: 1,
    ownerUserId: userId,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  };
  const calls = { userUpdateFilter: null, userUpdate: null, rateLimitCount: 0 };
  const db = {
    user,
    card,
    token,
    calls,
    collection(name) {
      if (name === "sessions") {
        return {
          async insertOne() {
            return { acknowledged: true };
          },
          async findOne(filter) {
            return filter._id === sessionId ? session : null;
          },
          async updateOne() {
            return { matchedCount: 1 };
          },
          async deleteMany() {
            return { deletedCount: 1 };
          },
        };
      }
      if (name === "users") {
        return {
          async findOne(filter) {
            if (filter.username) {
              return filter.username === user.username && user.isActive ? user : null;
            }
            return filter._id?.equals(userId) && (!filter.isActive || user.isActive)
              ? user
              : null;
          },
          async updateOne(filter, update) {
            calls.userUpdateFilter = filter;
            calls.userUpdate = update;
            const roleAllowed = !filter.role || filter.role.$in.includes(user.role);
            if (
              !filter._id.equals(userId) ||
              !filter.isActive ||
              !user.isActive ||
              !roleAllowed
            ) {
              return { matchedCount: 0 };
            }
            Object.assign(user, update.$set);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "cards") {
        return {
          async findOne(filter) {
            if (filter.ownerUserId && !filter.ownerUserId.equals(userId)) return null;
            if (filter._id && !filter._id.equals(cardId)) return null;
            if (filter.isPublished && !card.isPublished) return null;
            return card;
          },
        };
      }
      if (name === "rate_limits") {
        return {
          async findOneAndUpdate() {
            calls.rateLimitCount += 1;
            return { count: calls.rateLimitCount };
          },
          async findOne() {
            return {
              count: calls.rateLimitCount,
              expiresAt: new Date(Date.now() + 60_000),
            };
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
  return db;
}

function sessionHeaders(db) {
  return {
    cookie: `${getCookieName()}=${db.token}`,
    origin: "https://class.example",
    "x-requested-with": "fetch",
  };
}

test("public profile API returns only safe identity fields and a published student card", async () => {
  const db = createDatabase();
  const response = createResponse();
  await apiHandler.createHandler({ getDatabase: async () => db })(
    createRequest("GET", "/api/profile/student_01"),
    response,
  );

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.deepEqual(payload.user, {
    username: "student_01",
    displayName: "Test User",
    role: "student",
    joinedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(payload.card.id, "s01");
  for (const field of [
    "_id",
    "passwordHash",
    "mustChangePassword",
    "isActive",
    "lastLoginAt",
    "userAgent",
    "session",
  ]) {
    assert.equal(field in payload.user, false);
  }
});

test("own profile endpoint uses the authenticated account and omits internal fields", async () => {
  const db = createDatabase();
  const response = createResponse();
  await apiHandler.createHandler({ getDatabase: async () => db })(
    createRequest("GET", "/api/profile/me", {
      headers: sessionHeaders(db),
    }),
    response,
  );

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.user.username, db.user.username);
  assert.equal(payload.user.joinedAt, db.user.createdAt.toISOString());
  assert.equal(payload.mustChangePassword, false);
  assert.equal(payload.card.id, "s01");
  assert.equal("passwordHash" in payload.user, false);
  assert.equal("_id" in payload.user, false);
});

test("inactive, missing, and admin profiles have the same generic not-found response", async () => {
  const responses = [];
  for (const [options, username] of [
    [{ isActive: false }, "student_01"],
    [{}, "unknown_user"],
    [{ role: "admin" }, "student_01"],
  ]) {
    const db = createDatabase(options);
    const response = createResponse();
    await apiHandler.createHandler({ getDatabase: async () => db })(
      createRequest("GET", `/api/profile/${username}`),
      response,
    );
    assert.equal(response.statusCode, 404);
    const body = JSON.parse(response.body);
    delete body.error.requestId;
    responses.push(body);
  }
  assert.deepEqual(responses[0], responses[1]);
  assert.deepEqual(responses[0], responses[2]);
});

test("profile edits require authentication, student/admin role, same origin, and strict fields", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  try {
    const anonymousDb = createDatabase();
    const anonymousResponse = createResponse();
    await apiHandler.createHandler({ getDatabase: async () => anonymousDb })(
      createRequest("PATCH", "/api/profile/me", {
        body: { displayName: "Changed Name" },
        headers: { origin: "https://class.example", "x-requested-with": "fetch" },
      }),
      anonymousResponse,
    );
    assert.equal(anonymousResponse.statusCode, 401);

    const memberDb = createDatabase({ role: "member" });
    const memberResponse = createResponse();
    await apiHandler.createHandler({ getDatabase: async () => memberDb })(
      createRequest("PATCH", "/api/profile/me", {
        body: { displayName: "Changed Name" },
        headers: sessionHeaders(memberDb),
      }),
      memberResponse,
    );
    assert.equal(memberResponse.statusCode, 403);

    let databaseCalls = 0;
    const csrfResponse = createResponse();
    await apiHandler.createHandler({
      getDatabase: async () => {
        databaseCalls += 1;
        throw new Error("Database must not be opened.");
      },
    })(
      createRequest("PATCH", "/api/profile/me", {
        body: { displayName: "Changed Name" },
        headers: {
          origin: "https://attacker.example",
          "x-requested-with": "fetch",
        },
      }),
      csrfResponse,
    );
    assert.equal(csrfResponse.statusCode, 403);
    assert.equal(databaseCalls, 0);

    const studentDb = createDatabase();
    const handler = apiHandler.createHandler({ getDatabase: async () => studentDb });
    const massAssignmentResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/profile/me", {
        body: { displayName: "Changed Name", role: "admin", username: "root" },
        headers: sessionHeaders(studentDb),
      }),
      massAssignmentResponse,
    );
    assert.equal(massAssignmentResponse.statusCode, 400);
    assert.equal(studentDb.user.displayName, "Test User");

    const invalidNameResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/profile/me", {
        body: { displayName: "Bad\u0000Name" },
        headers: sessionHeaders(studentDb),
      }),
      invalidNameResponse,
    );
    assert.equal(invalidNameResponse.statusCode, 400);
    assert.equal(studentDb.user.displayName, "Test User");

    const updateResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/profile/me", {
        body: { displayName: "  Changed Name  " },
        headers: sessionHeaders(studentDb),
      }),
      updateResponse,
    );
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(studentDb.user.displayName, "Changed Name");
    assert.deepEqual(Object.keys(studentDb.calls.userUpdate.$set).sort(), [
      "displayName",
      "updatedAt",
    ]);
    assert.ok(studentDb.calls.userUpdate.$set.updatedAt instanceof Date);
    assert.equal(studentDb.calls.userUpdateFilter._id.equals(studentDb.user._id), true);
    assert.equal(studentDb.calls.userUpdateFilter.role.$in.includes("member"), false);
    assert.equal(updateResponse.headers["cache-control"], "no-store");
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("profile edits are limited to ten requests per hour", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase();
  const handler = apiHandler.createHandler({ getDatabase: async () => db });
  try {
    let lastResponse;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      lastResponse = createResponse();
      await handler(
        createRequest("PATCH", "/api/profile/me", {
          body: { displayName: `Name ${attempt}` },
          headers: sessionHeaders(db),
        }),
        lastResponse,
      );
    }
    assert.equal(lastResponse.statusCode, 429);
    assert.equal(lastResponse.headers["retry-after"], "60");
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("members can change credentials only when rotating an admin-issued temporary password", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  try {
    const db = createDatabase({ role: "member" });
    const handler = apiHandler.createHandler({ getDatabase: async () => db });
    const response = createResponse();
    await handler(
      createRequest("POST", "/api/auth/change-password", {
        body: {
          currentPassword: "temporary-password",
          newPassword: "New-Strong-Password-48!",
        },
        headers: sessionHeaders(db),
      }),
      response,
    );
    assert.equal(response.statusCode, 403);
    assert.equal(db.calls.rateLimitCount, 0);

    db.user.mustChangePassword = true;
    db.user.passwordHash = await hashPassword(
      "Current-Strong-Password-48!",
      db.user.username,
    );
    const rotationResponse = createResponse();
    await handler(
      createRequest("POST", "/api/auth/change-password", {
        body: {
          currentPassword: "Current-Strong-Password-48!",
          newPassword: "New-Strong-Password-48!",
        },
        headers: sessionHeaders(db),
      }),
      rotationResponse,
    );
    assert.equal(rotationResponse.statusCode, 200);
    assert.equal(db.user.mustChangePassword, false);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});
