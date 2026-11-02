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
    portfolio: { bsonType: "string", pattern: "^https://", maxLength: 2048 },
    sortOrder: { bsonType: "int", minimum: 1 },
    ownerUserId: { bsonType: ["objectId", "null"] },
    isPublished: { bsonType: "bool" },
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

const COLLECTION_SCHEMAS = {
  users: userJsonSchema,
  sessions: sessionJsonSchema,
  cards: cardJsonSchema,
  rate_limits: rateLimitJsonSchema,
};

module.exports = { COLLECTION_SCHEMAS };
