const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { ObjectId } = require("mongodb");
const apiHandler = require("../api/[...path].js");
const { getCookieName, hashSessionToken } = require("../api/_lib/session");
const {
  buildLegacyTeachers,
  makeUpsertOperations,
  loadLegacyTeachers,
} = require("../scripts/migrate-teachers");
const {
  createStudentSchema,
  createTeacherSchema,
  updateStudentSchema,
  updateTeacherSchema,
} = require("../api/_routes/admin-data");

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

function createRequest(method, url, headers = {}, body) {
  const request = Readable.from(
    body === undefined ? [] : [Buffer.from(JSON.stringify(body))],
  );
  request.method = method;
  request.url = url;
  request.headers = { ...headers };
  if (body !== undefined) request.headers["content-type"] = "application/json";
  return request;
}

function createDatabase(role, { mutable = false } = {}) {
  const token = "A".repeat(43);
  const userId = new ObjectId();
  const sessionId = hashSessionToken(token);
  const now = new Date();
  const user = {
    _id: userId,
    username: role === "admin" ? "admin" : "member_01",
    displayName: "Test User",
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
  const teacher = {
    id: "g01",
    nama: "Guru",
    mapel: "Matematika",
    foto: "asset/profil/guru.webp",
    sortOrder: 1,
  };
  const teachers = [];
  const students = [];
  let rateCount = 0;
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
      if (name === "teachers") {
        return {
          find(filter) {
            const cursor = {
              async toArray() {
                return mutable
                  ? teachers.filter(record => !filter.isActive || record.isActive)
                  : filter.isActive ? [teacher] : [{ ...teacher, isActive: true }];
              },
              sort() {
                return this;
              },
            };
            return cursor;
          },
          async findOne(filter) {
            return teachers.find(record => record.id === filter.id) || null;
          },
          async insertOne(record) {
            teachers.push(record);
            return { insertedId: new ObjectId() };
          },
          async updateOne(filter, update) {
            const record = teachers.find(item => item.id === filter.id);
            if (!record) return { matchedCount: 0 };
            Object.assign(record, update.$set);
            for (const field of Object.keys(update.$unset || {})) delete record[field];
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "cards") {
        return {
          find() {
            return {
              async toArray() {
                return students;
              },
              sort() {
                return this;
              },
            };
          },
          async findOne(filter) {
            return students.find(record => record.legacyId === filter.legacyId) || null;
          },
          async insertOne(record) {
            students.push(record);
            return { insertedId: new ObjectId() };
          },
          async updateOne(filter, update) {
            const record = students.find(item => item.legacyId === filter.legacyId);
            if (!record) return { matchedCount: 0 };
            Object.assign(record, update.$set);
            for (const field of Object.keys(update.$unset || {})) delete record[field];
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "rate_limits") {
        return {
          async findOneAndUpdate() {
            rateCount += 1;
            return { count: rateCount };
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

test("teacher migration maps all source records without overwriting existing data", () => {
  const source = loadLegacyTeachers();
  const records = buildLegacyTeachers(source, new Date("2025-01-01T00:00:00Z"));
  const operations = makeUpsertOperations(records);

  assert.equal(records.length, 15);
  assert.equal(records[0].id, "g01");
  assert.equal(records[14].sortOrder, 15);
  assert.equal(records[10].linktree, "https://linktr.ee/andiespramudiyantoro");
  assert.deepEqual(operations[0].updateOne.update, {
    $setOnInsert: records[0],
  });
  assert.equal(operations[0].updateOne.upsert, true);
});

test("admin record schemas reject unsafe URLs and fields outside the editor", () => {
  assert.equal(
    createStudentSchema.safeParse({
      nama: "Nama",
      jabatan: "Siswa",
      hobi: "",
      catatan: "",
      foto: "asset/profil/nama.webp",
      isPublished: false,
    }).success,
    false,
  );
  assert.equal(
    createTeacherSchema.safeParse({
      nama: "Guru",
      mapel: "Matematika",
      foto: "http://example.test/guru.png",
    }).success,
    false,
  );
  assert.equal(
    updateStudentSchema.safeParse({ foto: "asset/../secret.png" }).success,
    false,
  );
  assert.equal(updateTeacherSchema.safeParse({ isActive: true }).success, true);
});

test("public teacher list is readable while non-admin users cannot read admin data", async () => {
  const publicDb = createDatabase("member");
  const publicResponse = createResponse();
  await apiHandler.createHandler({ getDatabase: async () => publicDb })(
    createRequest("GET", "/api/teachers"),
    publicResponse,
  );
  assert.equal(publicResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(publicResponse.body).teachers[0], {
    id: "g01",
    nama: "Guru",
    mapel: "Matematika",
    foto: "asset/profil/guru.webp",
    sortOrder: 1,
  });
  assert.equal(publicResponse.headers["cache-control"], "public, max-age=30, stale-while-revalidate=60");

  const memberDb = createDatabase("member");
  const adminResponse = createResponse();
  await apiHandler.createHandler({ getDatabase: async () => memberDb })(
    createRequest("GET", "/api/admin/teachers", {
      cookie: `${getCookieName()}=${memberDb.token}`,
    }),
    adminResponse,
  );
  assert.equal(adminResponse.statusCode, 403);
  assert.equal(JSON.parse(adminResponse.body).error.code, "FORBIDDEN");
});

test("admin can create, edit, archive, and restore teacher records", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase("admin", { mutable: true });
  const handler = apiHandler.createHandler({ getDatabase: async () => db });
  const headers = {
    cookie: `${getCookieName()}=${db.token}`,
    origin: "https://class.example",
    "x-requested-with": "fetch",
  };
  try {
    const createdResponse = createResponse();
    await handler(createRequest(
      "POST",
      "/api/admin/teachers",
      headers,
      { nama: "Guru Baru", mapel: "Matematika", foto: "asset/profil/guru.webp" },
    ), createdResponse);
    assert.equal(createdResponse.statusCode, 201);
    assert.equal(JSON.parse(createdResponse.body).teacher.id, "g01");

    const updatedResponse = createResponse();
    await handler(createRequest(
      "PATCH",
      "/api/admin/teachers/g01",
      headers,
      { mapel: "Basis Data" },
    ), updatedResponse);
    assert.equal(updatedResponse.statusCode, 200);
    assert.equal(JSON.parse(updatedResponse.body).teacher.mapel, "Basis Data");

    const archivedResponse = createResponse();
    await handler(createRequest("DELETE", "/api/admin/teachers/g01", headers), archivedResponse);
    assert.equal(archivedResponse.statusCode, 200);
    assert.equal(JSON.parse(archivedResponse.body).isActive, false);

    const restoredResponse = createResponse();
    await handler(createRequest(
      "PATCH",
      "/api/admin/teachers/g01",
      headers,
      { isActive: true },
    ), restoredResponse);
    assert.equal(restoredResponse.statusCode, 200);
    assert.equal(JSON.parse(restoredResponse.body).teacher.isActive, true);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});

test("admin can create, edit, archive, and restore student cards", async () => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://class.example";
  const db = createDatabase("admin", { mutable: true });
  const handler = apiHandler.createHandler({ getDatabase: async () => db });
  const headers = {
    cookie: `${getCookieName()}=${db.token}`,
    origin: "https://class.example",
    "x-requested-with": "fetch",
  };
  try {
    const createdResponse = createResponse();
    await handler(createRequest(
      "POST",
      "/api/admin/students",
      headers,
      {
        nama: "Siswa Baru",
        jabatan: "Siswa",
        hobi: "Membaca",
        catatan: "-",
        foto: "asset/profil/siswa.webp",
      },
    ), createdResponse);
    assert.equal(createdResponse.statusCode, 201);
    assert.equal(JSON.parse(createdResponse.body).student.id, "s01");

    const updatedResponse = createResponse();
    await handler(createRequest(
      "PATCH",
      "/api/admin/students/s01",
      headers,
      { hobi: "Bersepeda" },
    ), updatedResponse);
    assert.equal(updatedResponse.statusCode, 200);
    assert.equal(JSON.parse(updatedResponse.body).student.hobi, "Bersepeda");

    const archivedResponse = createResponse();
    await handler(createRequest("DELETE", "/api/admin/students/s01", headers), archivedResponse);
    assert.equal(archivedResponse.statusCode, 200);
    assert.equal(JSON.parse(archivedResponse.body).isPublished, false);

    const restoredResponse = createResponse();
    await handler(createRequest(
      "PATCH",
      "/api/admin/students/s01",
      headers,
      { isPublished: true },
    ), restoredResponse);
    assert.equal(restoredResponse.statusCode, 200);
    assert.equal(JSON.parse(restoredResponse.body).student.isPublished, true);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});
