const { ObjectId } = require("mongodb");
const { z } = require("zod");
const { requireAuth, requireRole } = require("../_lib/auth");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const { requireSupabaseServiceConfig } = require("../_lib/env");
const { getClientIp, incrementRateLimit, readActiveRateLimit } = require("../_lib/rate-limit");
const { requireSameOrigin } = require("../_lib/security");
const { supabaseHeaders, upstreamFailure } = require("./admin-comments");

const COMMENT_COOLDOWN_SECONDS = 30;
const commentBodySchema = z.object({
  content: z.string().trim().min(1).max(500),
  parent_id: z.number().int().positive().nullable().optional(),
}).strict();
const reportBodySchema = z.object({
  comment_id: z.number().int().positive(),
  reason: z.enum(["spam", "bullying", "personal_info", "other"]),
}).strict();
const reviewBodySchema = z.object({
  report_id: z.string().regex(/^[a-f0-9]{24}$/),
}).strict();
const commentRoutes = new Set([
  "comments",
  "comments/report",
  "comments/reports",
  "comments/reports/review",
  "comments/reports/remove",
]);

function isCommentRoute(route) {
  return commentRoutes.has(route);
}

function retryAfterSeconds(rate) {
  return Math.max(1, Math.ceil((rate.expiresAt.getTime() - Date.now()) / 1000));
}

async function getCommentRows(fetchImpl, config, commentId) {
  let upstream;
  try {
    const url = new URL("rest/v1/comments", config.url);
    url.searchParams.set("id", `eq.${commentId}`);
    url.searchParams.set("select", "id,content");
    url.searchParams.set("limit", "1");
    upstream = await fetchImpl(url, {
      headers: supabaseHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "Komentar tidak dapat diverifikasi.");
  }
  if (!upstream.ok) throw upstreamFailure(upstream, await readUpstreamError(upstream));
  try {
    const rows = await upstream.json();
    if (!Array.isArray(rows)) throw new Error("Invalid comment response.");
    return rows;
  } catch {
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "Komentar tidak dapat diverifikasi.");
  }
}

async function readUpstreamError(response) {
  try {
    const body = await response.json();
    return typeof body?.code === "string" ? body.code : "";
  } catch {
    return "";
  }
}

async function getSupabaseConfig(getConfig) {
  try {
    return getConfig();
  } catch {
    throw new ApiError(503, "COMMENT_SERVICE_UNAVAILABLE", "Komentar online belum dikonfigurasi.");
  }
}

