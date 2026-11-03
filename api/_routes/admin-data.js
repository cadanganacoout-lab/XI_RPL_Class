const { z } = require("zod");
const { requireAuth, requireRole } = require("../_lib/auth");
const {
  ApiError,
  parseJsonBody,
  sendJson,
} = require("../_lib/http");
const {
  cardDocumentSchema,
  httpsUrlSchema,
  legacyIdSchema,
  photoPathSchema,
  slugSchema,
  teacherDocumentSchema,
  teacherIdSchema,
  teacherRoleSchema,
  toPublicCard,
  toPublicTeacher,
} = require("../_lib/schemas");
const { enforceLimit } = require("./auth");

const PUBLIC_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";
const EMPTY_OR_HTTPS = z.string().trim().max(2048).refine(
  value => value === "" || httpsUrlSchema.safeParse(value).success,
);
const studentFields = {
  slug: slugSchema,
  nama: z.string().trim().min(1).max(80),
  jabatan: z.string().trim().max(80),
  hobi: z.string().trim().max(300),
  catatan: z.string().trim().max(500),
  foto: photoPathSchema,
  portfolio: EMPTY_OR_HTTPS.optional(),
  sortOrder: z.number().int().positive(),
  isPublished: z.boolean(),
};
const createStudentSchema = z.object({
  nama: studentFields.nama,
  jabatan: studentFields.jabatan,
  hobi: studentFields.hobi,
  catatan: studentFields.catatan,
  foto: studentFields.foto,
  portfolio: studentFields.portfolio,
}).strict();
const updateStudentSchema = z.object(studentFields).partial().strict().refine(
  value => Object.keys(value).length > 0,
);
const teacherFields = {
  nama: z.string().trim().min(1).max(100),
  mapel: z.string().trim().min(1).max(120),
  role: teacherRoleSchema,
  foto: photoPathSchema,
  linktree: EMPTY_OR_HTTPS.optional(),
  sortOrder: z.number().int().positive(),
  isActive: z.boolean(),
};
const createTeacherSchema = z.object({
  nama: teacherFields.nama,
  mapel: teacherFields.mapel,
  role: teacherFields.role,
  foto: teacherFields.foto,
  linktree: teacherFields.linktree,
}).strict();
const updateTeacherSchema = z.object(teacherFields).partial().strict().refine(
  value => Object.keys(value).length > 0,
);

function isAdminDataRoute(route) {
  return route === "teachers" || /^admin\/(?:students|teachers)(?:\/[^/]+)?$/.test(route);
}

function parseRouteId(value, schema) {
  try {
    return schema.parse(decodeURIComponent(value));
  } catch {
    throw new ApiError(400, "INVALID_RECORD_ID", "The request is invalid.");
  }
}

