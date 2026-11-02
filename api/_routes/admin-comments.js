const { z } = require("zod");
const { requireAuth, requireRole } = require("../_lib/auth");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const { requireSupabaseServiceConfig } = require("../_lib/env");

const adminCommentBodySchema = z
  .object({
    content: z.string().trim().min(1).max(500),
    parent_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

const insertedCommentSchema = z
  .object({
    id: z.number().int().positive(),
    content: z.string().min(1).max(500),
    parent_id: z.number().int().positive().nullable(),
    created_at: z.string().datetime(),
    author_name: z.string().trim().min(1).max(40),
  })
  .strict();

function isAdminCommentRoute(route) {
  return route === "comments/admin";
}

async function handleAdminCommentRoute({
  request,
  response,
  db,
  fetchImpl = globalThis.fetch,
  getSupabaseConfig = requireSupabaseServiceConfig,
}) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const session = await requireAuth(db, request);
  requireRole(session, ["admin"]);
  if (session.user.username !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission.");
  }
  const input = adminCommentBodySchema.parse(await parseJsonBody(request));
  let config;
  try {
    config = getSupabaseConfig();
  } catch {
    throw new ApiError(503, "COMMENT_SERVICE_UNAVAILABLE", "Admin comments are not configured.");
  }

  let upstream;
  try {
    upstream = await fetchImpl(new URL("rest/v1/comments", config.url), {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        content: input.content,
        parent_id: input.parent_id ?? null,
        author_name: session.user.displayName,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "The comment could not be sent.");
  }

  if (!upstream.ok) {
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "The comment could not be sent.");
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "The comment service returned an invalid response.");
  }
  const parsed = insertedCommentSchema.safeParse(Array.isArray(payload) ? payload[0] : null);
  if (!parsed.success) {
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "The comment service returned an invalid response.");
  }
  sendJson(response, 201, { comment: parsed.data });
}

module.exports = {
  adminCommentBodySchema,
  handleAdminCommentRoute,
  isAdminCommentRoute,
};
