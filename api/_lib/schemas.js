const { ObjectId } = require("mongodb");
const { z } = require("zod");

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);
const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine(
    value =>
      ![...value].some(character => {
        const code = character.charCodeAt(0);
        return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
      }),
  );
const roleSchema = z.enum(["member", "student", "admin"]);
const objectIdStringSchema = z.string().regex(/^[a-f0-9]{24}$/i);
const legacyIdSchema = z.string().regex(/^s[0-9]{2}$/);
const teacherIdSchema = z.string().regex(/^g[0-9]{2}$/);
const teacherRoleSchema = z.enum(["Guru Teori", "Guru Praktek"]);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);
const httpsUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine(value => value.slice(0, 8).toLowerCase() === "https://");
const photoPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(value => {
    if (httpsUrlSchema.safeParse(value).success) return true;
    return (
      value.startsWith("asset/") &&
      !value.includes("\\") &&
      !/[<>"']/.test(value) &&
      ![...value].some(character => character.charCodeAt(0) <= 0x1f) &&
      !value.split("/").some(part => part === "." || part === "..")
    );
  });

const userDocumentSchema = z
  .object({
    _id: z.instanceof(ObjectId),
    username: usernameSchema,
    displayName: displayNameSchema,
    passwordHash: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/),
    role: roleSchema,
    cardId: z.instanceof(ObjectId).nullable(),
    mustChangePassword: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastLoginAt: z.date().nullable(),
  })
  .strict()
  .superRefine((user, context) => {
    if (user.role === "member" && user.cardId !== null) {
      context.addIssue({
        code: "custom",
        path: ["cardId"],
        message: "Members cannot be linked to a student card.",
      });
    }
  });

const cardDocumentSchema = z
  .object({
    legacyId: legacyIdSchema,
    slug: slugSchema,
    nama: z.string().trim().min(1).max(80),
    jabatan: z.string().max(80),
    hobi: z.string().max(300),
    catatan: z.string().max(500),
    foto: photoPathSchema,
    portfolio: httpsUrlSchema.optional(),
    sortOrder: z.number().int().positive(),
    ownerUserId: z.instanceof(ObjectId).nullable(),
    isPublished: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

const teacherDocumentSchema = z
  .object({
    id: teacherIdSchema,
    nama: z.string().trim().min(1).max(100),
    mapel: z.string().trim().min(1).max(120),
    role: teacherRoleSchema,
    foto: photoPathSchema,
    linktree: httpsUrlSchema.optional(),
    sortOrder: z.number().int().positive(),
    isActive: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

const legacyTeacherSchema = z
  .object({
    id: teacherIdSchema,
    nama: z.string().trim().min(1).max(100),
    mapel: z.string().trim().min(1).max(120),
    role: teacherRoleSchema,
    foto: photoPathSchema,
    linktree: httpsUrlSchema.optional(),
  })
  .strict();

const legacyStudentSchema = z
  .object({
    id: legacyIdSchema,
    nama: z.string().trim().min(1).max(80),
    jabatan: z.string().max(80),
    hobi: z.string().max(300),
    catatan: z.string().max(500),
    foto: photoPathSchema,
    portfolio: httpsUrlSchema.optional(),
  })
  .strict();

const publicUserSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    role: roleSchema,
  })
  .strict();

const publicProfileSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    role: roleSchema,
    joinedAt: z.date(),
  })
  .strict();

const publicCardSchema = z
  .object({
    id: legacyIdSchema,
    slug: slugSchema,
    nama: z.string().min(1).max(80),
    jabatan: z.string().max(80),
    hobi: z.string().max(300),
    catatan: z.string().max(500),
    foto: z.string().min(1).max(2048),
    portfolio: httpsUrlSchema.optional(),
    sortOrder: z.number().int().positive(),
  })
  .strict();

const publicTeacherSchema = z
  .object({
    id: teacherIdSchema,
    nama: z.string().min(1).max(100),
    mapel: z.string().min(1).max(120),
    role: teacherRoleSchema,
    foto: photoPathSchema,
    linktree: httpsUrlSchema.optional(),
    sortOrder: z.number().int().positive(),
  })
  .strict();

function parseObjectId(value) {
  if (value instanceof ObjectId) return value;
  return new ObjectId(objectIdStringSchema.parse(value));
}

function toPublicUser(user) {
  return publicUserSchema.parse({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}

function toPublicProfile(user) {
  return publicProfileSchema.parse({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    joinedAt: user.createdAt,
  });
}

function toPublicCard(card) {
  return publicCardSchema.parse({
    id: card.legacyId,
    slug: card.slug,
    nama: card.nama,
    jabatan: card.jabatan,
    hobi: card.hobi,
    catatan: card.catatan,
    foto: card.foto,
    ...(card.portfolio ? { portfolio: card.portfolio } : {}),
    sortOrder: card.sortOrder,
  });
}

function toPublicTeacher(teacher) {
  return publicTeacherSchema.parse({
    id: teacher.id,
    nama: teacher.nama,
    mapel: teacher.mapel,
    role: teacher.role,
    foto: teacher.foto,
    ...(teacher.linktree ? { linktree: teacher.linktree } : {}),
    sortOrder: teacher.sortOrder,
  });
}

module.exports = {
  cardDocumentSchema,
  displayNameSchema,
  httpsUrlSchema,
  legacyIdSchema,
  legacyStudentSchema,
  legacyTeacherSchema,
  objectIdStringSchema,
  parseObjectId,
  photoPathSchema,
  publicProfileSchema,
  publicCardSchema,
  publicTeacherSchema,
  publicUserSchema,
  roleSchema,
  slugSchema,
  teacherDocumentSchema,
  teacherIdSchema,
  teacherRoleSchema,
  toPublicCard,
  toPublicTeacher,
  toPublicProfile,
  toPublicUser,
  userDocumentSchema,
  usernameSchema,
};