function cardSlug(name, legacyId) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base || "siswa"}-${legacyId}`;
}

function nextId(records, prefix, schema) {
  const number = records.reduce((maximum, record) => {
    const parsed = Number(record[schema].slice(1));
    return Math.max(maximum, parsed);
  }, 0) + 1;
  const id = `${prefix}${String(number).padStart(2, "0")}`;
  if (number > 99) {
    throw new ApiError(409, "RECORD_LIMIT_REACHED", "No more record IDs are available.");
  }
  return id;
}

async function findActiveTeachers(db) {
  const records = await db.collection("teachers")
    .find({ isActive: true })
    .sort({ sortOrder: 1, id: 1 })
    .toArray();
  return records.map(toPublicTeacher);
}

async function requireAdministrator(db, request, response, mutating) {
  const session = await requireAuth(db, request);
  requireRole(session, ["admin"]);
  if (mutating) {
    await enforceLimit(
      db,
      response,
      ["admin-data", session.user._id.toString()],
      120,
      60 * 60,
    );
  }
  return session;
}

async function listAdminStudents(db, response) {
  const records = await db.collection("cards")
    .find({}, {
      projection: {
        _id: 0,
        legacyId: 1,
        slug: 1,
        nama: 1,
        jabatan: 1,
        hobi: 1,
        catatan: 1,
        foto: 1,
        avatar: 1,
        background: 1,
        portfolio: 1,
        sortOrder: 1,
        isPublished: 1,
      },
    })
    .sort({ sortOrder: 1, legacyId: 1 })
    .toArray();
  sendJson(response, 200, {
    students: records.map(record => ({
      ...toPublicCard(record),
      isPublished: record.isPublished,
    })),
  });
}

async function listAdminTeachers(db, response) {
  const records = await db.collection("teachers")
    .find({}, { projection: { _id: 0 } })
    .sort({ sortOrder: 1, id: 1 })
    .toArray();
  sendJson(response, 200, {
    teachers: records.map(record => ({
      ...toPublicTeacher(record),
      isActive: record.isActive,
    })),
  });
}

async function createStudent(db, response, request) {
  const input = createStudentSchema.parse(await parseJsonBody(request));
  const { portfolio, ...fields } = input;
  const cards = db.collection("cards");
  const records = await cards.find({}, {
    projection: { legacyId: 1, sortOrder: 1 },
  }).toArray();
  const legacyId = nextId(records, "s", "legacyId");
  const now = new Date();
  const card = cardDocumentSchema.parse({
    legacyId,
    slug: cardSlug(input.nama, legacyId),
    ...fields,
    ...(portfolio ? { portfolio } : {}),
    sortOrder: records.reduce((max, record) => Math.max(max, record.sortOrder), 0) + 1,
    ownerUserId: null,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  });
  try {
    await cards.insertOne(card);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "RECORD_CONFLICT", "The record conflicts with existing data.");
    }
    throw error;
  }
  sendJson(response, 201, { student: { ...toPublicCard(card), isPublished: true } });
}

async function updateStudent(db, response, request, legacyId) {
  const changes = updateStudentSchema.parse(await parseJsonBody(request));
  const cards = db.collection("cards");
  const $set = { updatedAt: new Date() };
  const $unset = {};
  for (const [field, value] of Object.entries(changes)) {
    if (field === "portfolio" && value === "") $unset.portfolio = "";
    else $set[field] = value;
  }
  const update = Object.keys($unset).length ? { $set, $unset } : { $set };
  let result;
  try {
    result = await cards.updateOne({ legacyId }, update);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "RECORD_CONFLICT", "The record conflicts with existing data.");
    }
    throw error;
  }
  if (result.matchedCount !== 1) {
    throw new ApiError(404, "STUDENT_NOT_FOUND", "Student record not found.");
  }
  const student = await cards.findOne(
    { legacyId },
    { projection: { _id: 0, legacyId: 1, slug: 1, nama: 1, jabatan: 1, hobi: 1, catatan: 1, foto: 1, avatar: 1, background: 1, portfolio: 1, sortOrder: 1, isPublished: 1 } },
  );
  sendJson(response, 200, {
    student: { ...toPublicCard(student), isPublished: student.isPublished },
  });
}

async function archiveStudent(db, response, legacyId) {
  const result = await db.collection("cards").updateOne(
    { legacyId },
    { $set: { isPublished: false, updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) {
    throw new ApiError(404, "STUDENT_NOT_FOUND", "Student record not found.");
  }
  sendJson(response, 200, { ok: true, isPublished: false });
}

async function createTeacher(db, response, request) {
  const input = createTeacherSchema.parse(await parseJsonBody(request));
  const { linktree, ...fields } = input;
  const teachers = db.collection("teachers");
  const records = await teachers.find({}, {
    projection: { id: 1, sortOrder: 1 },
  }).toArray();
  const id = nextId(records, "g", "id");
  const now = new Date();
  const teacher = teacherDocumentSchema.parse({
    id,
    ...fields,
    ...(linktree ? { linktree } : {}),
    sortOrder: records.reduce((max, record) => Math.max(max, record.sortOrder), 0) + 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  try {
    await teachers.insertOne(teacher);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "RECORD_CONFLICT", "The record conflicts with existing data.");
    }
    throw error;
  }
  sendJson(response, 201, { teacher: { ...toPublicTeacher(teacher), isActive: true } });
}

async function updateTeacher(db, response, request, id) {
  const changes = updateTeacherSchema.parse(await parseJsonBody(request));
  const teachers = db.collection("teachers");
  const $set = { updatedAt: new Date() };
  const $unset = {};
  for (const [field, value] of Object.entries(changes)) {
    if (field === "linktree" && value === "") $unset.linktree = "";
    else $set[field] = value;
  }
  let result;
  try {
    result = await teachers.updateOne(
      { id },
      Object.keys($unset).length ? { $set, $unset } : { $set },
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "RECORD_CONFLICT", "The record conflicts with existing data.");
    }
    throw error;
  }
  if (result.matchedCount !== 1) {
    throw new ApiError(404, "TEACHER_NOT_FOUND", "Teacher record not found.");
  }
  const teacher = await teachers.findOne(
    { id },
    { projection: { _id: 0 } },
  );
  sendJson(response, 200, {
    teacher: { ...toPublicTeacher(teacher), isActive: teacher.isActive },
  });
}

async function archiveTeacher(db, response, id) {
  const result = await db.collection("teachers").updateOne(
    { id },
    { $set: { isActive: false, updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) {
    throw new ApiError(404, "TEACHER_NOT_FOUND", "Teacher record not found.");
  }
  sendJson(response, 200, { ok: true, isActive: false });
}

async function handleRecordCollection({ request, response, db, kind }) {
  if (request.method === "GET") {
    if (kind === "students") await listAdminStudents(db, response);
    else await listAdminTeachers(db, response);
    return true;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  if (kind === "students") await createStudent(db, response, request);
  else await createTeacher(db, response, request);
  return true;
}

async function handleRecordItem({ request, response, db, kind, id }) {
  const checkedId = parseRouteId(id, kind === "students" ? legacyIdSchema : teacherIdSchema);
  if (request.method === "PATCH") {
    if (kind === "students") await updateStudent(db, response, request, checkedId);
    else await updateTeacher(db, response, request, checkedId);
    return true;
  }
  if (request.method === "DELETE") {
    if (kind === "students") await archiveStudent(db, response, checkedId);
    else await archiveTeacher(db, response, checkedId);
    return true;
  }
  response.setHeader("Allow", "PATCH, DELETE");
  throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}

async function handleAdminDataRoute({ request, response, route, db }) {
  if (!isAdminDataRoute(route)) return false;
  if (route === "teachers") {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    const teachers = await findActiveTeachers(db);
    sendJson(response, 200, { teachers }, { cacheControl: PUBLIC_CACHE_CONTROL });
    return true;
  }

  const [, kind, id] = route.split("/");
  const mutating = request.method !== "GET";
  await requireAdministrator(db, request, response, mutating);
  if (!["students", "teachers"].includes(kind)) {
    throw new ApiError(404, "NOT_FOUND", "Route not found.");
  }
  if (id) {
    return handleRecordItem({ request, response, db, kind, id });
  }
  return handleRecordCollection({ request, response, db, kind });
}

module.exports = {
  handleAdminDataRoute,
  isAdminDataRoute,
  createStudentSchema,
  createTeacherSchema,
  updateStudentSchema,
  updateTeacherSchema,
};
