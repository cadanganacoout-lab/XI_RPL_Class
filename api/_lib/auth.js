const { ApiError } = require("./http");
const { getSession } = require("./session");

async function requireAuth(db, request, { allowMustChangePassword = false } = {}) {
  const session = await getSession(db, request);
  if (!session) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in.");
  }
  if (session.mustChangePassword && !allowMustChangePassword) {
    throw new ApiError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Change your password before continuing.",
    );
  }
  return session;
}

function requireRole(session, roles) {
  if (!Array.isArray(roles) || !roles.includes(session.user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission.");
  }
  return session;
}

module.exports = { requireAuth, requireRole };
