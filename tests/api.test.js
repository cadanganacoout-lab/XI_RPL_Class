const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { ObjectId } = require("mongodb");
const apiHandler = require("../api/[...path].js");
const { createHandler } = apiHandler;
const { handleContentRoute } = require("../api/_routes/content");
const { parseJsonBody } = require("../api/_lib/http");
const { requireSameOrigin } = require("../api/_lib/security");
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

function createJsonRequest(body, headers = {}) {
  const request = Readable.from([Buffer.from(body)]);
  request.headers = { "content-type": "application/json", ...headers };
  return request;
}

function createAuthDatabase() {
  const users = new Map();
  const sessions = new Map();
  const rateLimits = new Map();

  return {
    users,
    sessions,
    collection(name) {
      if (name === "users") {
        return {
          async insertOne(user) {
            if (users.has(user.username)) {
              const error = new Error("duplicate");
              error.code = 11000;
              throw error;
            }
            users.set(user.username, user);
          },
          async findOne(filter) {
            const user = filter.username
              ? users.get(filter.username)
              : [...users.values()].find(item => item._id.equals(filter._id));
            if (!user || (filter.isActive && !user.isActive)) return null;
            return user;
          },
          async updateOne(filter, update) {
            const user = [...users.values()].find(item => item._id.equals(filter._id));
            if (!user || (filter.isActive && !user.isActive)) {
              return { matchedCount: 0 };
            }
            Object.assign(user, update.$set);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "sessions") {
        return {
          async insertOne(session) {
            sessions.set(session._id, session);
          },
          async findOne(filter) {
            const session = sessions.get(filter._id);
            if (!session || session.expiresAt <= filter.expiresAt.$gt) return null;
            return session;
          },
          async deleteOne(filter) {
            return { deletedCount: Number(sessions.delete(filter._id)) };
          },
          async deleteMany(filter) {
            let deletedCount = 0;
            for (const [id, session] of sessions) {
              if (session.userId.equals(filter.userId)) {
                sessions.delete(id);
                deletedCount += 1;
              }
            }
            return { deletedCount };
          },
          async updateOne() {
            return { matchedCount: 1 };
          },
        };
      }
      return {
        async findOne(filter) {
          const entry = rateLimits.get(filter._id);
          if (!entry || entry.expiresAt <= filter.expiresAt.$gt) return null;
          return entry;
        },
        async findOneAndUpdate(filter, update) {
          const entry = rateLimits.get(filter._id);
          if (!entry || entry.expiresAt <= filter.expiresAt.$gt) return null;
          entry.count += update.$inc.count;
          return entry;
        },
        async updateOne(filter, update) {
          const entry = rateLimits.get(filter._id);
          if (!entry || entry.expiresAt > filter.expiresAt.$lte) {
            return { modifiedCount: 0 };
          }
          rateLimits.set(filter._id, update.$set);
          return { modifiedCount: 1 };
        },
        async insertOne(entry) {
          if (rateLimits.has(entry._id)) {
            const error = new Error("duplicate");
            error.code = 11000;
            throw error;
          }
          rateLimits.set(entry._id, entry);
        },
        async deleteOne(filter) {
          return { deletedCount: Number(rateLimits.delete(filter._id)) };
        },
      };
    },
  };
}

test("health endpoint returns only the minimal health response", async () => {
  const response = createResponse();
  await apiHandler(
    { method: "GET", url: "/api/health", headers: {} },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  assert.equal(response.headers["cache-control"], "no-store");
});

test("rewritten nested routes dispatch using the original API route", async () => {
  const handler = createHandler({ getDatabase: async () => createAuthDatabase() });
  const response = createResponse();
  await handler(
    {
      method: "GET",
      url: "/api/[...path]?route=auth%2Fme",
      headers: {},
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { user: null });
});

test("health endpoint rejects non-GET methods without internal details", async () => {
  const response = createResponse();
  await apiHandler(
    { method: "POST", url: "/api/health", headers: {} },
    response,
  );

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "GET");
  const body = JSON.parse(response.body);
  assert.equal(body.error.code, "METHOD_NOT_ALLOWED");
  assert.equal(body.error.message, "Method not allowed.");
  assert.match(body.error.requestId, /^[0-9a-f-]{36}$/);
});

test("unknown API routes return a generic not-found response", async () => {
  const response = createResponse();
  await apiHandler(
    { method: "GET", url: "/api/private-route", headers: {} },
    response,
  );

  assert.equal(response.statusCode, 404);
  const body = JSON.parse(response.body);
  assert.equal(body.error.code, "NOT_FOUND");
  assert.equal(body.error.message, "Route not found.");
  assert.match(body.error.requestId, /^[0-9a-f-]{36}$/);
});

test("JSON body parsing rejects invalid and oversized requests", async () => {
  await assert.rejects(
    parseJsonBody(createJsonRequest("{invalid}")),
    error => error.status === 400 && error.code === "INVALID_JSON",
  );
  await assert.rejects(
    parseJsonBody(createJsonRequest('{"a":1}', { "content-length": "7" }), {
      maxBytes: 6,
    }),
    error => error.status === 413 && error.code === "BODY_TOO_LARGE",
  );
  await assert.rejects(
    parseJsonBody(createJsonRequest('{"a":1}'), { maxBytes: 6 }),
    error => error.status === 413 && error.code === "BODY_TOO_LARGE",
  );
});

test("mutating request origin and CSRF header are both required", () => {
  const originalOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  try {
    assert.doesNotThrow(() =>
      requireSameOrigin({
        headers: {
          origin: "https://class.example",
          "x-requested-with": "fetch",
        },
      }),
    );
    assert.throws(
      () =>
        requireSameOrigin({
          headers: {
            origin: "https://attacker.example",
            "x-requested-with": "fetch",
          },
        }),
      error => error.status === 403 && error.code === "INVALID_ORIGIN",
    );
    assert.throws(
      () => requireSameOrigin({ headers: { origin: "https://class.example" } }),
      error => error.status === 403 && error.code === "CSRF_CHECK_FAILED",
    );
  } finally {
    if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = originalOrigin;
  }
});

test("auth mutation rejects foreign origins before opening the database", async () => {
  const originalOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  let databaseCalls = 0;
  const handler = createHandler({
    async getDatabase() {
      databaseCalls += 1;
      throw new Error("Database should not be reached.");
    },
  });
  const response = createResponse();
  try {
    await handler(
      {
        method: "POST",
        url: "/api/auth/register",
        headers: {
          origin: "https://attacker.example",
          "x-requested-with": "fetch",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(databaseCalls, 0);
  } finally {
    if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = originalOrigin;
  }
});

test("public member profile response omits internal account fields", async () => {
  const response = createResponse();
  const userId = new ObjectId();
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        async findOne(filter, options) {
          assert.deepEqual(filter, { username: "public_member", isActive: true });
          assert.equal(options.projection.passwordHash, undefined);
          return {
            _id: userId,
            username: "public_member",
            displayName: "Public Member",
            role: "member",
            cardId: null,
            createdAt,
            passwordHash: "must-not-return",
            isActive: true,
          };
        },
      };
    },
  };
  await handleContentRoute({
    request: { method: "GET", headers: {} },
    response,
    route: "profiles/public_member",
    db,
  });

  assert.deepEqual(JSON.parse(response.body), {
    user: {
      username: "public_member",
      displayName: "Public Member",
      role: "member",
      joinedAt: createdAt.toISOString(),
    },
    card: null,
  });
});

test("temporary-password sessions cannot access public content APIs", async () => {
  const token = "A".repeat(43);
  const userId = new ObjectId();
  const now = new Date();
  const sessionId = hashSessionToken(token);
  const user = {
    _id: userId,
    username: "temporary_user",
    displayName: "Temporary User",
    role: "member",
    cardId: null,
    mustChangePassword: true,
    isActive: true,
  };
  const db = {
    collection(name) {
      if (name === "sessions") {
        return {
          async findOne(filter) {
            assert.equal(filter._id, sessionId);
            assert.ok(filter.expiresAt.$gt instanceof Date);
            return {
              _id: sessionId,
              userId,
              expiresAt: new Date(now.getTime() + 60_000),
              lastSeenAt: now,
            };
          },
        };
      }
      if (name === "users") {
        return {
          async findOne() {
            return user;
          },
        };
      }
      assert.fail(`Unexpected collection access: ${name}`);
    },
  };
  const request = {
    method: "GET",
    headers: { cookie: `${getCookieName()}=${token}` },
  };
  const response = createResponse();

  await assert.rejects(
    handleContentRoute({ request, response, route: "profiles/public_member", db }),
    error => error.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED",
  );
  assert.equal(response.statusCode, 0);
});

test("member signup, login, me, and logout use opaque revocable sessions without self-editing credentials", async () => {
  const originalOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createAuthDatabase();
  const handler = createHandler({ getDatabase: async () => db });
  const headers = {
    "content-type": "application/json",
    origin: "https://class.example",
    "x-requested-with": "fetch",
    "x-forwarded-for": "192.0.2.15",
    "user-agent": "test-browser",
  };
  try {
    const signupResponse = createResponse();
    const signupRequest = createJsonRequest(
      JSON.stringify({
        username: "New_Member",
        displayName: "New Member",
        password: "Green-sky-robot-48!",
      }),
      headers,
    );
    signupRequest.method = "POST";
    signupRequest.url = "/api/auth/register";
    await handler(signupRequest, signupResponse);

    assert.equal(signupResponse.statusCode, 201);
    const signupBody = JSON.parse(signupResponse.body);
    assert.equal(signupBody.user.role, "member");
    assert.equal("passwordHash" in signupBody.user, false);
    const user = db.users.get("new_member");
    assert.ok(user.passwordHash.startsWith("$2"));
    assert.equal(db.sessions.size, 1);
    const oldCookie = signupResponse.headers["set-cookie"];
    const oldToken = oldCookie.split(";")[0].split("=")[1];
    assert.equal(signupResponse.body.includes(oldToken), false);

    const loginResponse = createResponse();
    const loginRequest = createJsonRequest(
      JSON.stringify({
        username: "NEW_MEMBER",
        password: "Green-sky-robot-48!",
      }),
      { ...headers, cookie: oldCookie.split(";")[0] },
    );
    loginRequest.method = "POST";
    loginRequest.url = "/api/auth/login";
    await handler(loginRequest, loginResponse);

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(db.sessions.size, 1);
    const newCookie = loginResponse.headers["set-cookie"];
    assert.notEqual(newCookie.split(";")[0], oldCookie.split(";")[0]);

    const changeResponse = createResponse();
    const changeRequest = createJsonRequest(
      JSON.stringify({
        currentPassword: "Green-sky-robot-48!",
        newPassword: "Bright-night-rocket-52!",
      }),
      { ...headers, cookie: newCookie.split(";")[0] },
    );
    changeRequest.method = "POST";
    changeRequest.url = "/api/auth/change-password";
    await handler(changeRequest, changeResponse);

    assert.equal(changeResponse.statusCode, 403);
    assert.equal(db.sessions.size, 1);
    const changedCookie = newCookie;

    const meResponse = createResponse();
    await handler(
      {
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: changedCookie.split(";")[0] },
      },
      meResponse,
    );
    assert.equal(JSON.parse(meResponse.body).user.username, "new_member");

    const oldSessionResponse = createResponse();
    await handler(
      {
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: oldCookie.split(";")[0] },
      },
      oldSessionResponse,
    );
    assert.deepEqual(JSON.parse(oldSessionResponse.body), { user: null });

    const logoutResponse = createResponse();
    const logoutRequest = createJsonRequest("{}", {
      ...headers,
      cookie: changedCookie.split(";")[0],
    });
    logoutRequest.method = "POST";
    logoutRequest.url = "/api/auth/logout";
    await handler(logoutRequest, logoutResponse);
    assert.equal(logoutResponse.statusCode, 200);
    assert.equal(db.sessions.size, 0);

    const revokedResponse = createResponse();
    await handler(
      {
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: changedCookie.split(";")[0] },
      },
      revokedResponse,
    );
    assert.deepEqual(JSON.parse(revokedResponse.body), { user: null });
  } finally {
    if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = originalOrigin;
  }
});

test("signup rejects role escalation and extra fields with a safe 400", async () => {
  const originalOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createAuthDatabase();
  const handler = createHandler({ getDatabase: async () => db });
  const request = createJsonRequest(
    JSON.stringify({
      username: "attacker",
      displayName: "Attacker",
      password: "Green-sky-robot-48!",
      role: "admin",
    }),
    {
      "content-type": "application/json",
      origin: "https://class.example",
      "x-requested-with": "fetch",
    },
  );
  request.method = "POST";
  request.url = "/api/auth/register";
  const response = createResponse();

  try {
    await handler(request, response);
    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error.code, "INVALID_REQUEST");
    assert.equal(body.error.message, "The request is invalid.");
    assert.match(body.error.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(db.users.size, 0);
  } finally {
    if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = originalOrigin;
  }
});
