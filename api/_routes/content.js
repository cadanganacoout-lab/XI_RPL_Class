const { z } = require("zod");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const { requireAuth } = require("../_lib/auth");
const { getSession } = require("../_lib/session");
const { enforceLimit } = require("./auth");
const { requireSameOrigin } = require("../_lib/security");
const {
  findCardOwnedByUser,
  findPublishedCardForUser,
} = require("../_lib/repos/cards");
const {
  findProfileUserByUsername,
  updateDisplayNameForUser,
} = require("../_lib/repos/users");
const {
  displayNameSchema,
  toPublicCard,
  toPublicProfile,
  usernameSchema,
} = require("../_lib/schemas");

const profileUpdateBodySchema = z
  .object({ displayName: displayNameSchema })
  .strict();

function isContentRoute(route) {
  return (
    route === "profile/me" ||
    /^profile\/[^/]+$/.test(route) ||
    /^profiles\/[^/]+$/.test(route)
  );
}

function routeParameter(route, prefix) {
  const encoded = route.slice(prefix.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new ApiError(400, "INVALID_ROUTE_PARAMETER", "The request is invalid.");
  }
}

async function handleContentRoute({ request, response, route, db }) {
  if (!isContentRoute(route)) return false;
  const isOwnProfile = route === "profile/me";
  if (request.method !== "GET" && !(isOwnProfile && request.method === "PATCH")) {
    response.setHeader("Allow", isOwnProfile ? "GET, PATCH" : "GET");
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  if (request.method === "PATCH") requireSameOrigin(request);
  if (!isOwnProfile) {
    const session = await getSession(db, request);
    if (session?.mustChangePassword) {
      throw new ApiError(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Change your password before continuing.",
      );
    }
  }

  if (isOwnProfile && request.method === "PATCH") {
    const session = await requireAuth(db, request);
    if (!["student", "admin"].includes(session.user.role)) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission.");
    }
    const input = profileUpdateBodySchema.parse(await parseJsonBody(request));
    await enforceLimit(
      db,
      response,
      ["profile-edit-user", session.user._id.toString()],
      10,
      60 * 60,
    );
    const updatedUser = await updateDisplayNameForUser(
      db,
      session.user._id,
      input.displayName,
    );
    if (!updatedUser) {
      throw new ApiError(401, "UNAUTHENTICATED", "Please sign in.");
    }
    sendJson(response, 200, { user: toPublicProfile(updatedUser) });
    return true;
  }

  if (isOwnProfile) {
    const session = await requireAuth(db, request);
    let card = null;
    if (session.user.role === "student" && session.user.cardId) {
      const ownedCard = await findCardOwnedByUser(db, session.user._id);
      if (
        ownedCard &&
        ownedCard._id.equals(session.user.cardId) &&
        ownedCard.isPublished
      ) {
        card = toPublicCard(ownedCard);
      }
    }
    sendJson(response, 200, {
      user: toPublicProfile(session.user),
      mustChangePassword: false,
      card,
    });
    return true;
  }

  const routePrefix = route.startsWith("profiles/") ? "profiles/" : "profile/";
  const username = usernameSchema.parse(
    routeParameter(route, routePrefix),
  );
  const user = await findProfileUserByUsername(db, username);
  if (!user || user.role === "admin") {
    throw new ApiError(404, "NOT_FOUND", "Profile not found.");
  }

  const card =
    user.role === "student"
      ? await findPublishedCardForUser(db, user._id)
      : null;
  sendJson(response, 200, {
    user: toPublicProfile(user),
    card: card ? toPublicCard(card) : null,
  });
  return true;
}

module.exports = { handleContentRoute, isContentRoute };
