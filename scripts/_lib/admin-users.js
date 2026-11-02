const { randomInt } = require("node:crypto");
const { createInterface } = require("node:readline/promises");
const { ObjectId } = require("mongodb");
const { getDb } = require("../../api/_lib/db");
const { readServerEnv } = require("../../api/_lib/env");
const { hashPassword } = require("../../api/_lib/password");
const { destroyAllSessions } = require("../../api/_lib/session");
const {
  displayNameSchema,
  slugSchema,
  userDocumentSchema,
  usernameSchema,
} = require("../../api/_lib/schemas");

const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-+";

class AdminCliError extends Error {}

function parseOptions(args, valueOptions, flagOptions = []) {
  const allowedValues = new Set(valueOptions);
  const allowedFlags = new Set(flagOptions);
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new AdminCliError(`Unexpected argument: ${argument}`);
    }

    const name = argument.slice(2);
    if (allowedFlags.has(name)) {
      if (options[name]) throw new AdminCliError(`Duplicate option: --${name}`);
      options[name] = true;
      continue;
    }
    if (!allowedValues.has(name)) {
      throw new AdminCliError(`Unknown option: --${name}`);
    }
    if (options[name] !== undefined) {
      throw new AdminCliError(`Duplicate option: --${name}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new AdminCliError(`Option --${name} requires a value.`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
}

function requireOptions(options, required) {
  for (const name of required) {
    if (typeof options[name] !== "string" || options[name].trim() === "") {
      throw new AdminCliError(`Required option missing: --${name}`);
    }
  }
}

function requireDatabaseTarget(options, source = process.env) {
  const env = readServerEnv(source);
  if (!env.MONGODB_DB) {
    throw new AdminCliError("Set MONGODB_DB before running account administration.");
  }
  if (!env.MONGODB_ENVIRONMENT) {
    throw new AdminCliError(
      "Set MONGODB_ENVIRONMENT to development, preview, or production.",
    );
  }
  if (options["confirm-db"] !== env.MONGODB_DB) {
    throw new AdminCliError(
      "Pass --confirm-db with the exact configured MONGODB_DB value.",
    );
  }
  if (
    env.MONGODB_ENVIRONMENT === "production" &&
    !options["confirm-production"]
  ) {
    throw new AdminCliError(
      "Production account changes require --confirm-production.",
    );
  }
  return env;
}

async function confirmWrite(database, environment, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY) {
    throw new AdminCliError("Interactive confirmation is required before writing.");
  }
  const prompt = createInterface({ input, output });
  try {
    const answer = await prompt.question(
      `Target: ${database} (${environment}). Type "ya" to confirm: `,
    );
    if (answer !== "ya") throw new AdminCliError("Operation cancelled.");
  } finally {
    prompt.close();
  }
}

function normalizeAccountInput(username, displayName) {
  try {
    return {
      username: usernameSchema.parse(username),
      displayName: displayNameSchema.parse(displayName),
    };
  } catch {
    throw new AdminCliError("Username or display name is invalid.");
  }
}

function generateTemporaryPassword() {
  return Array.from(
    { length: 16 },
    () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)],
  ).join("");
}

async function makeUser({ username, displayName, role, cardId = null, now }) {
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password, username);
  const user = userDocumentSchema.parse({
    _id: new ObjectId(),
    username,
    displayName,
    passwordHash,
    role,
    cardId,
    mustChangePassword: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
  return { user, password };
}

async function ensureUsernameAvailable(db, username) {
  const existing = await db.collection("users").findOne(
    { username },
    { projection: { _id: 1 } },
  );
  if (existing) throw new AdminCliError("Username is already in use.");
}

async function createAdmin(options, dependencies = {}) {
  requireOptions(options, ["username", "name"]);
  const account = normalizeAccountInput(options.username, options.name);
  const env = requireDatabaseTarget(options, dependencies.env);
  const db = dependencies.db || (await (dependencies.getDb || getDb)());
  await ensureUsernameAvailable(db, account.username);

  if (options["dry-run"]) {
    return { mode: "dry-run", role: "admin", username: account.username };
  }
  await (dependencies.confirmWrite || confirmWrite)(
    env.MONGODB_DB,
    env.MONGODB_ENVIRONMENT,
  );

  const now = dependencies.now || new Date();
  const { user, password } = await makeUser({
    ...account,
    role: "admin",
    now,
  });
  try {
    await db.collection("users").insertOne(user);
  } catch (error) {
    if (error.code === 11000) {
      throw new AdminCliError("Username is already in use.");
    }
    throw error;
  }
  return { mode: "created", role: user.role, username: user.username, password };
}

async function createStudent(options, dependencies = {}) {
  requireOptions(options, ["username", "name", "card"]);
  const account = normalizeAccountInput(options.username, options.name);
  let slug;
  try {
    slug = slugSchema.parse(options.card);
  } catch {
    throw new AdminCliError("Card slug is invalid.");
  }
  const env = requireDatabaseTarget(options, dependencies.env);
  const db = dependencies.db || (await (dependencies.getDb || getDb)());
  await ensureUsernameAvailable(db, account.username);

  const cards = db.collection("cards");
  const card = await cards.findOne(
    { slug },
    { projection: { _id: 1, ownerUserId: 1 } },
  );
  if (!card) throw new AdminCliError("Card was not found.");
  if (card.ownerUserId !== null) {
    throw new AdminCliError("Card already has an account owner.");
  }
  if (options["dry-run"]) {
    return {
      mode: "dry-run",
      role: "student",
      username: account.username,
      card: slug,
    };
  }
  await (dependencies.confirmWrite || confirmWrite)(
    env.MONGODB_DB,
    env.MONGODB_ENVIRONMENT,
  );

  const now = dependencies.now || new Date();
  const { user, password } = await makeUser({
    ...account,
    role: "student",
    cardId: card._id,
    now,
  });
  const claim = await cards.updateOne(
    { _id: card._id, ownerUserId: null },
    { $set: { ownerUserId: user._id, updatedAt: now } },
  );
  if (claim.matchedCount !== 1) {
    throw new AdminCliError("Card ownership changed; no account was created.");
  }
  const users = db.collection("users");
  try {
    await users.insertOne(user);
  } catch (error) {
    let persistedUser;
    try {
      persistedUser = await users.findOne(
        { _id: user._id },
        { projection: { _id: 1 } },
      );
    } catch {
      throw new AdminCliError(
        "Account creation outcome is uncertain; inspect the database before retrying.",
      );
    }
    if (persistedUser) {
      return {
        mode: "created",
        role: user.role,
        username: user.username,
        card: slug,
        password,
      };
    }
    try {
      await cards.updateOne(
        { _id: card._id, ownerUserId: user._id },
        { $set: { ownerUserId: null, updatedAt: now } },
      );
    } catch {
      throw new AdminCliError(
        "Account creation failed and card ownership rollback failed; inspect the database before retrying.",
      );
    }
    if (error.code === 11000) {
      throw new AdminCliError("Username is already in use.");
    }
    throw error;
  }
  return {
    mode: "created",
    role: user.role,
    username: user.username,
    card: slug,
    password,
  };
}

async function resetPassword(options, dependencies = {}) {
  requireOptions(options, ["username"]);
  let username;
  try {
    username = usernameSchema.parse(options.username);
  } catch {
    throw new AdminCliError("Username is invalid.");
  }
  const env = requireDatabaseTarget(options, dependencies.env);
  const db = dependencies.db || (await (dependencies.getDb || getDb)());
  const users = db.collection("users");
  const user = await users.findOne(
    { username },
    { projection: { _id: 1, username: 1 } },
  );
  if (!user) throw new AdminCliError("Account was not found.");
  if (options["dry-run"]) {
    return { mode: "dry-run", action: "reset-password", username };
  }
  await (dependencies.confirmWrite || confirmWrite)(
    env.MONGODB_DB,
    env.MONGODB_ENVIRONMENT,
  );

  const now = dependencies.now || new Date();
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password, user.username);
  await destroyAllSessions(db, user._id);
  const result = await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        mustChangePassword: true,
        updatedAt: now,
      },
    },
  );
  if (result.matchedCount !== 1) {
    throw new AdminCliError("Account changed during reset; no password was returned.");
  }
  return { mode: "updated", action: "reset-password", username, password };
}

async function setActive(options, dependencies = {}) {
  requireOptions(options, ["username", "active"]);
  let username;
  try {
    username = usernameSchema.parse(options.username);
  } catch {
    throw new AdminCliError("Username is invalid.");
  }
  if (!["true", "false"].includes(options.active)) {
    throw new AdminCliError("--active must be true or false.");
  }
  const isActive = options.active === "true";
  const env = requireDatabaseTarget(options, dependencies.env);
  const db = dependencies.db || (await (dependencies.getDb || getDb)());
  const users = db.collection("users");
  const user = await users.findOne(
    { username },
    { projection: { _id: 1, isActive: 1 } },
  );
  if (!user) throw new AdminCliError("Account was not found.");
  if (options["dry-run"]) {
    return { mode: "dry-run", action: "set-active", username, isActive };
  }
  await (dependencies.confirmWrite || confirmWrite)(
    env.MONGODB_DB,
    env.MONGODB_ENVIRONMENT,
  );

  const result = await users.updateOne(
    { _id: user._id },
    { $set: { isActive, updatedAt: dependencies.now || new Date() } },
  );
  if (result.matchedCount !== 1) {
    throw new AdminCliError("Account changed before its status could be updated.");
  }
  if (!isActive) await destroyAllSessions(db, user._id);
  return { mode: "updated", action: "set-active", username, isActive };
}

function printResult(result) {
  if (result.mode === "dry-run") {
    console.log(JSON.stringify(result));
    return;
  }
  const { password, ...summary } = result;
  console.log(JSON.stringify(summary));
  if (password) console.log(`Temporary password (shown once): ${password}`);
}

function runCli(command) {
  return Promise.resolve()
    .then(command)
    .then(printResult)
    .catch(error => {
      console.error(
        error instanceof AdminCliError
          ? error.message
          : "Account administration failed; sensitive database details were not printed.",
      );
      process.exitCode = 1;
    });
}

module.exports = {
  AdminCliError,
  confirmWrite,
  createAdmin,
  createStudent,
  generateTemporaryPassword,
  parseOptions,
  printResult,
  requireDatabaseTarget,
  resetPassword,
  runCli,
  setActive,
};
