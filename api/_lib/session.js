const { createHash, randomBytes } = require("node:crypto");
const { readServerEnv } = require("./env");
const { parseObjectId, toPublicUser } = require("./schemas");

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_PROJECTION = {
  _id: 1,
  userId: 1,
  expiresAt: 1,
  lastSeenAt: 1,
};
const SESSION_USER_PROJECTION = {
  _id: 1,
  username: 1,
  displayName: 1,
  role: 1,
  createdAt: 1,
  cardId: 1,
  mustChangePassword: 1,
  isActive: 1,
};

function hashSessionToken(token) {
  if (typeof token !== "string" || !SESSION_TOKEN_PATTERN.test(token)) {
    return null;
  }
  return createHash("sha256").update(token).digest("hex");
}

function isSecureCookie() {
  return (
    process.env.NODE_ENV === "production" ||
    ["preview", "production"].includes(process.env.VERCEL_ENV)
  );
}

function getCookieName() {
  const configured = readServerEnv().SESSION_COOKIE_NAME;
  return isSecureCookie() && !configured.startsWith("__Host-")
    ? `__Host-${configured}`
    : configured;
}

function getCookieToken(request) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return null;
  const name = getCookieName();
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return SESSION_TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

function sessionCookie(token, maxAge) {
  const attributes = [
    `${getCookieName()}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isSecureCookie()) attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie() {
  const attributes = [
    `${getCookieName()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (isSecureCookie()) attributes.push("Secure");
  return attributes.join("; ");
}

async function createSession(db, userId, userAgent = "", now = new Date()) {
  const env = readServerEnv();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    now.getTime() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.collection("sessions").insertOne({
    _id: hashSessionToken(token),
    userId: parseObjectId(userId),
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 200) : "",
  });
  return {
    cookie: sessionCookie(token, env.SESSION_TTL_DAYS * 24 * 60 * 60),
    expiresAt,
  };
}

async function getSession(db, request, now = new Date()) {
  const token = getCookieToken(request);
  const sessionId = token && hashSessionToken(token);
  if (!sessionId) return null;

  const sessions = db.collection("sessions");
  const session = await sessions.findOne(
    { _id: sessionId, expiresAt: { $gt: now } },
    { projection: SESSION_PROJECTION },
  );
  if (!session) return null;

  const user = await db.collection("users").findOne(
    { _id: session.userId, isActive: true },
    { projection: SESSION_USER_PROJECTION },
  );
  if (!user) {
    await sessions.deleteOne({ _id: sessionId });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() >= 60 * 60 * 1000) {
    await sessions.updateOne(
      { _id: sessionId, lastSeenAt: session.lastSeenAt },
      { $set: { lastSeenAt: now } },
    );
  }
  return {
    sessionId,
    user,
    publicUser: toPublicUser(user),
    mustChangePassword: user.mustChangePassword,
  };
}

async function destroySession(db, request) {
  const token = getCookieToken(request);
  const sessionId = token && hashSessionToken(token);
  if (!sessionId) return false;
  const result = await db.collection("sessions").deleteOne({ _id: sessionId });
  return result.deletedCount > 0;
}

async function destroyAllSessions(db, userId) {
  const result = await db
    .collection("sessions")
    .deleteMany({ userId: parseObjectId(userId) });
  return result.deletedCount;
}

module.exports = {
  clearSessionCookie,
  createSession,
  destroyAllSessions,
  destroySession,
  getCookieName,
  getCookieToken,
  getSession,
  hashSessionToken,
  isSecureCookie,
  sessionCookie,
};