async function handlePublicComment({ request, response, db, fetchImpl, getConfig }) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const input = commentBodySchema.parse(await parseJsonBody(request, { maxBytes: 2048 }));
  const config = await getSupabaseConfig(getConfig);
  const keyParts = ["comment-post-ip", getClientIp(request)];
  const count = await incrementRateLimit(db, keyParts, COMMENT_COOLDOWN_SECONDS);
  if (count > 1) {
    const rate = await readActiveRateLimit(db, keyParts);
    const retryAfter = rate ? retryAfterSeconds(rate) : COMMENT_COOLDOWN_SECONDS;
    response.setHeader(
      "Retry-After",
      String(retryAfter),
    );
    throw new ApiError(
      429,
      "COMMENT_COOLDOWN",
      `Tunggu ${retryAfter} detik sebelum mengirim komentar berikutnya.`,
    );
  }

  let upstream;
  try {
    upstream = await fetchImpl(new URL("rest/v1/comments", config.url), {
      method: "POST",
      headers: {
        ...supabaseHeaders(config.serviceRoleKey),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        content: input.content,
        parent_id: input.parent_id ?? null,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    console.warn("Could not connect to Supabase while sending an anonymous comment.");
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "Komentar tidak dapat dikirim.");
  }
  if (!upstream.ok) throw upstreamFailure(upstream, await readUpstreamError(upstream));
  sendJson(response, 201, { ok: true });
}

async function handleCommentReport({ request, response, db, fetchImpl, getConfig }) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const input = reportBodySchema.parse(await parseJsonBody(request, { maxBytes: 2048 }));
  const config = await getSupabaseConfig(getConfig);
  const [comment] = await getCommentRows(fetchImpl, config, input.comment_id);
  if (!comment) {
    throw new ApiError(404, "COMMENT_NOT_FOUND", "Komentar sudah tidak tersedia.");
  }

  const now = new Date();
  const reportFilter = { commentId: input.comment_id, reason: input.reason };
  const reportUpdate = {
    $set: {
      commentContent: comment.content,
      status: "pending",
      updatedAt: now,
    },
    $setOnInsert: {
      commentId: input.comment_id,
      reason: input.reason,
      createdAt: now,
    },
    $inc: { reportCount: 1 },
  };
  try {
    await db.collection("comment_reports").updateOne(reportFilter, reportUpdate, {
      upsert: true,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await db.collection("comment_reports").updateOne(reportFilter, {
      $set: reportUpdate.$set,
      $inc: reportUpdate.$inc,
    });
  }
  sendJson(response, 201, { ok: true });
}

function requireMainAdmin(session) {
  requireRole(session, ["admin"]);
  if (session.user.username !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission.");
  }
}

async function handleReportQueue({ request, response, db }) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const session = await requireAuth(db, request);
  requireMainAdmin(session);
  const reports = await db.collection("comment_reports")
    .find({ status: "pending" })
    .sort({ createdAt: -1 })
    .toArray();
  sendJson(response, 200, {
    reports: reports.map(({ _id, ...report }) => ({
      id: _id.toString(),
      ...report,
    })),
  });
}

async function handleReviewReport({ request, response, db }) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const session = await requireAuth(db, request);
  requireMainAdmin(session);
  const input = reviewBodySchema.parse(await parseJsonBody(request, { maxBytes: 1024 }));
  const now = new Date();
  const result = await db.collection("comment_reports").updateOne(
    { _id: new ObjectId(input.report_id), status: "pending" },
    {
      $set: { status: "reviewed", updatedAt: now },
      $unset: { commentContent: "" },
    },
  );
  if (result.matchedCount !== 1) {
    throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak lagi tersedia.");
  }
  sendJson(response, 200, { ok: true });
}

async function handleRemoveReportedComment({
  request,
  response,
  db,
  fetchImpl,
  getConfig,
}) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const session = await requireAuth(db, request);
  requireMainAdmin(session);
  const input = reviewBodySchema.parse(await parseJsonBody(request, { maxBytes: 1024 }));
  const reportId = new ObjectId(input.report_id);
  const report = await db.collection("comment_reports").findOne({
    _id: reportId,
    status: "pending",
  });
  if (!report) {
    throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak lagi tersedia.");
  }

  const config = await getSupabaseConfig(getConfig);
  let upstream;
  try {
    const url = new URL("rest/v1/comments", config.url);
    url.searchParams.set("id", `eq.${report.commentId}`);
    upstream = await fetchImpl(url, {
      method: "DELETE",
      headers: {
        ...supabaseHeaders(config.serviceRoleKey),
        Prefer: "return=minimal",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    console.warn("Could not connect to Supabase while removing a reported comment.");
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "Komentar tidak dapat dihapus.");
  }
  if (!upstream.ok) throw upstreamFailure(upstream, await readUpstreamError(upstream));

  await db.collection("comment_reports").updateOne(
    { _id: reportId, status: "pending" },
    {
      $set: { status: "removed", updatedAt: new Date() },
      $unset: { commentContent: "" },
    },
  );
  sendJson(response, 200, { ok: true });
}

async function handleCommentRoute({
  request,
  response,
  route,
  db,
  fetchImpl = globalThis.fetch,
  getSupabaseConfig = requireSupabaseServiceConfig,
}) {
  if (!isCommentRoute(route)) return false;
  if (request.method !== "GET") requireSameOrigin(request);
  const dependencies = { request, response, db, fetchImpl, getConfig: getSupabaseConfig };
  if (route === "comments") await handlePublicComment(dependencies);
  else if (route === "comments/report") await handleCommentReport(dependencies);
  else if (route === "comments/reports") await handleReportQueue(dependencies);
  else if (route === "comments/reports/remove") {
    await handleRemoveReportedComment(dependencies);
  } else await handleReviewReport(dependencies);
  return true;
}

module.exports = {
  COMMENT_COOLDOWN_SECONDS,
  commentBodySchema,
  handleCommentRoute,
  isCommentRoute,
  reportBodySchema,
};
