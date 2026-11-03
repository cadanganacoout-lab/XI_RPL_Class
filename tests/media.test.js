const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const sharp = require("sharp");
const { ObjectId } = require("mongodb");
const apiHandler = require("../api/[...path].js");
const { createHandler } = apiHandler;
const { hashSessionToken, getCookieName } = require("../api/_lib/session");
const { encodeWebp } = require("../api/_lib/media-image");
const { createSignedUpload } = require("../api/_lib/media-storage");
const { updateStudentSchema, updateTeacherSchema } = require("../api/_routes/admin-data");

const APP_ORIGIN = "https://kelas.test";
const STORAGE_CONFIG = {
  url: "https://media-project.supabase.co",
  serviceRoleKey: "sb_secret_test",
  buckets: {
    avatar: "avatars",
    background: "card-backgrounds",
    gallery: "gallery",
    staging: "media-staging",
  },
};

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

function createRequest(method, url, body, token) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = url;
  request.headers = {
    origin: APP_ORIGIN,
    "x-requested-with": "fetch",
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(token ? { cookie: `${getCookieName()}=${token}` } : {}),
  };
  return request;
}

function sameValue(left, right) {
  if (left instanceof ObjectId && right instanceof ObjectId) return left.equals(right);
  return left === right;
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof ObjectId)) {
      if ("$gt" in value) return document[key] > value.$gt;
      if ("$lte" in value) return document[key] <= value.$lte;
      if ("$exists" in value) return (document[key] !== undefined) === value.$exists;
    }
    return sameValue(document[key], value);
  });
}

