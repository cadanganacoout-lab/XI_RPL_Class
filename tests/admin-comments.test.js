const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { ObjectId } = require("mongodb");
const apiHandler = require("../api/[...path].js");
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

function createRequest(body, token) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  request.url = "/api/comments/admin";
  request.headers = {
    "content-type": "application/json",
    origin: "https://class.example",
    "x-requested-with": "fetch",
    ...(token ? { cookie: `${getCookieName()}=${token}` } : {}),
  };
  return request;
}

function createDatabase({ username = "admin", role = "admin" } = {}) {
  const token = "A".repeat(43);
  const userId = new ObjectId();
  const sessionId = hashSessionToken(token);
  const now = new Date();
  const user = {
    _id: userId,
    username,
    displayName: "Admin web",
    role,
    mustChangePassword: false,
    isActive: true,
    createdAt: now,
  };
  const session = {
    _id: sessionId,
    userId,
    expiresAt: new Date(now.getTime() + 60_000),
    lastSeenAt: now,
  };
  return {
    token,
    collection(name) {
      if (name === "sessions") {
        return {
          async findOne(filter) {
            return filter._id === sessionId ? session : null;
          },
          async updateOne() {
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "users") {
        return {
          async findOne(filter) {
            return filter._id?.equals(userId) ? user : null;
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

test("main admin comments use trusted account name and reject forged author fields", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase();
  const now = new Date().toISOString();
  let inserted;
  const handler = apiHandler.createHandler({
    getDatabase: async () => db,
    getSupabaseConfig: () => ({
      url: "https://comments.example/",
      serviceRoleKey: "server-only-key",
    }),
    fetchImpl: async (url, options) => {
      assert.equal(String(url), "https://comments.example/rest/v1/comments");
      assert.equal(options.headers.Authorization, "Bearer server-only-key");
      inserted = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return [{
            id: 12,
            content: inserted.content,
            parent_id: inserted.parent_id,
            created_at: now,
            author_name: inserted.author_name,
          }];
        },
      };
    },
  });

  try {
    const response = createResponse();
    await handler(createRequest({
      content: "  Pesan admin  ",
      parent_id: 4,
      author_name: "Palsu",
    }, db.token), response);
    assert.equal(response.statusCode, 400);
    assert.equal(inserted, undefined);

    const validResponse = createResponse();
    await handler(createRequest({
      content: "  Pesan admin  ",
      parent_id: 4,
    }, db.token), validResponse);
    assert.equal(validResponse.statusCode, 201);
    assert.deepEqual(inserted, {
      content: "Pesan admin",
      parent_id: 4,
      author_name: "Admin web",
    });
    assert.equal(JSON.parse(validResponse.body).comment.author_name, "Admin web");
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("only the main admin account may publish named comments", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase({ username: "another_admin" });
  let called = false;
  const handler = apiHandler.createHandler({
    getDatabase: async () => db,
    getSupabaseConfig: () => ({
      url: "https://comments.example/",
      serviceRoleKey: "server-only-key",
    }),
    fetchImpl: async () => {
      called = true;
      throw new Error("Should not send a request.");
    },
  });

  try {
    const response = createResponse();
    await handler(createRequest({ content: "Pesan" }, db.token), response);
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).error.code, "FORBIDDEN");
    assert.equal(called, false);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("Supabase schema errors give safe actionable feedback without exposing its response", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  const previousWarn = console.warn;
  process.env.APP_ORIGIN = "https://class.example";
  console.warn = () => {};
  const db = createDatabase();
  const handler = apiHandler.createHandler({
    getDatabase: async () => db,
    getSupabaseConfig: () => ({
      url: "https://comments.example/",
      serviceRoleKey: "server-only-key",
    }),
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      async json() {
        return {
          code: "PGRST204",
          message: "Could not find author_name. secret-value-must-not-escape",
        };
      },
    }),
  });

  test("Supabase permission errors are distinguished from invalid server keys", async () => {
    const { upstreamFailure } = require("../api/_routes/admin-comments");
    assert.equal(
      upstreamFailure({ status: 403 }, "42501").code,
      "COMMENT_SERVICE_PERMISSION",
    );
    assert.equal(
      upstreamFailure({ status: 401 }, "UNKNOWN").code,
      "COMMENT_SERVICE_AUTH",
    );
  });

  try {
    const response = createResponse();
    await handler(createRequest({ content: "Admin post" }, db.token), response);
    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 502);
    assert.equal(payload.error.code, "COMMENT_SCHEMA_MISSING");
    assert.match(payload.error.message, /author_name column/);
    assert.doesNotMatch(response.body, /secret-value-must-not-escape/);
  } finally {
    console.warn = previousWarn;
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});
