const assert = require("node:assert/strict");
const test = require("node:test");
const { runSetup } = require("../scripts/setup-media-storage");
const { requireSupabaseServiceConfig } = require("../api/_lib/env");

const config = {
  url: "https://development-project.supabase.co",
  serviceRoleKey: "sb_secret_test",
  buckets: {
    staging: "media-staging",
    avatar: "avatars",
    background: "card-backgrounds",
    gallery: "gallery",
  },
};

test("media bucket setup creates buckets reported as NoSuchBucket", async () => {
  const requests = [];
  const result = await runSetup({
    args: ["--apply", "--confirm-project=development-project"],
    getConfig: () => config,
    getEnv: () => ({ SUPABASE_ENVIRONMENT: "development" }),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, method: options.method || "GET", body: options.body });
      if (options.method === "POST") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({
        statusCode: "404",
        error: "Bucket not found",
        code: "NoSuchBucket",
      }), { status: 400 });
    },
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.buckets.length, 4);
  assert.equal(requests.filter(request => request.method === "GET").length, 4);
  assert.equal(requests.filter(request => request.method === "POST").length, 4);
  const staging = JSON.parse(requests.find(request => request.method === "POST").body);
  assert.equal(staging.id, "media-staging");
  assert.equal(staging.public, false);
  assert.equal(staging.file_size_limit, 5 * 1024 * 1024);
});

test("media bucket setup rejects a mismatched existing bucket without changing it", async () => {
  let created = false;
  await assert.rejects(
    runSetup({
      args: ["--apply", "--confirm-project=development-project"],
      getConfig: () => config,
      getEnv: () => ({ SUPABASE_ENVIRONMENT: "development" }),
      fetchImpl: async (_url, options = {}) => {
        if (options.method === "POST") {
          created = true;
          return new Response("{}", { status: 200 });
        }
        return new Response(JSON.stringify({
          id: "media-staging",
          public: true,
          file_size_limit: 5242880,
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
        }), { status: 200 });
      },
    }),
    /exists with different settings/,
  );
  assert.equal(created, false);
});

test("Supabase storage config rejects a publishable key used as the server key", () => {
  assert.throws(
    () => requireSupabaseServiceConfig({
      SUPABASE_URL: config.url,
      SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_not_elevated",
    }),
    /must be an elevated secret or service_role key/,
  );
});

test("Supabase storage config accepts a secret key or legacy service-role JWT", () => {
  const secretConfig = requireSupabaseServiceConfig({
    SUPABASE_URL: config.url,
    SUPABASE_SECRET_KEY: "sb_secret_test",
  });
  const claims = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const legacyConfig = requireSupabaseServiceConfig({
    SUPABASE_URL: config.url,
    SUPABASE_SERVICE_ROLE_KEY: `eyJ.${claims}.signature`,
  });

  assert.equal(secretConfig.serviceRoleKey, "sb_secret_test");
  assert.equal(legacyConfig.serviceRoleKey, `eyJ.${claims}.signature`);
});
