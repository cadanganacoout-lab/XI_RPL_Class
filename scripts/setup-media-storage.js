const {
  requireSupabaseServiceConfig,
  readServerEnv,
} = require("../api/_lib/env");
const { storageHeaders } = require("../api/_lib/media-storage");

function parseArgs(args) {
  const projectArg = args.find(argument => argument.startsWith("--confirm-project="));
  if (args.includes("--dry-run") && args.includes("--apply")) {
    throw new Error("Choose either --dry-run or --apply.");
  }
  return {
    apply: args.includes("--apply"),
    confirmedProject: projectArg?.slice("--confirm-project=".length),
  };
}

function projectRefFromUrl(value) {
  const hostname = new URL(value).hostname;
  const match = hostname.match(/^([a-z0-9-]+)\.supabase\.(?:co|in|red)$/i);
  if (!match) throw new Error("SUPABASE_URL must be a Supabase project URL.");
  return match[1];
}

function bucketDefinitions(config) {
  const definitions = [
    {
      id: config.buckets.staging,
      name: config.buckets.staging,
      public: false,
      file_size_limit: 5 * 1024 * 1024,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    },
    {
      id: config.buckets.avatar,
      name: config.buckets.avatar,
      public: true,
      file_size_limit: 1 * 1024 * 1024,
      allowed_mime_types: ["image/webp"],
    },
    {
      id: config.buckets.background,
      name: config.buckets.background,
      public: true,
      file_size_limit: 2 * 1024 * 1024,
      allowed_mime_types: ["image/webp"],
    },
    {
      id: config.buckets.gallery,
      name: config.buckets.gallery,
      public: true,
      file_size_limit: 3 * 1024 * 1024,
      allowed_mime_types: ["image/webp"],
    },
  ];
  if (new Set(definitions.map(bucket => bucket.id)).size !== definitions.length) {
    throw new Error("Media bucket names must be distinct.");
  }
  return definitions;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function ensureBucket(config, fetchImpl, bucket) {
  const baseUrl = `${config.url.replace(/\/+$/, "")}/storage/v1`;
  const headers = storageHeaders(config, "application/json");
  let response = await fetchImpl(
    `${baseUrl}/bucket/${encodeURIComponent(bucket.id)}`,
    { headers },
  );
  let existing = null;
  if (response.status === 404 || response.status === 400) {
    existing = await responseJson(response);
  }
  if (response.status === 404 || existing?.code === "NoSuchBucket") {
    response = await fetchImpl(`${baseUrl}/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify(bucket),
    });
    if (!response.ok) {
      throw new Error(`Could not create media bucket ${bucket.id} (HTTP ${response.status}).`);
    }
    return "created";
  }
  if (!response.ok) {
    throw new Error(`Could not inspect media bucket ${bucket.id} (HTTP ${response.status}).`);
  }

  if (existing === null) existing = await responseJson(response);
  const actualTypes = Array.isArray(existing?.allowed_mime_types)
    ? [...existing.allowed_mime_types].sort()
    : [];
  const expectedTypes = [...bucket.allowed_mime_types].sort();
  if (
    existing?.id !== bucket.id ||
    existing?.public !== bucket.public ||
    existing?.file_size_limit !== bucket.file_size_limit ||
    JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)
  ) {
    throw new Error(`Media bucket ${bucket.id} exists with different settings; review it in Supabase Dashboard.`);
  }
  return "verified";
}

async function runSetup({
  args = process.argv.slice(2),
  fetchImpl = globalThis.fetch,
  getConfig = requireSupabaseServiceConfig,
  getEnv = readServerEnv,
} = {}) {
  const options = parseArgs(args);
  const config = getConfig();
  const projectRef = projectRefFromUrl(config.url);
  const buckets = bucketDefinitions(config);
  if (!options.apply) {
    return {
      mode: "dry-run",
      projectRef,
      buckets: buckets.map(({ id, public: isPublic, file_size_limit: limit }) => ({
        id,
        public: isPublic,
        maxBytes: limit,
      })),
    };
  }

  const env = getEnv();
  if (env.SUPABASE_ENVIRONMENT !== "development") {
    throw new Error("Bucket changes require SUPABASE_ENVIRONMENT=development.");
  }
  if (options.confirmedProject !== projectRef) {
    throw new Error(`Apply requires --confirm-project=${projectRef}.`);
  }

  const results = [];
  for (const bucket of buckets) {
    results.push({ id: bucket.id, result: await ensureBucket(config, fetchImpl, bucket) });
  }
  return { mode: "apply", projectRef, buckets: results };
}

if (require.main === module) {
  runSetup()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error.message.startsWith("Missing required server environment variable:")
        ? error.message
        : "Media storage setup failed or was blocked. No credentials were printed.");
      process.exitCode = 1;
    });
}

module.exports = {
  bucketDefinitions,
  parseArgs,
  projectRefFromUrl,
  runSetup,
};
