const { randomUUID } = require("node:crypto");
const { ObjectId } = require("mongodb");
const { z } = require("zod");
const { requireAuth, requireRole } = require("../_lib/auth");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const { enforceLimit } = require("./auth");
const {
  legacyIdSchema,
  storagePathSchema,
  teacherIdSchema,
} = require("../_lib/schemas");
const { encodeWebp, SOURCE_MAX_BYTES } = require("../_lib/media-image");
const {
  STORAGE_BUCKETS,
  createSignedUpload,
  downloadObject,
  publicObjectUrl,
  removeObject,
  uploadObject,
} = require("../_lib/media-storage");

const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const INTENT_LIFETIME_MS = 15 * 60 * 1000;
const uploadRequestSchema = z.object({
  contentType: z.enum(MIME_TYPES),
  sourceSize: z.number().int().min(1).max(SOURCE_MAX_BYTES),
}).strict();
const galleryUploadRequestSchema = uploadRequestSchema.extend({
  caption: z.string().trim().min(1).max(500),
}).strict();
const finalizeRequestSchema = z.object({
  uploadId: z.string().regex(/^[a-f0-9]{24}$/i),
}).strict();
const galleryUpdateSchema = z.object({
  caption: z.string().trim().min(1).max(500).optional(),
  sortOrder: z.number().int().positive().max(10000).optional(),
}).strict().refine(value => Object.keys(value).length > 0);
const galleryOrderSchema = z.object({
  photoIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).min(1).max(500),
}).strict().refine(value => new Set(value.photoIds).size === value.photoIds.length);

function isMediaRoute(route) {
  return (
    route === "gallery" ||
    route === "admin/gallery" ||
    /^admin\/gallery\/[^/]+$/.test(route) ||
    route === "admin/media/cleanup" ||
    /^media\/(?:students|teachers)\/[^/]+\/(?:avatar|background)(?:\/(?:upload-url|finalize))?$/.test(route)
  );
}

function routePart(value, schema) {
  try {
    return schema.parse(decodeURIComponent(value));
  } catch {
    throw new ApiError(400, "INVALID_MEDIA_TARGET", "The media request is invalid.");
  }
}

function mainAdmin(session) {
  return session.user.role === "admin" && session.user.username === "admin";
}

async function requireMainAdmin(db, request) {
  const session = await requireAuth(db, request);
  requireRole(session, ["admin"]);
  if (!mainAdmin(session)) {
    throw new ApiError(403, "FORBIDDEN", "Only the main administrator can manage media.");
  }
  return session;
}

async function requireTarget(db, request, targetType, targetId) {
  const session = await requireAuth(db, request);
  const collectionName = targetType === "student" ? "cards" : "teachers";
  const idField = targetType === "student" ? "legacyId" : "id";
  const checkedId = routePart(
    targetId,
    targetType === "student" ? legacyIdSchema : teacherIdSchema,
  );
  const filter = { [idField]: checkedId };

  if (targetType === "student" && session.user.role === "student") {
    if (!session.user.cardId) {
      throw new ApiError(404, "MEDIA_TARGET_NOT_FOUND", "The media target was not found.");
    }
    filter.ownerUserId = session.user._id;
    filter._id = session.user.cardId;
  } else if (session.user.role === "admin" && mainAdmin(session)) {
    if (targetType === "student") delete filter._id;
  } else {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to change this media.");
  }

  const record = await db.collection(collectionName).findOne(filter);
  if (!record) {
    throw new ApiError(404, "MEDIA_TARGET_NOT_FOUND", "The media target was not found.");
  }
  return {
    session,
    targetType,
    targetId: checkedId,
    collectionName,
    record,
    filter,
  };
}

function getBucket(config, mediaType) {
  const bucketKey = mediaType === "avatar"
    ? "avatar"
    : mediaType === "background"
      ? "background"
      : "gallery";
  return config.buckets?.[bucketKey] || STORAGE_BUCKETS[bucketKey];
}

