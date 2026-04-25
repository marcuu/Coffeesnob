// Allows only safe relative paths to prevent open redirect in auth callback.
export function sanitizeNext(raw: string): string {
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  // Require a leading / (rules out bare schemes like "javascript:").
  // Reject // (protocol-relative) and backslashes (some browsers normalise \ to /).
  // A colon elsewhere in the path is safe: origin is always prepended, so the
  // final URL is always https://real-host.com/... regardless of path content.
  if (/^\/(?!\/)/.test(path) && !path.includes("\\")) {
    return path;
  }
  return "/";
}
