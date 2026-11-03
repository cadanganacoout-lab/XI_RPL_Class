const userJsonSchema = {
  bsonType: "object",
  required: [
    "username",
    "displayName",
    "passwordHash",
    "role",
    "cardId",
    "mustChangePassword",
    "isActive",
    "createdAt",
    "updatedAt",
    "lastLoginAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    username: { bsonType: "string", pattern: "^[a-z0-9_]{3,20}$" },
    displayName: { bsonType: "string", minLength: 1, maxLength: 40 },
    passwordHash: {
      bsonType: "string",
      pattern: "^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$",
    },
    role: { enum: ["member", "student", "admin"] },
    cardId: { bsonType: ["objectId", "null"] },
    mustChangePassword: { bsonType: "bool" },
    isActive: { bsonType: "bool" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    lastLoginAt: { bsonType: ["date", "null"] },
  },
};

const sessionJsonSchema = {
  bsonType: "object",
  required: ["userId", "createdAt", "expiresAt", "lastSeenAt", "userAgent"],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "string", pattern: "^[a-f0-9]{64}$" },
    userId: { bsonType: "objectId" },
    createdAt: { bsonType: "date" },
    expiresAt: { bsonType: "date" },
    lastSeenAt: { bsonType: "date" },
    userAgent: { bsonType: "string", maxLength: 200 },
  },
};

const mediaPointerJsonSchema = {
  bsonType: ["object", "null"],
  required: ["url", "path", "updatedAt"],
  additionalProperties: false,
  properties: {
    url: { bsonType: "string", pattern: "^https://" },
    path: { bsonType: "string", minLength: 1, maxLength: 512 },
    updatedAt: { bsonType: "date" },
  },
};

const cardJsonSchema = {
  bsonType: "object",
  required: [
    "legacyId",
    "slug",
    "nama",
    "jabatan",
    "hobi",
    "catatan",
    "foto",
    "sortOrder",
    "ownerUserId",
    "isPublished",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    legacyId: { bsonType: "string", pattern: "^s[0-9]{2}$" },
    slug: { bsonType: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    nama: { bsonType: "string", minLength: 1, maxLength: 80 },
    jabatan: { bsonType: "string", maxLength: 80 },
    hobi: { bsonType: "string", maxLength: 300 },
    catatan: { bsonType: "string", maxLength: 500 },
    foto: { bsonType: "string", minLength: 1, maxLength: 2048 },
    avatar: mediaPointerJsonSchema,
    background: mediaPointerJsonSchema,
    portfolio: { bsonType: "string", pattern: "^https://", maxLength: 2048 },
    sortOrder: { bsonType: "int", minimum: 1 },
    ownerUserId: { bsonType: ["objectId", "null"] },
    isPublished: { bsonType: "bool" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

const teacherJsonSchema = {
  bsonType: "object",
  required: [
    "id",
    "nama",
    "mapel",
    "role",
    "foto",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    id: { bsonType: "string", pattern: "^g[0-9]{2}$" },
    nama: { bsonType: "string", minLength: 1, maxLength: 100 },
    mapel: { bsonType: "string", minLength: 1, maxLength: 120 },
    role: { enum: ["Guru Teori", "Guru Praktek"] },
    foto: { bsonType: "string", minLength: 1, maxLength: 2048 },
    avatar: mediaPointerJsonSchema,
    background: mediaPointerJsonSchema,
    linktree: { bsonType: "string", pattern: "^https://", maxLength: 2048 },
    sortOrder: { bsonType: "int", minimum: 1 },
    isActive: { bsonType: "bool" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

const rateLimitJsonSchema = {
  bsonType: "object",
  required: ["count", "expiresAt"],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "string", pattern: "^[a-f0-9]{64}$" },
    count: { bsonType: "int", minimum: 0 },
    expiresAt: { bsonType: "date" },
  },
};

const galleryPhotoJsonSchema = {
  bsonType: "object",
  required: [
    "caption",
    "url",
    "path",
    "sortOrder",
    "isPublished",
    "storageDeleted",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    legacyId: { bsonType: "string", pattern: "^p[0-9]{2}$" },
    caption: { bsonType: "string", minLength: 1, maxLength: 500 },
    url: { bsonType: "string", pattern: "^https://" },
    path: { bsonType: "string", minLength: 1, maxLength: 512 },
    sortOrder: { bsonType: "int", minimum: 1 },
    isPublished: { bsonType: "bool" },
    storageDeleted: { bsonType: "bool" },
    deletedAt: { bsonType: "date" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

const mediaUploadJsonSchema = {
  bsonType: "object",
  required: [
    "actorUserId",
    "targetType",
    "targetId",
    "mediaType",
    "bucket",
    "path",
    "sourceSize",
    "contentType",
    "status",
    "createdAt",
    "expiresAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    actorUserId: { bsonType: "objectId" },
    targetType: { enum: ["student", "teacher", "gallery"] },
    targetId: { bsonType: "string", minLength: 1, maxLength: 20 },
    mediaType: { enum: ["avatar", "background", "gallery"] },
    bucket: { bsonType: "string", minLength: 1, maxLength: 100 },
    path: { bsonType: "string", minLength: 1, maxLength: 512 },
    sourceSize: { bsonType: "int", minimum: 1, maximum: 5242880 },
    contentType: { enum: ["image/jpeg", "image/png", "image/webp"] },
    caption: { bsonType: "string", maxLength: 500 },
    status: { enum: ["pending", "processing", "completed", "failed"] },
    createdAt: { bsonType: "date" },
    expiresAt: { bsonType: "date" },
    completedAt: { bsonType: "date" },
  },
};

const mediaCleanupJsonSchema = {
  bsonType: "object",
  required: [
    "bucket",
    "path",
    "reason",
    "status",
    "attempts",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    bucket: { bsonType: "string", minLength: 1, maxLength: 100 },
    path: { bsonType: "string", minLength: 1, maxLength: 512 },
    reason: { enum: ["replacement", "deletion", "staging"] },
    status: { enum: ["pending", "complete"] },
    attempts: { bsonType: "int", minimum: 0 },
    lastAttemptAt: { bsonType: ["date", "null"] },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

const mediaAuditJsonSchema = {
  bsonType: "object",
  required: [
    "actorUserId",
    "action",
    "targetType",
    "targetId",
    "mediaType",
    "createdAt",
  ],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    actorUserId: { bsonType: "objectId" },
    action: {
      enum: [
        "upload",
        "remove",
        "gallery-create",
        "gallery-caption",
        "gallery-order",
        "gallery-remove",
      ],
    },
    targetType: { enum: ["student", "teacher", "gallery"] },
    targetId: { bsonType: "string", minLength: 1, maxLength: 20 },
    mediaType: { enum: ["avatar", "background", "gallery"] },
    createdAt: { bsonType: "date" },
  },
};

const COLLECTION_SCHEMAS = {
  users: userJsonSchema,
  sessions: sessionJsonSchema,
  cards: cardJsonSchema,
  teachers: teacherJsonSchema,
  rate_limits: rateLimitJsonSchema,
  gallery_photos: galleryPhotoJsonSchema,
  media_uploads: mediaUploadJsonSchema,
  media_cleanup: mediaCleanupJsonSchema,
  media_audit: mediaAuditJsonSchema,
};

module.exports = { COLLECTION_SCHEMAS };