function readStorageConfig(getSupabaseConfig) {
  try {
    return getSupabaseConfig();
  } catch {
    throw new ApiError(503, "MEDIA_STORAGE_NOT_CONFIGURED", "Media storage is not configured.");
  }
}

async function auditAction(db, actorUserId, action, targetType, targetId, mediaType) {
  await db.collection("media_audit").insertOne({
    actorUserId,
    action,
    targetType,
    targetId,
    mediaType,
    createdAt: new Date(),
  });
}

async function queueCleanup(db, bucket, path, reason) {
  const now = new Date();
  await db.collection("media_cleanup").insertOne({
    bucket,
    path,
    reason,
    status: "pending",
    attempts: 0,
    lastAttemptAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function removeOrQueue(db, config, fetchImpl, bucket, path, reason) {
  try {
    await removeObject(config, fetchImpl, bucket, path);
    return false;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await queueCleanup(db, bucket, path, reason);
    return true;
  }
}

function finalMediaPath(targetType, targetId) {
  const fileName = `${randomUUID()}.webp`;
  return targetType === "gallery"
    ? fileName
    : `${targetType}/${targetId}/${fileName}`;
}

async function createUploadIntent({
  db,
  response,
  request,
  target,
  mediaType,
  inputSchema,
  config,
  fetchImpl,
}) {
  const input = inputSchema.parse(await parseJsonBody(request));
  const userId = target.session.user._id.toString();
  const limit = target.session.user.role === "admin" ? 30 : 5;
  await enforceLimit(
    db,
    response,
    ["media-upload", userId, target.targetType, target.targetId, mediaType],
    limit,
    60 * 60,
  );

  const bucket = config.buckets?.staging || STORAGE_BUCKETS.staging;
  const path = `pending/${randomUUID()}.source`;
  const signedUpload = await createSignedUpload(config, fetchImpl, bucket, path);
  const now = new Date();
  const intent = {
    _id: new ObjectId(),
    actorUserId: target.session.user._id,
    targetType: target.targetType,
    targetId: target.targetId,
    mediaType,
    bucket,
    path,
    sourceSize: input.sourceSize,
    contentType: input.contentType,
    ...(input.caption === undefined ? {} : { caption: input.caption }),
    status: "pending",
    createdAt: now,
    expiresAt: new Date(now.getTime() + INTENT_LIFETIME_MS),
  };
  await db.collection("media_uploads").insertOne(intent);
  sendJson(response, 201, {
    uploadId: intent._id.toString(),
    uploadUrl: signedUpload.uploadUrl,
    expiresAt: intent.expiresAt,
  });
}

async function claimUploadIntent(db, request, target, mediaType) {
  const { uploadId } = finalizeRequestSchema.parse(await parseJsonBody(request));
  const id = new ObjectId(uploadId);
  const intents = db.collection("media_uploads");
  const filter = {
    _id: id,
    actorUserId: target.session.user._id,
    targetType: target.targetType,
    targetId: target.targetId,
    mediaType,
    status: "pending",
    expiresAt: { $gt: new Date() },
  };
  const result = await intents.updateOne(
    filter,
    { $set: { status: "processing" } },
  );
  if (result.matchedCount !== 1) {
    throw new ApiError(
      409,
      "MEDIA_UPLOAD_EXPIRED",
      "The upload is expired, already used, or no longer available.",
    );
  }
  return intents.findOne({ _id: id });
}

async function processUpload({
  db,
  response,
  request,
  target,
  mediaType,
  config,
  fetchImpl,
}) {
  const intent = await claimUploadIntent(db, request, target, mediaType);
  if (!intent || intent.sourceSize > SOURCE_MAX_BYTES) {
    throw new ApiError(409, "MEDIA_UPLOAD_INVALID", "The upload is no longer available.");
  }

  const isGallery = mediaType === "gallery";
  const bucket = isGallery
    ? getBucket(config, "gallery")
    : getBucket(config, mediaType);
  const finalPath = finalMediaPath(target.targetType, target.targetId);
  let webp;
  try {
    const source = await downloadObject(
      config,
      fetchImpl,
      intent.bucket,
      intent.path,
      SOURCE_MAX_BYTES,
    );
    webp = await encodeWebp(source, mediaType);
    await uploadObject(config, fetchImpl, bucket, finalPath, webp);
  } catch (error) {
    await db.collection("media_uploads").updateOne(
      { _id: intent._id, status: "processing" },
      { $set: { status: "failed" } },
    );
    await removeOrQueue(db, config, fetchImpl, bucket, finalPath, "deletion");
    await removeOrQueue(
      db,
      config,
      fetchImpl,
      intent.bucket,
      intent.path,
      "staging",
    );
    throw error;
  }

  const url = publicObjectUrl(config, bucket, finalPath);
  const now = new Date();
  if (isGallery) {
    let photo;
    let result;
    try {
      const lastPhoto = await db.collection("gallery_photos")
        .find({ isPublished: true })
        .sort({ sortOrder: -1, _id: -1 })
        .limit(1)
        .toArray();
      const sortOrder = (lastPhoto[0]?.sortOrder || 0) + 1;
      photo = {
        _id: new ObjectId(),
        caption: intent.caption,
        url,
        path: finalPath,
        sortOrder,
        isPublished: true,
        storageDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await auditAction(
        db,
        target.session.user._id,
        "gallery-create",
        "gallery",
        photo._id.toString(),
        "gallery",
      );
      result = await db.collection("gallery_photos").insertOne(photo);
    } catch (error) {
      await db.collection("media_uploads").updateOne(
        { _id: intent._id, status: "processing" },
        { $set: { status: "failed" } },
      );
      await removeOrQueue(db, config, fetchImpl, bucket, finalPath, "deletion");
      await removeOrQueue(db, config, fetchImpl, intent.bucket, intent.path, "staging");
      throw error;
    }
    await db.collection("media_uploads").updateOne(
      { _id: intent._id, status: "processing" },
      { $set: { status: "completed", completedAt: now } },
    );
    const stagingCleanupPending = await removeOrQueue(
      db,
      config,
      fetchImpl,
      intent.bucket,
      intent.path,
      "staging",
    );
    sendJson(response, 201, {
      photo: serializeGalleryPhoto({ ...photo, _id: result.insertedId }),
      cleanupPending: stagingCleanupPending,
    });
    return;
  }

  const newPointer = { url, path: finalPath, updatedAt: now };
  const oldPointer = target.record[mediaType];
  try {
    await auditAction(
      db,
      target.session.user._id,
      "upload",
      target.targetType,
      target.targetId,
      mediaType,
    );
    const updated = await db.collection(target.collectionName).updateOne(
      target.filter,
      { $set: { [mediaType]: newPointer, updatedAt: now } },
    );
    if (updated.matchedCount !== 1) {
      throw new ApiError(404, "MEDIA_TARGET_NOT_FOUND", "The media target was not found.");
    }
  } catch (error) {
    await db.collection("media_uploads").updateOne(
      { _id: intent._id, status: "processing" },
      { $set: { status: "failed" } },
    );
    await removeOrQueue(db, config, fetchImpl, bucket, finalPath, "deletion");
    await removeOrQueue(db, config, fetchImpl, intent.bucket, intent.path, "staging");
    throw error;
  }
  await db.collection("media_uploads").updateOne(
    { _id: intent._id, status: "processing" },
    { $set: { status: "completed", completedAt: now } },
  );

  const previousCleanupPending = oldPointer?.path
    ? await removeOrQueue(
        db,
        config,
        fetchImpl,
        bucket,
        oldPointer.path,
        "replacement",
      )
    : false;
  const stagingCleanupPending = await removeOrQueue(
    db,
    config,
    fetchImpl,
    intent.bucket,
    intent.path,
    "staging",
  );
  sendJson(response, 200, {
    media: { url },
    cleanupPending: previousCleanupPending || stagingCleanupPending,
  });
}

async function deleteCardMedia({
  db,
  response,
  target,
  mediaType,
  config,
  fetchImpl,
}) {
  const pointer = target.record[mediaType];
  if (!pointer) {
    sendJson(response, 200, { ok: true, alreadyRemoved: true });
    return;
  }
  const bucket = getBucket(config, mediaType);
  const expectedPath = new RegExp(
    `^${target.targetType}/${target.targetId}/[a-f0-9-]{36}\\.webp$`,
  );
  if (
    !storagePathSchema.safeParse(pointer.path).success ||
    !expectedPath.test(pointer.path)
  ) {
    throw new ApiError(409, "MEDIA_PATH_INVALID", "The saved media path could not be verified.");
  }
  await auditAction(
    db,
    target.session.user._id,
    "remove",
    target.targetType,
    target.targetId,
    mediaType,
  );
  const updated = await db.collection(target.collectionName).updateOne(
    target.filter,
    { $set: { [mediaType]: null, updatedAt: new Date() } },
  );
  if (updated.matchedCount !== 1) {
    throw new ApiError(404, "MEDIA_TARGET_NOT_FOUND", "The media target was not found.");
  }
  const cleanupPending = await removeOrQueue(
    db,
    config,
    fetchImpl,
    bucket,
    pointer.path,
    "deletion",
  );
  sendJson(response, cleanupPending ? 202 : 200, { ok: true, cleanupPending });
}

function serializeGalleryPhoto(photo) {
  return {
    id: photo._id.toString(),
    caption: photo.caption,
    url: photo.url,
    sortOrder: photo.sortOrder,
    isPublished: photo.isPublished,
    ...(photo.storageDeleted === false ? { storageDeleted: false } : {}),
  };
}

async function handlePublicGallery({ response, db, request }) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const photos = await db.collection("gallery_photos")
    .find({ isPublished: true })
    .sort({ sortOrder: 1, _id: 1 })
    .toArray();
  sendJson(
    response,
    200,
    { photos: photos.map(serializeGalleryPhoto) },
    { cacheControl: "public, max-age=30, stale-while-revalidate=60" },
  );
}

async function handleAdminGalleryList({ response, db }) {
  const photos = await db.collection("gallery_photos")
    .find({})
    .sort({ isPublished: -1, sortOrder: 1, _id: 1 })
    .toArray();
  sendJson(response, 200, { photos: photos.map(serializeGalleryPhoto) });
}

async function updateGalleryPhoto({ request, response, db, id, session }) {
  let photoId;
  try {
    photoId = new ObjectId(decodeURIComponent(id));
  } catch {
    throw new ApiError(400, "INVALID_GALLERY_ID", "The gallery request is invalid.");
  }
  const changes = galleryUpdateSchema.parse(await parseJsonBody(request));
  const filter = { _id: photoId };
  const current = await db.collection("gallery_photos").findOne(filter);
  if (!current) throw new ApiError(404, "GALLERY_PHOTO_NOT_FOUND", "The photo was not found.");
  await enforceLimit(
    db,
    response,
    ["media-gallery-edit", session.user._id.toString(), photoId.toString()],
    30,
    60 * 60,
  );
  if (changes.caption !== undefined) {
    await auditAction(db, session.user._id, "gallery-caption", "gallery", photoId.toString(), "gallery");
  }
  if (changes.sortOrder !== undefined) {
    await auditAction(db, session.user._id, "gallery-order", "gallery", photoId.toString(), "gallery");
  }
  const update = { ...changes, updatedAt: new Date() };
  await db.collection("gallery_photos").updateOne(filter, { $set: update });
  const photo = await db.collection("gallery_photos").findOne(filter);
  sendJson(response, 200, { photo: serializeGalleryPhoto(photo) });
}

async function updateGalleryOrder({ request, response, db, session }) {
  const { photoIds } = galleryOrderSchema.parse(await parseJsonBody(request));
  const collection = db.collection("gallery_photos");
  const activePhotos = await collection.find({ isPublished: true }).toArray();
  const activeIds = new Set(activePhotos.map(photo => photo._id.toString()));
  if (
    activePhotos.length !== photoIds.length ||
    photoIds.some(id => !activeIds.has(id))
  ) {
    throw new ApiError(409, "GALLERY_ORDER_CHANGED", "Daftar galeri berubah. Muat ulang sebelum mengurutkan foto.");
  }
  await enforceLimit(
    db,
    response,
    ["media-gallery-order", session.user._id.toString()],
    30,
    60 * 60,
  );
  await auditAction(db, session.user._id, "gallery-order", "gallery", "all", "gallery");
  await collection.bulkWrite(
    photoIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(id), isPublished: true },
        update: { $set: { sortOrder: index + 1, updatedAt: new Date() } },
      },
    })),
  );
  const photos = await collection.find({ isPublished: true })
    .sort({ sortOrder: 1, _id: 1 })
    .toArray();
  sendJson(response, 200, { photos: photos.map(serializeGalleryPhoto) });
}

