const { handleApiError, sendJson, ApiError } = require("./_lib/http");
const { getDb } = require("./_lib/db");
const { requireSameOrigin } = require("./_lib/security");
const { handleAuthRoute, isAuthRoute } = require("./_routes/auth");
const { handleCardRoute, isCardRoute } = require("./_routes/cards");
const { handleContentRoute, isContentRoute } = require("./_routes/content");

function createHandler({ getDatabase = getDb } = {}) {
  return async function handler(request, response) {
    await handleApiError(response, async () => {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const route = pathname.replace(/^\/api\/?/, "");

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

      throw new ApiError(404, "NOT_FOUND", "Route not found.");
    });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.config = { api: { bodyParser: false } };
