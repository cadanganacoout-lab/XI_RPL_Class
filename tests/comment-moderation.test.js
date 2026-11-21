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

function createRequest(method, url, body, { token, ip = "203.0.113.8", sameOrigin = true } = {}) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = url;
  request.headers = {
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(sameOrigin ? {
      origin: "https://class.example",
      "x-requested-with": "fetch",
    } : {}),
    ...(ip ? { "x-forwarded-for": ip } : {}),
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
  const rateLimits = new Map();
  const reports = [];

  return {
    token,
    reports,
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
      if (name === "rate_limits") {
        return {
          async findOne(filter) {
            const entry = rateLimits.get(filter._id);
            return entry && entry.expiresAt > filter.expiresAt.$gt ? entry : null;
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
        };
      }
      if (name === "comment_reports") {
        return {
          async findOne(filter) {
            return reports.find(item =>
              item._id.equals(filter._id) && item.status === filter.status,
            ) || null;
          },
          async updateOne(filter, update, options = {}) {
            const report = filter._id
              ? reports.find(item =>
                item._id.equals(filter._id) && item.status === filter.status,
              )
              : reports.find(item =>
                item.commentId === filter.commentId && item.reason === filter.reason,
              );
            if (report) {
              Object.assign(report, update.$set);
              if (update.$inc) report.reportCount += update.$inc.reportCount;
              for (const key of Object.keys(update.$unset || {})) delete report[key];
              return { matchedCount: 1 };
            }
            if (options.upsert) {
              reports.push({
                _id: new ObjectId(),
                ...update.$setOnInsert,
                ...update.$set,
                ...update.$inc,
              });
              return { matchedCount: 0, upsertedCount: 1 };
            }
            return { matchedCount: 0 };
          },
          find(filter) {
            let result = reports.filter(report => report.status === filter.status);
            return {
              sort() {
                result = [...result].sort((a, b) => b.createdAt - a.createdAt);
                return this;
              },
              limit(count) {
                result = result.slice(0, count);
                return this;
              },
              async toArray() {
                return result;
              },
            };
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

function createHandler(db, fetchImpl = async () => ({ ok: true })) {
  return apiHandler.createHandler({
    getDatabase: async () => db,
    getSupabaseConfig: () => ({
      url: "https://comments.example/",
      serviceRoleKey: "sb_secret_server-only-key",
    }),
    fetchImpl,
  });
}

test("anonymous comments use a server-side 30-second per-IP cooldown", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase();
  const sent = [];
  const handler = createHandler(db, async (url, options) => {
    sent.push({ url: String(url), options });
    return { ok: true };
  });

  try {
    const first = createResponse();
    await handler(createRequest("POST", "/api/comments", { content: "  Halo kelas  " }), first);
    assert.equal(first.statusCode, 201);
    assert.deepEqual(JSON.parse(first.body), { ok: true });
    assert.equal(sent[0].url, "https://comments.example/rest/v1/comments");
    assert.equal(sent[0].options.headers.apikey, "sb_secret_server-only-key");
    assert.equal(sent[0].options.headers.Prefer, "return=minimal");
    assert.deepEqual(JSON.parse(sent[0].options.body), {
      content: "Halo kelas",
      parent_id: null,
    });

    const blocked = createResponse();
    await handler(createRequest("POST", "/api/comments", { content: "Pesan kedua" }), blocked);
    assert.equal(blocked.statusCode, 429);
    assert.equal(JSON.parse(blocked.body).error.code, "COMMENT_COOLDOWN");
    assert.ok(Number(blocked.headers["retry-after"]) > 0);
    assert.equal(sent.length, 1);

    const otherVisitor = createResponse();
    await handler(createRequest("POST", "/api/comments", { content: "Pengunjung lain" }, {
      ip: "203.0.113.9",
    }), otherVisitor);
    assert.equal(otherVisitor.statusCode, 201);
    assert.equal(sent.length, 2);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("anonymous comments reject forged fields and cross-origin submissions", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const handler = createHandler(createDatabase());

  try {
    const forged = createResponse();
    await handler(createRequest("POST", "/api/comments", {
      content: "Pesan",
      author_name: "Admin palsu",
    }), forged);
    assert.equal(forged.statusCode, 400);

    const crossOrigin = createResponse();
    await handler(createRequest("POST", "/api/comments", { content: "Pesan" }, {
      sameOrigin: false,
    }), crossOrigin);
    assert.equal(crossOrigin.statusCode, 403);
    assert.equal(JSON.parse(crossOrigin.body).error.code, "INVALID_ORIGIN");
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("reports are stored for the main admin queue and can be marked reviewed", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase();
  let lookups = 0;
  const handler = createHandler(db, async (url, options) => {
    lookups += 1;
    assert.equal(options.method, undefined);
    assert.match(String(url), /id=eq\.17/);
    return {
      ok: true,
      async json() {
        return [{ id: 17, content: "Komentar yang dilaporkan" }];
      },
    };
  });

  try {
    const submitted = createResponse();
    await handler(createRequest("POST", "/api/comments/report", {
      comment_id: 17,
      reason: "personal_info",
    }), submitted);
    assert.equal(submitted.statusCode, 201);
    assert.equal(db.reports.length, 1);
    assert.equal(db.reports[0].commentContent, "Komentar yang dilaporkan");
    assert.equal(db.reports[0].status, "pending");
    assert.equal(db.reports[0].reportCount, 1);

    const duplicate = createResponse();
    await handler(createRequest("POST", "/api/comments/report", {
      comment_id: 17,
      reason: "personal_info",
    }), duplicate);
    assert.equal(duplicate.statusCode, 201);
    assert.equal(db.reports.length, 1);
    assert.equal(db.reports[0].reportCount, 2);

    const queue = createResponse();
    await handler(createRequest("GET", "/api/comments/reports", undefined, {
      token: db.token,
      ip: null,
    }), queue);
    const payload = JSON.parse(queue.body);
    assert.equal(queue.statusCode, 200);
    assert.equal(payload.reports[0].commentContent, "Komentar yang dilaporkan");
    assert.equal(lookups, 2);

    const reviewed = createResponse();
    await handler(createRequest("POST", "/api/comments/reports/review", {
      report_id: payload.reports[0].id,
    }, { token: db.token }), reviewed);
    assert.equal(reviewed.statusCode, 200);
    assert.equal(db.reports[0].status, "reviewed");
    assert.equal(db.reports[0].commentContent, undefined);

    const anonymous = createResponse();
    await handler(createRequest("GET", "/api/comments/reports", undefined, {
      ip: null,
    }), anonymous);
    assert.equal(anonymous.statusCode, 401);

    const backupAdminDb = createDatabase({ username: "backup_admin" });
    const backupAdmin = createResponse();
    await createHandler(backupAdminDb)(
      createRequest("GET", "/api/comments/reports", undefined, {
        token: backupAdminDb.token,
        ip: null,
      }),
      backupAdmin,
    );
    assert.equal(backupAdmin.statusCode, 403);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("the main admin can remove a comment from a pending report", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase();
  const report = {
    _id: new ObjectId(),
    commentId: 18,
    commentContent: "Komentar bermasalah",
    reason: "bullying",
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.reports.push(report);
  const handler = createHandler(db, async (url, options) => {
    assert.equal(options.method, "DELETE");
    assert.match(String(url), /id=eq\.18/);
    assert.equal(options.headers.Prefer, "return=minimal");
    return { ok: true };
  });

  try {
    const response = createResponse();
    await handler(createRequest("POST", "/api/comments/reports/remove", {
      report_id: report._id.toString(),
    }, { token: db.token }), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { ok: true });
    assert.equal(report.status, "removed");
    assert.equal(report.commentContent, undefined);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});
