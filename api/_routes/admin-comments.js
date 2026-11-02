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

async function readUpstreamError(response) {
  try {
    const body = await response.json();
    return typeof body?.code === "string" ? body.code : "";
  } catch {
    return "";
  }
}

function upstreamFailure(response, code) {
  const knownCodes = new Set([
    "PGRST204",
    "PGRST205",
    "42501",
    "23503",
    "23514",
  ]);
  const safeCode = knownCodes.has(code) ? code : "UNKNOWN";
  console.warn("Admin comment request rejected by Supabase.", {
    status: response.status,
    code: safeCode,
  });

  if (code === "PGRST204") {
    return new ApiError(
      502,
      "COMMENT_SCHEMA_MISSING",
      "Supabase is missing the author_name column. Apply supabase/comments.sql to this project.",
    );
  }
  if (code === "PGRST205") {
    return new ApiError(
      502,
      "COMMENT_TABLE_MISSING",
      "Supabase cannot find public.comments. Apply supabase/comments.sql to this project.",
    );
  }
  if (response.status === 401) {
    return new ApiError(
      502,
      "COMMENT_SERVICE_AUTH",
      "Supabase did not accept the server key. Check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY belong to the same project and redeploy.",
    );
  }
  if (response.status === 403 || code === "42501") {
    return new ApiError(
      502,
      "COMMENT_SERVICE_PERMISSION",
      "Supabase authenticated the request but denied table access. Re-run the grants in supabase/comments.sql, then retry.",
    );
  }
  if (code === "23503") {
    return new ApiError(
      400,
      "COMMENT_PARENT_NOT_FOUND",
      "The comment being replied to no longer exists. Reload comments and try again.",
    );
  }
  if (code === "23514") {
    return new ApiError(
      400,
      "COMMENT_INVALID",
      "Supabase rejected the comment content. Check that it is between 1 and 500 characters.",
    );
  }
  return new ApiError(
    502,
    "COMMENT_SERVICE_ERROR",
    `Supabase could not save the comment (HTTP ${response.status}). Check the server logs for the safe error code.`,
  );
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
    console.warn("Could not connect to Supabase while sending an admin comment.");
    throw new ApiError(502, "COMMENT_SERVICE_ERROR", "The comment could not be sent.");
  }

  if (!upstream.ok) {
    throw upstreamFailure(upstream, await readUpstreamError(upstream));
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
  upstreamFailure,
};
