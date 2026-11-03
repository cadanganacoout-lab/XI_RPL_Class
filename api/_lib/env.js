const { z } = require("zod");

const mongoUriSchema = z
  .string()
  .trim()
  .min(1)
  .refine(value => {
    try {
      const uri = new URL(value);
      return (
        ["mongodb:", "mongodb+srv:"].includes(uri.protocol) &&
        uri.hostname.length > 0
      );
    } catch {
      return false;
    }
  }, "must be a valid MongoDB URI");

const appOriginSchema = z
  .string()
  .trim()
  .url()
  .refine(value => {
    try {
      const origin = new URL(value);
      return (
        ["http:", "https:"].includes(origin.protocol) &&
        origin.pathname === "/" &&
        !origin.search &&
        !origin.hash
      );
    } catch {
      return false;
    }
  }, "must be an origin without a path");

const envSchema = z.object({
  MONGODB_URI: mongoUriSchema.optional(),
  MONGODB_DB: z
    .string()
    .trim()
    .min(1)
    .max(63)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  APP_ORIGIN: appOriginSchema.optional(),
  SUPABASE_URL: z
    .string()
    .trim()
    .url()
    .refine(value => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.pathname === "/";
      } catch {
        return false;
      }
    })
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1).optional(),
  SUPABASE_AVATAR_BUCKET: z.string().trim().min(1).max(100).optional(),
  SUPABASE_BACKGROUND_BUCKET: z.string().trim().min(1).max(100).optional(),
  SUPABASE_GALLERY_BUCKET: z.string().trim().min(1).max(100).optional(),
  SUPABASE_STAGING_BUCKET: z.string().trim().min(1).max(100).optional(),
  SUPABASE_ENVIRONMENT: z.enum(["development", "preview", "production"]).optional(),
  MONGODB_ENVIRONMENT: z.enum(["development", "preview", "production"]).optional(),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .default("xirpl1_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
});

function readServerEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const invalidNames = [
      ...new Set(result.error.issues.map(issue => issue.path[0])),
    ].join(", ");
    throw new Error(`Invalid server environment variable(s): ${invalidNames}`);
  }
  return result.data;
}

function requireMongoConfig(source = process.env) {
  const env = readServerEnv(source);
  if (!env.MONGODB_URI) {
    throw new Error("Missing required server environment variable: MONGODB_URI");
  }
  if (!env.MONGODB_DB) {
    throw new Error("Missing required server environment variable: MONGODB_DB");
  }
  return { uri: env.MONGODB_URI, database: env.MONGODB_DB };
}

function requireAppOrigin(source = process.env) {
  const env = readServerEnv(source);
  if (!env.APP_ORIGIN) {
    throw new Error("Missing required server environment variable: APP_ORIGIN");
  }
  return new URL(env.APP_ORIGIN).origin;
}

function requireSupabaseServiceConfig(source = process.env) {
  const env = readServerEnv(source);
  if (!env.SUPABASE_URL) {
    throw new Error("Missing required server environment variable: SUPABASE_URL");
  }
  const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "Missing required server environment variable: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  const isSecretKey = serviceKey.startsWith("sb_secret_");
  let isLegacyServiceRoleKey = false;
  if (!isSecretKey && serviceKey.startsWith("eyJ")) {
    try {
      const claims = JSON.parse(
        Buffer.from(serviceKey.split(".")[1], "base64url").toString("utf8"),
      );
      isLegacyServiceRoleKey = claims.role === "service_role";
    } catch {
      isLegacyServiceRoleKey = false;
    }
  }
  if (!isSecretKey && !isLegacyServiceRoleKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY must be an elevated secret or service_role key.",
    );
  }
  return {
    url: env.SUPABASE_URL,
    serviceRoleKey: serviceKey,
    buckets: {
      avatar: env.SUPABASE_AVATAR_BUCKET || "avatars",
      background: env.SUPABASE_BACKGROUND_BUCKET || "card-backgrounds",
      gallery: env.SUPABASE_GALLERY_BUCKET || "gallery",
      staging: env.SUPABASE_STAGING_BUCKET || "media-staging",
    },
  };
}

module.exports = {
  readServerEnv,
  requireAppOrigin,
  requireMongoConfig,
  requireSupabaseServiceConfig,
};
