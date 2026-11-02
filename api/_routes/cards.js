const { z } = require("zod");
const { enforceLimit } = require("./auth");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const { requireAuth, requireRole } = require("../_lib/auth");
const { getSession } = require("../_lib/session");
const {
  findCardForUser,
  findPublishedCardBySlug,
  findPublishedCards,
  updateCardForUser,
} = require("../_lib/repos/cards");
const { httpsUrlSchema, slugSchema, toPublicCard } = require("../_lib/schemas");

const PUBLIC_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";
const cardUpdateBodySchema = z
  .object({
    hobi: z.string().trim().max(300).optional(),
    catatan: z.string().trim().max(500).optional(),
    portfolio: z
      .string()
      .trim()
      .max(2048)
      .refine(
        value => value === "" || httpsUrlSchema.safeParse(value).success,
        "Portfolio must be an HTTPS URL.",
      )
      .optional(),
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, {
    message: "At least one editable field is required.",
  });

function isCardRoute(route) {
  return route === "cards" || /^cards\/[^/]+$/.test(route);
}

function routeSlug(route) {
  try {
    return slugSchema.parse(decodeURIComponent(route.slice("cards/".length)));
  } catch {
    throw new ApiError(400, "INVALID_CARD_SLUG", "The request is invalid.");
  }
}

async function requireCardOwner(db, request) {
  const session = await requireAuth(db, request);
  requireRole(session, ["student", "admin"]);
  if (!session.user.cardId) {
    throw new ApiError(404, "CARD_NOT_FOUND", "Card not found.");
  }
  return session;
}

async function handlePrivateCardRoute({ request, response, db }) {
  if (!["GET", "PATCH"].includes(request.method)) {
    response.setHeader("Allow", "GET, PATCH");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const session = await requireCardOwner(db, request);
  if (request.method === "GET") {
    const card = await findCardForUser(
      db,
      session.user._id,
      session.user.cardId,
    );
    if (!card) throw new ApiError(404, "CARD_NOT_FOUND", "Card not found.");
    sendJson(response, 200, { card: toPublicCard(card) });
    return;
  }

  const changes = cardUpdateBodySchema.parse(await parseJsonBody(request));
  await enforceLimit(
    db,
    response,
    ["card-edit-user", session.user._id.toString()],
    30,
    60 * 60,
  );
  const card = await updateCardForUser(
    db,
    session.user._id,
    session.user.cardId,
    changes,
  );
  if (!card) throw new ApiError(404, "CARD_NOT_FOUND", "Card not found.");
  sendJson(response, 200, { card: toPublicCard(card) });
}

async function handleCardRoute({ request, response, route, db }) {
  if (!isCardRoute(route)) return false;
  if (route === "cards/me") {
    await handlePrivateCardRoute({ request, response, db });
    return true;
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  const session = await getSession(db, request);
  if (session?.mustChangePassword) {
    throw new ApiError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Change your password before continuing.",
    );
  }
  if (route === "cards") {
    const cards = await findPublishedCards(db);
    sendJson(response, 200, { cards }, { cacheControl: PUBLIC_CACHE_CONTROL });
    return true;
  }

  const card = await findPublishedCardBySlug(db, routeSlug(route));
  if (!card) throw new ApiError(404, "NOT_FOUND", "Card not found.");
  sendJson(response, 200, { card }, { cacheControl: PUBLIC_CACHE_CONTROL });
  return true;
}

module.exports = {
  PUBLIC_CACHE_CONTROL,
  cardUpdateBodySchema,
  handleCardRoute,
  isCardRoute,
};
