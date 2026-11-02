const { legacyIdSchema, parseObjectId, slugSchema, toPublicCard } = require("../schemas");

const PUBLIC_CARD_PROJECTION = {
  _id: 0,
  legacyId: 1,
  slug: 1,
  nama: 1,
  jabatan: 1,
  hobi: 1,
  catatan: 1,
  foto: 1,
  portfolio: 1,
  sortOrder: 1,
};
const OWNER_CARD_PROJECTION = {
  _id: 1,
  legacyId: 1,
  slug: 1,
  nama: 1,
  jabatan: 1,
  hobi: 1,
  catatan: 1,
  foto: 1,
  portfolio: 1,
  sortOrder: 1,
  ownerUserId: 1,
  isPublished: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function findActiveCardOwners(db) {
  return db
    .collection("users")
    .find(
      { role: { $in: ["student", "admin"] }, isActive: true },
      { projection: { _id: 1 } },
    )
    .toArray();
}

function publicOwnerFilter(activeOwners) {
  return {
    $or: [
      { ownerUserId: null },
      { ownerUserId: { $in: activeOwners.map(user => user._id) } },
    ],
  };
}

async function findPublishedCards(db) {
  const activeOwners = await findActiveCardOwners(db);
  const cards = await db
    .collection("cards")
    .find(
      {
        isPublished: true,
        ...publicOwnerFilter(activeOwners),
      },
      { projection: PUBLIC_CARD_PROJECTION },
    )
    .sort({ sortOrder: 1, legacyId: 1 })
    .toArray();
  return cards.map(toPublicCard);
}

async function findPublishedCardBySlug(db, slug) {
  const checkedSlug = slugSchema.parse(slug);
  const activeOwners = await findActiveCardOwners(db);
  const card = await db.collection("cards").findOne(
    {
      slug: checkedSlug,
      isPublished: true,
      ...publicOwnerFilter(activeOwners),
    },
    { projection: PUBLIC_CARD_PROJECTION },
  );
  return card ? toPublicCard(card) : null;
}

async function findCardOwnedByUser(db, userId) {
  const ownerUserId = parseObjectId(userId);
  return db.collection("cards").findOne(
    { ownerUserId },
    { projection: OWNER_CARD_PROJECTION },
  );
}

async function findCardForUser(db, userId, cardId) {
  const ownerUserId = parseObjectId(userId);
  const id = parseObjectId(cardId);
  return db.collection("cards").findOne(
    { _id: id, ownerUserId },
    { projection: OWNER_CARD_PROJECTION },
  );
}

async function updateCardForUser(db, userId, cardId, changes, now = new Date()) {
  const ownerUserId = parseObjectId(userId);
  const id = parseObjectId(cardId);
  const filter = { _id: id, ownerUserId };
  const $set = { updatedAt: now };
  const $unset = {};
  for (const [field, value] of Object.entries(changes)) {
    if (field === "portfolio" && value === "") {
      $unset.portfolio = "";
    } else {
      $set[field] = value;
    }
  }
  const update = Object.keys($unset).length
    ? { $set, $unset }
    : { $set };
  const result = await db.collection("cards").updateOne(filter, update);
  if (result.matchedCount !== 1) return null;
  return db.collection("cards").findOne(
    filter,
    { projection: OWNER_CARD_PROJECTION },
  );
}

async function findPublishedCardForUser(db, userId) {
  const ownerUserId = parseObjectId(userId);
  return db.collection("cards").findOne(
    { ownerUserId, isPublished: true },
    { projection: PUBLIC_CARD_PROJECTION },
  );
}

async function findCardByLegacyId(db, legacyId) {
  const checkedId = legacyIdSchema.parse(legacyId);
  return db.collection("cards").findOne(
    { legacyId: checkedId },
    { projection: OWNER_CARD_PROJECTION },
  );
}

module.exports = {
  findCardByLegacyId,
  findCardForUser,
  findCardOwnedByUser,
  findPublishedCardForUser,
  findPublishedCardBySlug,
  findPublishedCards,
  updateCardForUser,
};
