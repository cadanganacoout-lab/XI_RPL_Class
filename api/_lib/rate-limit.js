const { createHash } = require("node:crypto");
const { isIP } = require("node:net");

function hashRateKey(keyParts) {
  if (
    !Array.isArray(keyParts) ||
    keyParts.length === 0 ||
    !keyParts.every(part => typeof part === "string" && part.length > 0)
  ) {
    throw new TypeError("Rate-limit keys must be non-empty strings.");
  }
  return createHash("sha256").update(JSON.stringify(keyParts)).digest("hex");
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const candidates =
    typeof forwarded === "string" ? forwarded.split(",") : [];
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string") candidates.push(realIp);
  for (const candidate of candidates) {
    const address = candidate.trim();
    if (isIP(address)) return address;
  }
  return "unknown";
}

async function readActiveRateLimit(db, keyParts, now = new Date()) {
  const key = hashRateKey(keyParts);
  return db.collection("rate_limits").findOne(
    { _id: key, expiresAt: { $gt: now } },
    { projection: { _id: 0, count: 1, expiresAt: 1 } },
  );
}

async function incrementRateLimit(db, keyParts, windowSec, now = new Date()) {
  if (!Number.isInteger(windowSec) || windowSec < 1) {
    throw new TypeError("Rate-limit windows must be positive integer seconds.");
  }
  const key = hashRateKey(keyParts);
  const collection = db.collection("rate_limits");
  const expiresAt = new Date(now.getTime() + windowSec * 1000);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const active = await collection.findOneAndUpdate(
      { _id: key, expiresAt: { $gt: now } },
      { $inc: { count: 1 } },
      { returnDocument: "after", projection: { _id: 0, count: 1 } },
    );
    const activeDocument =
      active && Object.prototype.hasOwnProperty.call(active, "value")
        ? active.value
        : active;
    if (activeDocument) return activeDocument.count;

    const reset = await collection.updateOne(
      { _id: key, expiresAt: { $lte: now } },
      { $set: { count: 1, expiresAt } },
    );
    if (reset.modifiedCount > 0) return 1;

    try {
      await collection.insertOne({ _id: key, count: 1, expiresAt });
      return 1;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new Error("Could not update the rate-limit counter.");
}

async function clearRateLimit(db, keyParts) {
  const result = await db
    .collection("rate_limits")
    .deleteOne({ _id: hashRateKey(keyParts) });
  return result.deletedCount > 0;
}

module.exports = {
  clearRateLimit,
  getClientIp,
  hashRateKey,
  incrementRateLimit,
  readActiveRateLimit,
};
