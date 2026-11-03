const { ApiError } = require("./http");

const STORAGE_BUCKETS = {
  avatar: "avatars",
  background: "card-backgrounds",
  gallery: "gallery",
  staging: "media-staging",
};

function storageBaseUrl(config) {
  return `${config.url.replace(/\/+$/, "")}/storage/v1`;
}

function encodedPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function storageHeaders(config, contentType) {
  const headers = { apikey: config.serviceRoleKey };
  if (!config.serviceRoleKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${config.serviceRoleKey}`;
  }
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

async function safeStorageFailure(response) {
  let code = "";
  try {
    const body = await response.json();
    if (typeof body?.statusCode === "string") code = body.statusCode;
    else if (typeof body?.error === "string") code = body.error;
  } catch {
    code = "";
  }

  if (response.status === 401 || response.status === 403) {
    return new ApiError(
      502,
      "MEDIA_STORAGE_AUTH",
      "Media storage rejected the server credentials or permissions.",
    );
  }
  if (response.status === 404) {
    return new ApiError(409, "MEDIA_UPLOAD_MISSING", "The uploaded image is missing or expired.");
  }
  if (response.status === 413) {
    return new ApiError(413, "MEDIA_TOO_LARGE", "The image exceeds the allowed size.");
  }
  if (response.status === 400 && code === "Duplicate") {
    return new ApiError(409, "MEDIA_OBJECT_EXISTS", "The image upload has already been used.");
  }
  return new ApiError(
    502,
    "MEDIA_STORAGE_FAILED",
    `Media storage could not complete the request (HTTP ${response.status}).`,
  );
}

async function storageRequest(config, fetchImpl, path, options = {}) {
  let response;
  const { contentType, ...fetchOptions } = options;
  try {
    response = await fetchImpl(`${storageBaseUrl(config)}${path}`, {
      ...fetchOptions,
      headers: {
        ...storageHeaders(config, contentType),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(502, "MEDIA_STORAGE_UNAVAILABLE", "Media storage is temporarily unavailable.");
  }
  if (!response.ok) throw await safeStorageFailure(response);
  return response;
}

async function createSignedUpload(config, fetchImpl, bucket, path) {
  const response = await storageRequest(
    config,
    fetchImpl,
    `/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath(path)}`,
    { method: "POST", contentType: "application/json", body: "{}" },
  );
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(502, "MEDIA_STORAGE_RESPONSE", "Media storage returned an invalid response.");
  }
  if (typeof payload?.url !== "string" || typeof payload?.token !== "string") {
    throw new ApiError(502, "MEDIA_STORAGE_RESPONSE", "Media storage returned an invalid response.");
  }
  const uploadUrl = payload.url.startsWith("http")
    ? new URL(payload.url)
    : new URL(
        payload.url.startsWith("/storage/v1/")
          ? payload.url
          : `${storageBaseUrl(config)}${payload.url.startsWith("/") ? "" : "/"}${payload.url}`,
        config.url,
      );
  if (
    uploadUrl.origin !== new URL(config.url).origin ||
    !uploadUrl.pathname.includes("/storage/v1/object/upload/sign/")
  ) {
    throw new ApiError(502, "MEDIA_STORAGE_RESPONSE", "Media storage returned an invalid upload URL.");
  }
  return { token: payload.token, uploadUrl: uploadUrl.toString() };
}

async function downloadObject(config, fetchImpl, bucket, path, maxBytes) {
  const response = await storageRequest(
    config,
    fetchImpl,
    `/object/${encodeURIComponent(bucket)}/${encodedPath(path)}`,
    { method: "GET" },
  );
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError(413, "MEDIA_TOO_LARGE", "The image exceeds the allowed size.");
  }
  if (!response.body) {
    throw new ApiError(502, "MEDIA_STORAGE_RESPONSE", "Media storage returned an empty response.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "MEDIA_TOO_LARGE", "The image exceeds the allowed size.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) {
    throw new ApiError(422, "MEDIA_INVALID_IMAGE", "The uploaded image is empty.");
  }
  return Buffer.concat(chunks, size);
}

async function uploadObject(config, fetchImpl, bucket, path, buffer) {
  await storageRequest(
    config,
    fetchImpl,
    `/object/${encodeURIComponent(bucket)}/${encodedPath(path)}`,
    {
      method: "POST",
      contentType: "image/webp",
      headers: {
        "cache-control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: buffer,
    },
  );
}

async function removeObject(config, fetchImpl, bucket, path) {
  await storageRequest(
    config,
    fetchImpl,
    `/object/${encodeURIComponent(bucket)}`,
    {
      method: "DELETE",
      contentType: "application/json",
      body: JSON.stringify({ prefixes: [path] }),
    },
  );
}

function publicObjectUrl(config, bucket, path) {
  return `${storageBaseUrl(config)}/object/public/${encodeURIComponent(bucket)}/${encodedPath(path)}`;
}

module.exports = {
  STORAGE_BUCKETS,
  createSignedUpload,
  downloadObject,
  publicObjectUrl,
  removeObject,
  storageHeaders,
  uploadObject,
};
