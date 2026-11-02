export function safeNextPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin) return "/";
    if (["/login", "/daftar", "/ganti-password"].includes(target.pathname)) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export function hashPathFromNext(value) {
  const path = safeNextPath(value);
  return path === "/" ? "/beranda" : path;
}

export function nextPathFromHash(hash = window.location.hash) {
  const [path = ""] = hash.replace(/^#/, "").split("?");
  if (!path || path === "/") return "/";
  return safeNextPath(path.startsWith("/") ? path : `/${path}`);
}

export function authSearchParams(hash = window.location.hash) {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}