function createDatabase({ user, token, card, galleryPhotos = [] }) {
  const sessionId = hashSessionToken(token);
  const session = {
    _id: sessionId,
    userId: user._id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    lastSeenAt: new Date(),
    userAgent: "",
  };
  const sessions = new Map([[sessionId, session]]);
  const intents = new Map();
  const limits = new Map();
  const audits = [];

  return {
    card,
    galleryPhotos,
    intents,
    audits,
    collection(name) {
      if (name === "users") {
        return {
          async findOne(filter) {
            return sameValue(user._id, filter._id) && (!filter.isActive || user.isActive)
              ? user
              : null;
          },
        };
      }
      if (name === "sessions") {
        return {
          async findOne(filter) {
            const found = sessions.get(filter._id);
            return found && found.expiresAt > filter.expiresAt.$gt ? found : null;
          },
          async updateOne() {
            return { matchedCount: 1 };
          },
          async deleteOne() {
            return { deletedCount: 0 };
          },
        };
      }
      if (name === "cards") {
        return {
          async findOne(filter) {
            return matches(card, filter) ? card : null;
          },
          async updateOne(filter, update) {
            if (!matches(card, filter)) return { matchedCount: 0 };
            Object.assign(card, update.$set);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "rate_limits") {
        return {
          async findOne(filter) {
            const entry = limits.get(filter._id);
            return entry && entry.expiresAt > filter.expiresAt.$gt ? entry : null;
          },
          async findOneAndUpdate(filter, update) {
            const entry = limits.get(filter._id);
            if (!entry || entry.expiresAt <= filter.expiresAt.$gt) return null;
            entry.count += update.$inc.count;
            return entry;
          },
          async updateOne(filter, update) {
            const entry = limits.get(filter._id);
            if (!entry || entry.expiresAt > filter.expiresAt.$lte) {
              return { modifiedCount: 0 };
            }
            limits.set(filter._id, update.$set);
            return { modifiedCount: 1 };
          },
          async insertOne(entry) {
            if (limits.has(entry._id)) {
              const error = new Error("duplicate");
              error.code = 11000;
              throw error;
            }
            limits.set(entry._id, entry);
          },
        };
      }
      if (name === "media_uploads") {
        return {
          async insertOne(intent) {
            intents.set(intent._id.toString(), intent);
          },
          async findOne(filter) {
            const intent = intents.get(filter._id.toString());
            return intent && matches(intent, filter) ? intent : null;
          },
          async updateOne(filter, update) {
            const intent = intents.get(filter._id.toString());
            if (!intent || !matches(intent, filter)) return { matchedCount: 0 };
            Object.assign(intent, update.$set);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === "media_audit") {
        return {
          async insertOne(entry) {
            audits.push(entry);
          },
        };
      }
      if (name === "media_cleanup") {
        return {
          async insertOne() {},
        };
      }
      if (name === "gallery_photos") {
        return {
          find(filter = {}) {
            let sortSpec = {};
            const cursor = {
              sort(specification) {
                sortSpec = specification;
                return cursor;
              },
              async toArray() {
                const photos = galleryPhotos.filter(photo => matches(photo, filter));
                const sortFields = Object.entries(sortSpec);
                return photos.sort((left, right) => {
                  for (const [field, direction] of sortFields) {
                    if (left[field] === right[field]) continue;
                    return (left[field] < right[field] ? -1 : 1) * direction;
                  }
                  return 0;
                });
              },
            };
            return cursor;
          },
          async bulkWrite(operations) {
            for (const operation of operations) {
              const { filter, update } = operation.updateOne;
              const photo = galleryPhotos.find(candidate => matches(candidate, filter));
              if (photo) Object.assign(photo, update.$set);
            }
            return { modifiedCount: operations.length };
          },
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  };
}

test("avatar encoding outputs a metadata-free 512px WebP", async () => {
  const input = await sharp({
    create: {
      width: 40,
      height: 24,
      channels: 3,
      background: { r: 35, g: 80, b: 125 },
    },
  }).png().toBuffer();
  const output = await encodeWebp(input, "avatar");
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  await assert.rejects(encodeWebp(Buffer.from("<svg/>"), "avatar"), {
    code: "MEDIA_INVALID_IMAGE",
  });
});

test("new Supabase secret keys are sent only as apikey for signed upload creation", async () => {
  let requestOptions;
  const result = await createSignedUpload(
    STORAGE_CONFIG,
    async (_url, options) => {
      requestOptions = options;
      return new Response(JSON.stringify({
        url: "/object/upload/sign/media-staging/pending/id.source?token=short-lived",
        token: "short-lived",
      }), { status: 200 });
    },
    "media-staging",
    "pending/id.source",
  );
  assert.equal(result.token, "short-lived");
  assert.equal(
    result.uploadUrl,
    `${STORAGE_CONFIG.url}/storage/v1/object/upload/sign/media-staging/pending/id.source?token=short-lived`,
  );
  assert.equal(requestOptions.headers.apikey, STORAGE_CONFIG.serviceRoleKey);
  assert.equal("authorization" in Object.fromEntries(
    Object.entries(requestOptions.headers).map(([key, value]) => [key.toLowerCase(), value]),
  ), false);
});

test("unauthenticated media upload is rejected before reading the file or resolving storage credentials", async t => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = APP_ORIGIN;
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  });
  let storageConfigRequested = false;
  const handler = createHandler({
    getDatabase: async () => ({
      collection() {
        throw new Error("Unauthenticated request should not access collections.");
      },
    }),
    getSupabaseConfig() {
      storageConfigRequested = true;
      return STORAGE_CONFIG;
    },
  });
  const request = createRequest("POST", "/api/media/students/s01/avatar/upload-url", {
    contentType: "image/png",
    sourceSize: 10,
  });
  const response = createResponse();
  await handler(request, response);
  assert.equal(response.statusCode, 401);
  assert.equal(storageConfigRequested, false);
});

test("a student can upload only to their linked card and server-encoded media is stored", async t => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = APP_ORIGIN;
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  });
  const token = "A".repeat(43);
  const userId = new ObjectId();
  const cardId = new ObjectId();
  const user = {
    _id: userId,
    username: "siswa01",
    displayName: "Siswa Test",
    role: "student",
    cardId,
    isActive: true,
    mustChangePassword: false,
  };
  const card = {
    _id: cardId,
    legacyId: "s01",
    nama: "Siswa Test",
    ownerUserId: userId,
    foto: "asset/profil/legacy.webp",
  };
  const db = createDatabase({ user, token, card });
  const storage = new Map();
  const image = await sharp({
    create: {
      width: 36,
      height: 24,
      channels: 3,
      background: { r: 90, g: 120, b: 45 },
    },
  }).png().toBuffer();
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.includes("/object/upload/sign/")) {
      return new Response(JSON.stringify({
        url: `${parsed.pathname.replace("/storage/v1", "")}?token=once`,
        token: "once",
      }), { status: 200 });
    }
    if (options.method === "GET") {
      const path = decodeURIComponent(parsed.pathname.split("/object/")[1]);
      const content = storage.get(path);
      return content
        ? new Response(content, { status: 200 })
        : new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    }
    if (options.method === "DELETE") {
      const body = JSON.parse(options.body);
      for (const path of body.prefixes) {
        storage.delete(`${parsed.pathname.split("/object/")[1].split("/")[0]}/${path}`);
      }
      return new Response("{}", { status: 200 });
    }
    if (options.method === "POST") {
      const path = decodeURIComponent(parsed.pathname.split("/object/")[1]);
      storage.set(path, Buffer.from(options.body));
      return new Response("{}", { status: 200 });
    }
    throw new Error("Unexpected storage request.");
  };
  const handler = createHandler({
    getDatabase: async () => db,
    fetchImpl,
    getSupabaseConfig: () => STORAGE_CONFIG,
  });

  const uploadResponse = createResponse();
  await handler(
    createRequest("POST", "/api/media/students/s01/avatar/upload-url", {
      contentType: "image/png",
      sourceSize: image.length,
    }, token),
    uploadResponse,
  );
  assert.equal(uploadResponse.statusCode, 201);
  const upload = JSON.parse(uploadResponse.body);
  assert.equal("token" in upload, false);
  assert.match(upload.uploadUrl, /^https:\/\/media-project\.supabase\.co\/storage\/v1\/object\/upload\/sign\//);
  const stagePath = new URL(upload.uploadUrl).pathname.split("/object/upload/sign/media-staging/")[1];
  storage.set(`${STORAGE_CONFIG.buckets.staging}/${stagePath}`, image);

  const finalizeResponse = createResponse();
  await handler(
    createRequest("POST", "/api/media/students/s01/avatar/finalize", {
      uploadId: upload.uploadId,
    }, token),
    finalizeResponse,
  );
  assert.equal(finalizeResponse.statusCode, 200);
  assert.equal(db.card.avatar.url, JSON.parse(finalizeResponse.body).media.url);
  assert.equal(db.card.avatar.path.startsWith("student/s01/"), true);
  assert.equal(storage.has(`${STORAGE_CONFIG.buckets.staging}/${stagePath}`), false);
  const finalImage = storage.get(`${STORAGE_CONFIG.buckets.avatar}/${db.card.avatar.path}`);
  assert.ok(finalImage);
  assert.equal((await sharp(finalImage).metadata()).format, "webp");
  assert.equal(db.audits[0].action, "upload");
});

