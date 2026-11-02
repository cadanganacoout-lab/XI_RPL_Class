let resetAuthState = () => {};
const privateCacheClearers = new Set();

export class ApiRequestError extends Error {
  constructor(message, status = 0, code = "NETWORK_ERROR") {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export function setAuthResetHandler(handler) {
  resetAuthState = handler;
  return () => {
    if (resetAuthState === handler) resetAuthState = () => {};
  };
}

export function registerPrivateCacheClearer(clear) {
  privateCacheClearers.add(clear);
  return () => privateCacheClearers.delete(clear);
}

export function clearPrivateCache() {
  for (const clear of privateCacheClearers) clear();
}

export async function apiRequest(path, { method = "GET", body, signal } = {}) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/api/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    throw new TypeError("API requests must use a same-origin /api/ path.");
  }

  const headers = {};
  const isMutation = method.toUpperCase() !== "GET";
  if (isMutation) {
    headers["X-Requested-With"] = "fetch";
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiRequestError(
      "Tidak dapat terhubung. Periksa koneksi lalu coba lagi.",
    );
  }

  if (response.status === 401) {
    resetAuthState();
    clearPrivateCache();
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError(
      "Layanan mengirim respons yang tidak dapat dibaca.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 429
        ? "Terlalu banyak percobaan, coba lagi nanti."
        : payload?.error?.message || "Permintaan tidak dapat diproses.";
    throw new ApiRequestError(
      message,
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  return payload;
}