async function deleteGalleryPhoto({ response, db, id, session, config, fetchImpl }) {
  let photoId;
  try {
    photoId = new ObjectId(decodeURIComponent(id));
  } catch {
    throw new ApiError(400, "INVALID_GALLERY_ID", "The gallery request is invalid.");
  }
  const collection = db.collection("gallery_photos");
  const photo = await collection.findOne({ _id: photoId });
  if (!photo) throw new ApiError(404, "GALLERY_PHOTO_NOT_FOUND", "The photo was not found.");
  if (!photo.isPublished && photo.storageDeleted) {
    sendJson(response, 200, { ok: true, alreadyRemoved: true });
    return;
  }
  await enforceLimit(
    db,
    response,
    ["media-gallery-delete", session.user._id.toString()],
    30,
    60 * 60,
  );
  if (!storagePathSchema.safeParse(photo.path).success || !/^[a-f0-9-]{36}\.webp$/.test(photo.path)) {
    throw new ApiError(409, "MEDIA_PATH_INVALID", "The saved media path could not be verified.");
  }
  await auditAction(db, session.user._id, "gallery-remove", "gallery", photoId.toString(), "gallery");
  await collection.updateOne(
    { _id: photoId },
    { $set: { isPublished: false, deletedAt: new Date(), updatedAt: new Date() } },
  );
  const cleanupPending = await removeOrQueue(
    db,
    config,
    fetchImpl,
    getBucket(config, "gallery"),
    photo.path,
    "deletion",
  );
  if (!cleanupPending) {
    await collection.updateOne(
      { _id: photoId },
      { $set: { storageDeleted: true, updatedAt: new Date() } },
    );
  }
  sendJson(response, cleanupPending ? 202 : 200, { ok: true, cleanupPending });
}

