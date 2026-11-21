const { z } = require("zod");
const { requireAuth, requireRole } = require("../_lib/auth");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const { enforceLimit } = require("./auth");

const PUBLIC_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";
const youtubeIdSchema = z.string().trim().regex(
  /^[A-Za-z0-9_-]{11}$/,
  "Masukkan URL YouTube atau ID video yang terdiri dari 11 karakter.",
);

function extractYouTubeId(input) {
  const value = String(input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (!["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname.toLowerCase())) {
      throw new Error("unsupported");
    }
    const id = url.hostname.toLowerCase().includes("youtu.be")
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1];
    return youtubeIdSchema.parse(id);
  } catch {
    throw new ApiError(400, "INVALID_YOUTUBE_URL", "Masukkan URL YouTube atau ID video yang valid.");
  }
}

const videoFields = {
  judul: z.string().trim().min(1).max(120),
  deskripsi: z.string().trim().max(500),
  youtubeId: youtubeIdSchema,
  sortOrder: z.number().int().positive(),
  isActive: z.boolean(),
};
const createVideoSchema = z.object({
  judul: videoFields.judul,
  deskripsi: videoFields.deskripsi.default(""),
  youtubeUrl: z.string().trim().min(1).transform(value => extractYouTubeId(value)),
}).strict().transform(value => ({
  judul: value.judul,
  deskripsi: value.deskripsi,
  youtubeId: value.youtubeUrl,
}));
const updateVideoSchema = z.object({
  judul: videoFields.judul.optional(),
  deskripsi: videoFields.deskripsi.optional(),
  youtubeUrl: z.string().trim().min(1).transform(value => extractYouTubeId(value)).optional(),
  isActive: videoFields.isActive.optional(),
}).strict().transform((value, context) => {
  const result = { ...value };
  if (value.youtubeUrl) {
    result.youtubeId = value.youtubeUrl;
    delete result.youtubeUrl;
  }
  if (!Object.keys(result).length) context.addIssue({ code: "custom", message: "Tidak ada perubahan." });
  return result;
});

function isVideoRoute(route) {
  return route === "videos" || /^admin\/videos(?:\/[^/]+)?$/.test(route);
}

function toPublicVideo(record) {
  return {
    id: record.id,
    youtubeId: record.youtubeId,
    judul: record.judul,
    deskripsi: record.deskripsi || "",
  };
}

async function requireAdministrator(db, request, response) {
  const session = await requireAuth(db, request);
  requireRole(session, ["admin"]);
  await enforceLimit(
    db,
    response,
    ["admin-videos", session.user._id.toString()],
    120,
    60 * 60,
  );
  return session;
}

async function listActiveVideos(db, response) {
  const records = await db.collection("videos")
    .find({ isActive: true })
    .sort({ sortOrder: 1, id: 1 })
    .toArray();
  sendJson(response, 200, { videos: records.map(toPublicVideo) }, { cacheControl: PUBLIC_CACHE_CONTROL });
}

async function listAdminVideos(db, response) {
  const records = await db.collection("videos")
    .find({}, { projection: { _id: 0 } })
    .sort({ sortOrder: 1, id: 1 })
    .toArray();
  sendJson(response, 200, { videos: records.map(record => ({
    ...toPublicVideo(record),
    sortOrder: record.sortOrder,
    isActive: record.isActive,
  })) });
}

async function nextVideoId(db) {
  const records = await db.collection("videos").find({}, { projection: { id: 1 } }).toArray();
  const maximum = records.reduce((max, record) => {
    const match = /^v(\d{2})$/.exec(record.id || "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  if (maximum >= 99) throw new ApiError(409, "VIDEO_LIMIT_REACHED", "Jumlah video sudah mencapai batas.");
  return `v${String(maximum + 1).padStart(2, "0")}`;
}

async function createVideo(db, response, request) {
  const input = createVideoSchema.parse(await parseJsonBody(request));
  const records = await db.collection("videos").find({}, { projection: { sortOrder: 1 } }).toArray();
  const now = new Date();
  const record = {
    id: await nextVideoId(db),
    ...input,
    sortOrder: records.reduce((max, item) => Math.max(max, item.sortOrder || 0), 0) + 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("videos").insertOne(record);
  sendJson(response, 201, {
    video: { ...toPublicVideo(record), sortOrder: record.sortOrder, isActive: true },
  });
}

async function updateVideo(db, response, request, id) {
  const changes = updateVideoSchema.parse(await parseJsonBody(request));
  const result = await db.collection("videos").updateOne(
    { id },
    { $set: { ...changes, updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) throw new ApiError(404, "VIDEO_NOT_FOUND", "Video tidak ditemukan.");
  const record = await db.collection("videos").findOne(
    { id },
    { projection: { _id: 0 } },
  );
  sendJson(response, 200, {
    video: { ...toPublicVideo(record), sortOrder: record.sortOrder, isActive: record.isActive },
  });
}

async function archiveVideo(db, response, id) {
  const result = await db.collection("videos").updateOne(
    { id },
    { $set: { isActive: false, updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) throw new ApiError(404, "VIDEO_NOT_FOUND", "Video tidak ditemukan.");
  sendJson(response, 200, { ok: true, isActive: false });
}

async function handleVideosRoute({ request, response, route, db }) {
  if (!isVideoRoute(route)) return false;
  if (route === "videos") {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    await listActiveVideos(db, response);
    return true;
  }

  await requireAdministrator(db, request, response);
  const parts = route.split("/");
  const id = parts[2];
  if (!id) {
    if (request.method === "GET") await listAdminVideos(db, response);
    else if (request.method === "POST") await createVideo(db, response, request);
    else {
      response.setHeader("Allow", "GET, POST");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
  } else {
    if (!/^v\d{2}$/.test(id)) throw new ApiError(400, "INVALID_RECORD_ID", "ID video tidak valid.");
    if (request.method === "PATCH") await updateVideo(db, response, request, id);
    else if (request.method === "DELETE") await archiveVideo(db, response, id);
    else {
      response.setHeader("Allow", "PATCH, DELETE");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
  }
  return true;
}

module.exports = {
  isVideoRoute,
  handleVideosRoute,
  extractYouTubeId,
  createVideoSchema,
  updateVideoSchema,
};
