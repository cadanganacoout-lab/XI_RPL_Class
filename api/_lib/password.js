const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { ApiError } = require("./http");

const BCRYPT_COST = 12;
const COMMON_PASSWORD_BASES = [
  "password",
  "qwerty",
  "welcome",
  "letmein",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "master",
  "sunshine",
  "princess",
  "whatever",
  "trustno1",
  "secret",
  "login",
  "user",
  "passw0rd",
  "student",
  "indonesia",
  "merdeka",
  "semangat",
  "bismillah",
  "kelas",
  "sekolah",
  "sterida",
  "ponorogo",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];
const COMMON_PASSWORD_SUFFIXES = [
  "1",
  "12",
  "123",
  "1234",
  "12345",
  "123456",
  "2023",
  "2024",
  "2025",
  "2026",
  "!",
];
const COMMON_PASSWORDS = new Set([
  "123456", "123456789", "12345678", "1234567890", "password", "password1",
  "password123", "qwerty", "qwerty123", "abc123", "111111", "000000",
  "iloveyou", "admin", "admin123", "welcome", "welcome123", "letmein",
  "monkey", "dragon", "football", "master", "sunshine", "princess",
  "whatever", "trustno1", "secret", "login", "user", "passw0rd",
  "123123", "654321", "00000000", "1q2w3e4r", "qwertyuiop", "asdfghjkl",
  "zxcvbnm", "zaq12wsx", "qazwsx", "iloveyou1", "changeme", "student",
  "student123", "indonesia", "indonesia123", "merdeka", "semangat",
  "bismillah", "kelas123", "sekolah123", "smk123", "terserah",
  ...COMMON_PASSWORD_BASES.flatMap(base =>
    COMMON_PASSWORD_SUFFIXES.map(suffix => `${base}${suffix}`),
  ),
]);
const dummyHashPromise = bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_COST);

function assertBcryptLength(password) {
  if (typeof password !== "string") {
    throw new ApiError(400, "INVALID_PASSWORD", "Password must be text.");
  }
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength < 10 || byteLength > 72) {
    throw new ApiError(
      400,
      "INVALID_PASSWORD",
      "Password must be between 10 and 72 UTF-8 bytes.",
    );
  }
}

function validateNewPassword(password, username) {
  assertBcryptLength(password);
  const normalizedPassword = password.trim().toLowerCase();
  if (
    normalizedPassword === username.trim().toLowerCase() ||
    COMMON_PASSWORDS.has(normalizedPassword)
  ) {
    throw new ApiError(400, "WEAK_PASSWORD", "Choose a less common password.");
  }
}

async function hashPassword(password, username) {
  validateNewPassword(password, username);
  return bcrypt.hash(password, BCRYPT_COST);
}

async function verifyPassword(password, passwordHash) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
    await bcrypt.compare("invalid-password", await dummyHashPromise);
    return false;
  }
  const validHash =
    typeof passwordHash === "string" &&
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash);
  const matches = await bcrypt.compare(
    password,
    validHash ? passwordHash : await dummyHashPromise,
  );
  return validHash && matches;
}

function getDummyPasswordHash() {
  return dummyHashPromise;
}

module.exports = {
  BCRYPT_COST,
  assertBcryptLength,
  getDummyPasswordHash,
  hashPassword,
  validateNewPassword,
  verifyPassword,
};
