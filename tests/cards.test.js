const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { ObjectId } = require("mongodb");
const apiHandler = require("../api/[...path].js");
const { hashSessionToken, getCookieName } = require("../api/_lib/session");
const { cardUpdateBodySchema } = require("../api/_routes/cards");

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

function createDatabase({
  role = "student",
  mustChangePassword = false,
  isActive = true,
} = {}) {
  const userId = new ObjectId();
  const cardId = new ObjectId();
  const token = "A".repeat(43);
  const sessionId = hashSessionToken(token);
  const now = new Date();
  const user = {
    _id: userId,
    username: role === "member" ? "member_01" : "student_01",
    displayName: "Test User",
    role,
    cardId: role === "member" ? null : cardId,
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
    ownerUserId: role === "member" ? null : userId,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  };
  const calls = {
    cardFilter: null,
    cardUpdateFilter: null,
    cardUpdate: null,
    cardUpdateCount: 0,
    publicFilter: null,
    rateLimitCount: 0,
  };
  const db = {
    user,
    card,
    token,
    calls,
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
          find(filter, options) {
            assert.deepEqual(options.projection, { _id: 1 });
            return {
              async toArray() {
                return filter.role.$in.includes(role) && user.isActive
                  ? [{ _id: userId }]
                  : [];
              },
            };
          },
        };
      }
      if (name === "cards") {
        return {
          find(filter, options) {
            calls.publicFilter = filter;
            assert.equal(options.projection.ownerUserId, undefined);
            return {
              sort() {
                return { toArray: async () => [card] };
              },
            };
          },
          async findOne(filter) {
            calls.cardFilter = filter;
            const matchesId = !filter._id || filter._id.equals(card._id);
            const matchesOwner =
              !filter.ownerUserId || filter.ownerUserId.equals(card.ownerUserId);
            const matchesSlug = !filter.slug || filter.slug === card.slug;
            const matchesPublicOwner =
              !filter.$or ||
              filter.$or.some(condition => {
                if (condition.ownerUserId === null) return card.ownerUserId === null;
                return condition.ownerUserId.$in.some(id => id.equals(card.ownerUserId));
              });
            return matchesId &&
              matchesOwner &&
              matchesSlug &&
              matchesPublicOwner &&
              card.isPublished
              ? card
              : null;
          },
          async updateOne(filter, update) {
            calls.cardUpdateFilter = filter;
            calls.cardUpdate = update;
            calls.cardUpdateCount += 1;
            if (
              !filter._id.equals(card._id) ||
              !filter.ownerUserId.equals(card.ownerUserId)
            ) {
              return { matchedCount: 0 };
            }
            Object.assign(card, update.$set);
            for (const field of Object.keys(update.$unset || {})) {
              delete card[field];
            }
            return { matchedCount: 1 };
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

function requestHeaders(db, extra = {}) {
  return {
    cookie: `${getCookieName()}=${db.token}`,
    "x-requested-with": "fetch",
    origin: "https://class.example",
    ...extra,
  };
}

test("card edit schema allows only the selected fields and validates HTTPS", () => {
  assert.deepEqual(
    cardUpdateBodySchema.parse({
      hobi: "  Membaca  ",
      portfolio: "https://portfolio.example/",
    }),
    {
      hobi: "Membaca",
      portfolio: "https://portfolio.example/",
    },
  );
  assert.equal(cardUpdateBodySchema.parse({ portfolio: "" }).portfolio, "");
  assert.equal(
    cardUpdateBodySchema.safeParse({ hobi: "Membaca", jabatan: "Admin" }).success,
    false,
  );
  assert.equal(
    cardUpdateBodySchema.safeParse({ portfolio: "http://portfolio.example" }).success,
    false,
  );
  assert.equal(cardUpdateBodySchema.safeParse({ hobi: { $ne: "" } }).success, false);
});

test("public card endpoints return allowlisted data and public cache headers", async () => {
  const db = createDatabase();
  const handler = apiHandler.createHandler({ getDatabase: async () => db });
  const listResponse = createResponse();
  await handler(createRequest("GET", "/api/cards", { headers: {} }), listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.equal(
    listResponse.headers["cache-control"],
    "public, max-age=30, stale-while-revalidate=60",
  );
  const list = JSON.parse(listResponse.body).cards;
  assert.equal(list.length, 1);
  assert.equal("ownerUserId" in list[0], false);
  assert.equal("_id" in list[0], false);
  assert.deepEqual(db.calls.publicFilter.$or, [
    { ownerUserId: null },
    { ownerUserId: { $in: [db.user._id] } },
  ]);

  const detailResponse = createResponse();
  await handler(
    createRequest("GET", "/api/cards/student-one", { headers: {} }),
    detailResponse,
  );
  assert.equal(detailResponse.statusCode, 200);
  assert.equal(
    detailResponse.headers["cache-control"],
    "public, max-age=30, stale-while-revalidate=60",
  );

  const inactiveDb = createDatabase({ isActive: false });
  const inactiveResponse = createResponse();
  await apiHandler.createHandler({ getDatabase: async () => inactiveDb })(
    createRequest("GET", "/api/cards/student-one", { headers: {} }),
    inactiveResponse,
  );
  assert.equal(inactiveResponse.statusCode, 404);
  assert.deepEqual(inactiveDb.calls.cardFilter.$or, [
    { ownerUserId: null },
    { ownerUserId: { $in: [] } },
  ]);
});

test("private card endpoint enforces login and student/admin roles", async () => {
  const handlerFor = db => apiHandler.createHandler({ getDatabase: async () => db });
  const anonymousResponse = createResponse();
  await handlerFor(createDatabase())(
    createRequest("GET", "/api/cards/me", { headers: {} }),
    anonymousResponse,
  );
  assert.equal(anonymousResponse.statusCode, 401);

  const memberDb = createDatabase({ role: "member" });
  const memberResponse = createResponse();
  await handlerFor(memberDb)(
    createRequest("GET", "/api/cards/me", {
      headers: requestHeaders(memberDb),
    }),
    memberResponse,
  );
  assert.equal(memberResponse.statusCode, 403);

  const studentDb = createDatabase();
  const studentResponse = createResponse();
  await handlerFor(studentDb)(
    createRequest("GET", "/api/cards/me", {
      headers: requestHeaders(studentDb),
    }),
    studentResponse,
  );
  assert.equal(studentResponse.statusCode, 200);
  assert.deepEqual(studentDb.calls.cardFilter, {
    _id: studentDb.card._id,
    ownerUserId: studentDb.user._id,
  });
  assert.equal(studentResponse.headers["cache-control"], "no-store");
});

test("card edits enforce CSRF, ownership, strict fields, and update rate limits", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase();
  const handler = apiHandler.createHandler({ getDatabase: async () => db });
  try {
    const response = createResponse();
    await handler(
      createRequest("PATCH", "/api/cards/me", {
        body: {
          hobi: "  Membaca buku  ",
          catatan: " Suka belajar ",
          portfolio: "https://portfolio.example/",
        },
        headers: requestHeaders(db),
      }),
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(db.calls.cardUpdateFilter._id.equals(db.user.cardId), true);
    assert.equal(db.calls.cardUpdateFilter.ownerUserId.equals(db.user._id), true);
    assert.deepEqual(db.calls.cardUpdate.$set.hobi, "Membaca buku");
    assert.deepEqual(db.calls.cardUpdate.$set.catatan, "Suka belajar");
    assert.deepEqual(db.calls.cardUpdate.$set.portfolio, "https://portfolio.example/");
    assert.equal("ownerUserId" in JSON.parse(response.body).card, false);

    const updateCount = db.calls.cardUpdateCount;
    const invalidResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/cards/me", {
        body: { hobi: "Test", ownerUserId: new ObjectId().toHexString() },
        headers: requestHeaders(db),
      }),
      invalidResponse,
    );
    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(db.calls.cardUpdateCount, updateCount);

    const csrfResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/cards/me", {
        body: { catatan: "Tidak berubah" },
        headers: requestHeaders(db, { origin: "https://attacker.example" }),
      }),
      csrfResponse,
    );
    assert.equal(csrfResponse.statusCode, 403);
    assert.equal(db.calls.cardUpdateCount, updateCount);

    const wrongMethodResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/cards/student-one", {
        body: { hobi: "Tidak boleh" },
        headers: requestHeaders(db),
      }),
      wrongMethodResponse,
    );
    assert.equal(wrongMethodResponse.statusCode, 405);

    for (let attempt = 1; attempt < 30; attempt += 1) {
      const nextResponse = createResponse();
      await handler(
        createRequest("PATCH", "/api/cards/me", {
          body: { hobi: `Hobi ${attempt}` },
          headers: requestHeaders(db),
        }),
        nextResponse,
      );
      assert.equal(nextResponse.statusCode, 200);
    }
    const limitedResponse = createResponse();
    await handler(
      createRequest("PATCH", "/api/cards/me", {
        body: { hobi: "Percobaan ke-31" },
        headers: requestHeaders(db),
      }),
      limitedResponse,
    );
    assert.equal(limitedResponse.statusCode, 429);
    assert.ok(limitedResponse.headers["retry-after"]);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("sessions requiring password change cannot read card endpoints", async () => {
  const db = createDatabase({ mustChangePassword: true });
  const handler = apiHandler.createHandler({ getDatabase: async () => db });
  const response = createResponse();
  await handler(
    createRequest("GET", "/api/cards", {
      headers: requestHeaders(db),
    }),
    response,
  );
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).error.code, "PASSWORD_CHANGE_REQUIRED");
});
