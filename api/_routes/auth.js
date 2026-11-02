const { ObjectId } = require("mongodb");
const { z } = require("zod");
const { ApiError, parseJsonBody, sendJson } = require("../_lib/http");
const {
  getDummyPasswordHash,
  hashPassword,
  verifyPassword,
} = require("../_lib/password");
const {
  clearRateLimit,
  getClientIp,
  incrementRateLimit,
  readActiveRateLimit,
} = require("../_lib/rate-limit");
const {
  clearSessionCookie,
  createSession,
  destroyAllSessions,
  destroySession,
  getSession,
} = require("../_lib/session");
const {
  displayNameSchema,
  toPublicUser,
  usernameSchema,
  userDocumentSchema,
} = require("../_lib/schemas");
const { requireSameOrigin } = require("../_lib/security");
const {
  findAuthUserByUsername,
} = require("../_lib/repos/users");

const passwordInputSchema = z.string().min(1).max(1024);
const registerBodySchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    password: passwordInputSchema,
  })
  .strict();
const changePasswordBodySchema = z
  .object({
    currentPassword: passwordInputSchema,
    newPassword: passwordInputSchema,
  })
  .strict();
const loginBodySchema = z
  .object({
    username: usernameSchema,
    password: passwordInputSchema,
  })
  .strict();
const authRoutes = new Set([
  "auth/register",
  "auth/login",
  "auth/me",
  "auth/logout",
  "auth/change-password",
]);

function isAuthRoute(route) {
  return authRoutes.has(route);
}

function retryAfterSeconds(rate) {
  return Math.max(1, Math.ceil((rate.expiresAt.getTime() - Date.now()) / 1000));
}

async function enforceLimit(db, response, keyParts, limit, windowSec) {
  const count = await incrementRateLimit(db, keyParts, windowSec);
  if (count <= limit) return;
  const rate = await readActiveRateLimit(db, keyParts);
  response.setHeader(
    "Retry-After",
    String(rate ? retryAfterSeconds(rate) : windowSec),
  );
  throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
}

async function enforceExistingFailureLimit(db, response, keyParts, limit) {
  const rate = await readActiveRateLimit(db, keyParts);
  if (rate && rate.count >= limit) {
    response.setHeader("Retry-After", String(retryAfterSeconds(rate)));
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
  }
}

async function handleRegister(request, response, db) {
  const input = registerBodySchema.parse(await parseJsonBody(request));
  const ipKey = ["register-ip", getClientIp(request)];
  await enforceLimit(db, response, ipKey, 5, 60 * 60);
  const passwordHash = await hashPassword(input.password, input.username);
  const now = new Date();
  const user = userDocumentSchema.parse({
    _id: new ObjectId(),
    username: input.username,
    displayName: input.displayName,
    passwordHash,
    role: "member",
    cardId: null,
    mustChangePassword: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  });

  try {
    await db.collection("users").insertOne(user);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "USERNAME_UNAVAILABLE", "Username tidak tersedia.");
    }
    throw error;
  }

  const session = await createSession(
    db,
    user._id,
    request.headers["user-agent"],
    now,
  );
  response.setHeader("Set-Cookie", session.cookie);
  sendJson(response, 201, { user: toPublicUser(user), mustChangePassword: false });
}

async function handleLogin(request, response, db) {
  const input = loginBodySchema.parse(await parseJsonBody(request));
  const ipKey = ["login-ip", getClientIp(request)];
  const usernameKey = ["login-username", input.username];
  await enforceLimit(db, response, ipKey, 10, 15 * 60);
  await enforceExistingFailureLimit(db, response, usernameKey, 5);

  const user = await findAuthUserByUsername(db, input.username);
  const validPassword = await verifyPassword(
    input.password,
    user?.passwordHash || (await getDummyPasswordHash()),
  );
  if (!user || !user.isActive || !validPassword) {
    await incrementRateLimit(db, usernameKey, 15 * 60);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Username atau password salah");
  }

  await clearRateLimit(db, usernameKey);
  await destroySession(db, request);
  const now = new Date();
  await db.collection("users").updateOne(
    { _id: user._id, isActive: true },
    { $set: { lastLoginAt: now, updatedAt: now } },
  );
  const session = await createSession(
    db,
    user._id,
    request.headers["user-agent"],
    now,
  );
  response.setHeader("Set-Cookie", session.cookie);
  sendJson(response, 200, {
    user: toPublicUser(user),
    mustChangePassword: user.mustChangePassword,
  });
}

async function handleMe(request, response, db) {
  const session = await getSession(db, request);
  sendJson(response, 200, {
    user: session
      ? { ...session.publicUser, mustChangePassword: session.mustChangePassword }
      : null,
  });
}

async function handleLogout(request, response, db) {
  await destroySession(db, request);
  response.setHeader("Set-Cookie", clearSessionCookie());
  sendJson(response, 200, { ok: true });
}

async function handleChangePassword(request, response, db) {
  const session = await getSession(db, request);
  if (!session) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in.");
  }
  if (session.user.role === "member" && !session.mustChangePassword) {
    throw new ApiError(403, "FORBIDDEN", "Ask an admin to update this account.");
  }
  const input = changePasswordBodySchema.parse(await parseJsonBody(request));
  const keyParts = ["change-password-user", session.user._id.toString()];
  await enforceLimit(db, response, keyParts, 5, 15 * 60);
  const user = await findAuthUserByUsername(db, session.user.username);
  const validCurrentPassword = await verifyPassword(
    input.currentPassword,
    user?.passwordHash,
  );
  if (!user || !user.isActive || !validCurrentPassword) {
    throw new ApiError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  const passwordHash = await hashPassword(input.newPassword, user.username);
  if (await verifyPassword(input.newPassword, user.passwordHash)) {
    throw new ApiError(400, "PASSWORD_UNCHANGED", "Choose a new password.");
  }
  const now = new Date();
  const update = await db.collection("users").updateOne(
    { _id: user._id, isActive: true },
    { $set: { passwordHash, mustChangePassword: false, updatedAt: now } },
  );
  if (update.matchedCount !== 1) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in.");
  }
  await destroyAllSessions(db, user._id);
  const newSession = await createSession(
    db,
    user._id,
    request.headers["user-agent"],
    now,
  );
  response.setHeader("Set-Cookie", newSession.cookie);
  sendJson(response, 200, { user: toPublicUser(user), mustChangePassword: false });
}

async function handleAuthRoute({ request, response, route, db }) {
  if (!isAuthRoute(route)) return false;
  if (request.method === "POST") requireSameOrigin(request);
  const methodByRoute = {
    "auth/register": { method: "POST", handler: handleRegister },
    "auth/login": { method: "POST", handler: handleLogin },
    "auth/me": { method: "GET", handler: handleMe },
    "auth/logout": { method: "POST", handler: handleLogout },
    "auth/change-password": { method: "POST", handler: handleChangePassword },
  };
  const definition = methodByRoute[route];
  if (request.method !== definition.method) {
    response.setHeader("Allow", definition.method);
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
  await definition.handler(request, response, db);
  return true;
}

module.exports = {
  handleAuthRoute,
  isAuthRoute,
  loginBodySchema,
  registerBodySchema,
  changePasswordBodySchema,
  enforceLimit,
};
