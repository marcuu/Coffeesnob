// Allows only safe relative paths to prevent open redirect in auth callback.
export function sanitizeNext(raw: string): string {
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  // Must start with / but not // (protocol-relative).
  // Reject backslashes (browsers may normalise \ to /) and any scheme: pattern.
  if (
    /^\/(?!\/)/.test(path) &&
    !path.includes("\\") &&
    !/[a-z][a-z+\-.]*:/i.test(path)
  ) {
    return path;
  }
  return "/";
}
