/**
 * Validates a user-supplied "return to this page after login" path. Only same-origin, relative
 * paths are accepted — rejects protocol-relative ("//evil.com") and absolute ("https://evil.com")
 * URLs to prevent an open-redirect via the login form's `redirect` field.
 */
const CONTROL_OR_ESCAPE_CHARS = /[\t\n\r\\]/;

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/") || value.startsWith("//") || CONTROL_OR_ESCAPE_CHARS.test(value)) return null;
  try {
    // Belt-and-suspenders: resolve against a fixed base and confirm it still lands on that
    // origin — catches any remaining protocol-relative tricks the checks above missed.
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return null;
  } catch {
    return null;
  }
  return value;
}
