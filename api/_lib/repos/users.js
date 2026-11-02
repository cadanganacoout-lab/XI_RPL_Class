const { parseObjectId, toPublicUser, usernameSchema } = require("../schemas");

const PUBLIC_USER_PROJECTION = {
  _id: 0,
  username: 1,
  displayName: 1,
  role: 1,
};
const PROFILE_USER_PROJECTION = {
  _id: 1,
  username: 1,
  displayName: 1,
  role: 1,
  createdAt: 1,
  cardId: 1,
  mustChangePassword: 1,
  isActive: 1,
};
const AUTH_USER_PROJECTION = {
  _id: 1,
  username: 1,
  displayName: 1,
  passwordHash: 1,
  role: 1,
  cardId: 1,
  createdAt: 1,
  mustChangePassword: 1,
  isActive: 1,
  lastLoginAt: 1,
};

async function findAuthUserByUsername(db, username) {
  const checkedUsername = usernameSchema.parse(username);
  return db.collection("users").findOne(
    { username: checkedUsername },
    { projection: AUTH_USER_PROJECTION },
  );
}

async function findPublicUserByUsername(db, username) {
  const checkedUsername = usernameSchema.parse(username);
  const user = await db.collection("users").findOne(
    { username: checkedUsername, isActive: true },
    { projection: PUBLIC_USER_PROJECTION },
  );
  return user ? toPublicUser(user) : null;
}

async function findProfileUserByUsername(db, username) {
  const checkedUsername = usernameSchema.parse(username);
  return db.collection("users").findOne(
    { username: checkedUsername, isActive: true },
    { projection: PROFILE_USER_PROJECTION },
  );
}

async function findUserById(db, userId) {
  const id = parseObjectId(userId);
  return db.collection("users").findOne(
    { _id: id, isActive: true },
    { projection: AUTH_USER_PROJECTION },
  );
}

async function updateDisplayNameForUser(db, userId, displayName, now = new Date()) {
  const id = parseObjectId(userId);
  const users = db.collection("users");
  const result = await users.updateOne(
    {
      _id: id,
      isActive: true,
      role: { $in: ["student", "admin"] },
    },
    { $set: { displayName, updatedAt: now } },
  );
  if (result.matchedCount !== 1) return null;
  return users.findOne(
    { _id: id, isActive: true },
    { projection: PROFILE_USER_PROJECTION },
  );
}

module.exports = {
  findAuthUserByUsername,
  findProfileUserByUsername,
  findPublicUserByUsername,
  findUserById,
  updateDisplayNameForUser,
};
