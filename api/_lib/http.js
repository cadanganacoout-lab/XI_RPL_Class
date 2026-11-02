const DEFAULT_BODY_LIMIT = 100 * 1024;
const { randomUUID } = require("node:crypto");
const { ZodError } = require("zod");

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function sendJson(response, status, payload, { cacheControl = "no-store" } = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

async function parseJsonBody(request, { maxBytes = DEFAULT_BODY_LIMIT } = {}) {
  const contentType = request.headers["content-type"] || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send a JSON request body.");
  }

  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    if (!/^\d+$/.test(contentLength)) {
      throw new ApiError(400, "INVALID_CONTENT_LENGTH", "The request is invalid.");
    }
    if (Number(contentLength) > maxBytes) {
      throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
    }
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      request.resume();
      throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
    }
    chunks.push(buffer);
  }

  if (size === 0) {
    throw new ApiError(400, "EMPTY_BODY", "The request body is required.");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
}

async function handleApiError(response, action) {
  try {
    await action();
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : error instanceof ZodError
          ? new ApiError(400, "INVALID_REQUEST", "The request is invalid.")
        : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
    const requestId = randomUUID();
    if (!(error instanceof ApiError)) {
      console.error(`Unexpected API error (${requestId}).`);
    }
    sendJson(response, apiError.status, {
      error: { code: apiError.code, message: apiError.message, requestId },
    });
  }
}

module.exports = {
  ApiError,
  DEFAULT_BODY_LIMIT,
  handleApiError,
  parseJsonBody,
  sendJson,
};