async function retryPendingCleanup({ response, db, config, fetchImpl }) {
  const pending = await db.collection("media_cleanup")
    .find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(20)
    .toArray();
  let cleaned = 0;
  let failed = 0;
  for (const item of pending) {
    if (
      !Object.values(STORAGE_BUCKETS).includes(item.bucket) &&
      !Object.values(config.buckets || {}).includes(item.bucket)
    ) {
      failed += 1;
      continue;
    }
    if (!storagePathSchema.safeParse(item.path).success) {
      failed += 1;
      continue;
    }
    try {
      await removeObject(config, fetchImpl, item.bucket, item.path);
      const completedAt = new Date();
      if (item.bucket === getBucket(config, "gallery") && item.reason === "deletion") {
        await db.collection("gallery_photos").updateOne(
          { path: item.path, isPublished: false },
          { $set: { storageDeleted: true, updatedAt: completedAt } },
        );
      }
      await db.collection("media_cleanup").updateOne(
        { _id: item._id, status: "pending" },
        { $set: { status: "complete", lastAttemptAt: completedAt, updatedAt: completedAt }, $inc: { attempts: 1 } },
      );
      cleaned += 1;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      await db.collection("media_cleanup").updateOne(
        { _id: item._id, status: "pending" },
        { $set: { lastAttemptAt: new Date(), updatedAt: new Date() }, $inc: { attempts: 1 } },
      );
      failed += 1;
    }
  }
  sendJson(response, failed ? 202 : 200, { cleaned, failed });
}

