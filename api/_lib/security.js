const { ApiError } = require("./http");
const { requireAppOrigin } = require("./env");

function requestOrigin(request) {
  const originHeader = request.headers.origin;
  const refererHeader = request.headers.referer;
  const source = originHeader || refererHeader;
  if (typeof source !== "string") return null;

  try {
    return new URL(source).origin;
  } catch {
    return null;
  }
}

function requireSameOrigin(request) {
  let allowedOrigin;
  try {
    allowedOrigin = requireAppOrigin();
  } catch {
    throw new ApiError(
      503,
      "SERVER_MISCONFIGURED",
      "The service is temporarily unavailable.",
    );
  }

  if (requestOrigin(request) !== allowedOrigin) {
    throw new ApiError(403, "INVALID_ORIGIN", "The request origin is not allowed.");
  }

  if (request.headers["x-requested-with"] !== "fetch") {
    throw new ApiError(403, "CSRF_CHECK_FAILED", "The request could not be verified.");
  }
}

module.exports = { requireSameOrigin };