test("non-main admin cannot create media upload intents", async t => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = APP_ORIGIN;
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  });
  const token = "B".repeat(43);
  const user = {
    _id: new ObjectId(),
    username: "admin_lain",
    displayName: "Admin Lain",
    role: "admin",
    cardId: null,
    isActive: true,
    mustChangePassword: false,
  };
  const db = createDatabase({ user, token, card: null });
  let storageRequested = false;
  const handler = createHandler({
    getDatabase: async () => db,
    getSupabaseConfig() {
      storageRequested = true;
      return STORAGE_CONFIG;
    },
  });
  const response = createResponse();
  await handler(
    createRequest("POST", "/api/media/teachers/g01/avatar/upload-url", {
      contentType: "image/png",
      sourceSize: 10,
    }, token),
    response,
  );
  assert.equal(response.statusCode, 403);
  assert.equal(storageRequested, false);
});

test("main admin can reorder the complete active gallery without accepting storage paths", async t => {
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = APP_ORIGIN;
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  });
  const token = "C".repeat(43);
  const user = {
    _id: new ObjectId(),
    username: "admin",
    displayName: "Admin utama",
    role: "admin",
    cardId: null,
    isActive: true,
    mustChangePassword: false,
  };
  const galleryPhotos = ["Foto pertama", "Foto kedua", "Foto ketiga"].map((caption, index) => ({
    _id: new ObjectId(),
    caption,
    url: `https://media-project.supabase.co/${index}.webp`,
    path: `${index}.webp`,
    sortOrder: index + 1,
    isPublished: true,
  }));
  const db = createDatabase({ user, token, card: null, galleryPhotos });
  const handler = createHandler({ getDatabase: async () => db });
  const requestedOrder = [
    galleryPhotos[1]._id,
    galleryPhotos[0]._id,
    galleryPhotos[2]._id,
  ].map(id => id.toString());
  const response = createResponse();
  await handler(
    createRequest("PATCH", "/api/admin/gallery/order", { photoIds: requestedOrder }, token),
    response,
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    galleryPhotos.sort((left, right) => left.sortOrder - right.sortOrder).map(photo => photo._id.toString()),
    requestedOrder,
  );
  assert.equal(db.audits[0].action, "gallery-order");
});

test("admin data APIs cannot mass-assign media URLs or storage paths", () => {
  assert.throws(() => updateStudentSchema.parse({ avatar: { url: "https://evil.test/image.webp" } }));
  assert.throws(() => updateTeacherSchema.parse({ background: { path: "other/file.webp" } }));
});