async function handleMediaRoute({
  request,
  response,
  route,
  db,
  fetchImpl = globalThis.fetch,
  getSupabaseConfig,
}) {
  if (!isMediaRoute(route)) return false;
  if (route === "gallery") {
    await handlePublicGallery({ response, db, request });
    return true;
  }
  if (route === "admin/media/cleanup") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    await requireMainAdmin(db, request);
    await retryPendingCleanup({
      response,
      db,
      config: readStorageConfig(getSupabaseConfig),
      fetchImpl,
    });
    return true;
  }
  if (route.startsWith("admin/gallery")) {
    const session = await requireMainAdmin(db, request);
    if (route === "admin/gallery") {
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      await handleAdminGalleryList({ response, db });
      return true;
    }
    if (route === "admin/gallery/order") {
      if (request.method !== "PATCH") {
        response.setHeader("Allow", "PATCH");
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      await updateGalleryOrder({ request, response, db, session });
      return true;
    }
    if (route === "admin/gallery/upload-url") {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      const target = {
        session,
        targetType: "gallery",
        targetId: "gallery",
      };
      await createUploadIntent({
        db,
        response,
        request,
        target,
        mediaType: "gallery",
        inputSchema: galleryUploadRequestSchema,
        config: readStorageConfig(getSupabaseConfig),
        fetchImpl,
      });
      return true;
    }
    if (route === "admin/gallery/finalize") {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      await processUpload({
        db,
        response,
        request,
        target: { session, targetType: "gallery", targetId: "gallery" },
        mediaType: "gallery",
        config: readStorageConfig(getSupabaseConfig),
        fetchImpl,
      });
      return true;
    }
    const [, , id] = route.split("/");
    if (request.method === "PATCH") {
      await updateGalleryPhoto({ request, response, db, id, session });
      return true;
    }
    if (request.method === "DELETE") {
      await deleteGalleryPhoto({
        response,
        db,
        id,
        session,
        config: readStorageConfig(getSupabaseConfig),
        fetchImpl,
      });
      return true;
    }
    response.setHeader("Allow", "PATCH, DELETE");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const parts = route.split("/");
  const targetType = parts[1] === "students" ? "student" : "teacher";
  const mediaType = routePart(parts[3], z.enum(["avatar", "background"]));
  const target = await requireTarget(db, request, targetType, parts[2]);
  const config = readStorageConfig(getSupabaseConfig);
  if (parts.length === 5 && parts[4] === "upload-url") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    await createUploadIntent({
      db,
      response,
      request,
      target,
      mediaType,
      inputSchema: uploadRequestSchema,
      config,
      fetchImpl,
    });
    return true;
  }
  if (parts.length === 5 && parts[4] === "finalize") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    await processUpload({
      db,
      response,
      request,
      target,
      mediaType,
      config,
      fetchImpl,
    });
    return true;
  }
  if (parts.length === 4 && request.method === "DELETE") {
    await deleteCardMedia({
      db,
      response,
      target,
      mediaType,
      config,
      fetchImpl,
    });
    return true;
  }
  response.setHeader("Allow", "POST, DELETE");
  throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}

module.exports = {
  galleryUpdateSchema,
  handleMediaRoute,
  isMediaRoute,
  serializeGalleryPhoto,
};
