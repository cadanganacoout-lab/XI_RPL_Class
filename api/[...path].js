const { handleApiError, sendJson, ApiError } = require("./_lib/http");
const { getDb } = require("./_lib/db");
const { requireSameOrigin } = require("./_lib/security");
const { handleAuthRoute, isAuthRoute } = require("./_routes/auth");
const { handleCardRoute, isCardRoute } = require("./_routes/cards");
const { handleContentRoute, isContentRoute } = require("./_routes/content");
const { handleAdminDataRoute, isAdminDataRoute } = require("./_routes/admin-data");
const { handleMediaRoute, isMediaRoute } = require("./_routes/media");
const { requireSupabaseServiceConfig } = require("./_lib/env");
const {
  handleAdminCommentRoute,
  isAdminCommentRoute,
} = require("./_routes/admin-comments");

function createHandler({
  getDatabase = getDb,
  fetchImpl = globalThis.fetch,
  getSupabaseConfig,
} = {}) {
  return async function handler(request, response) {
    await handleApiError(response, async () => {
      const requestUrl = new URL(request.url, "http://localhost");
      const pathname = requestUrl.pathname;
      const route =
        pathname === "/api/[...path]"
          ? requestUrl.searchParams.get("route") || ""
          : pathname.replace(/^\/api\/?/, "");

      if (route === "health") {
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET");
          throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        }
        sendJson(response, 200, { ok: true });
        return;
      }

      if (isAuthRoute(route)) {
        if (request.method === "POST") requireSameOrigin(request);
        const db = await getDatabase();
        await handleAuthRoute({ request, response, route, db });
        return;
      }

      if (isCardRoute(route)) {
        if (request.method !== "GET") requireSameOrigin(request);
        const db = await getDatabase();
        await handleCardRoute({ request, response, route, db });
        return;
      }

      if (isContentRoute(route)) {
        if (request.method === "PATCH") requireSameOrigin(request);
        const db = await getDatabase();
        await handleContentRoute({ request, response, route, db });
        return;
      }

      if (isAdminDataRoute(route)) {
        if (route !== "teachers" && request.method !== "GET") requireSameOrigin(request);
        const db = await getDatabase();
        await handleAdminDataRoute({ request, response, route, db });
        return;
      }

      if (isMediaRoute(route)) {
        if (request.method !== "GET") requireSameOrigin(request);
        const db = await getDatabase();
        await handleMediaRoute({
          request,
          response,
          route,
          db,
          fetchImpl,
          getSupabaseConfig: getSupabaseConfig || requireSupabaseServiceConfig,
        });
        return;
      }

      if (isAdminCommentRoute(route)) {
        if (request.method === "POST") requireSameOrigin(request);
        const db = await getDatabase();
        await handleAdminCommentRoute({
          request,
          response,
          db,
          fetchImpl,
          ...(getSupabaseConfig ? { getSupabaseConfig } : {}),
        });
        return;
      }

      throw new ApiError(404, "NOT_FOUND", "Route not found.");
    });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.config = { api: { bodyParser: false } };
