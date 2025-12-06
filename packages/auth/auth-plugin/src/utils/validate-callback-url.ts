/**
 * Validates and sanitizes a callback URL to prevent open redirect attacks.
 * Only allows relative URLs or URLs from the same origin as serverURL.
 *
 * @param callbackUrl - The callback URL to validate
 * @param serverURL - The allowed server URL origin
 * @returns A safe callback URL or null if invalid
 */
export function validateCallbackUrl(
  callbackUrl: string | undefined,
  serverURL: string | undefined,
): string | null {
  if (!callbackUrl) {
    return null;
  }

  // Remove any whitespace
  const trimmedUrl = callbackUrl.trim();

  // Reject empty strings
  if (!trimmedUrl) {
    return null;
  }

  // Reject protocol-based attacks (javascript:, data:, vbscript:, etc.)
  const dangerousProtocols = /^(javascript|data|vbscript|file|about):/i;
  if (dangerousProtocols.test(trimmedUrl)) {
    return null;
  }

  // Allow relative URLs (starting with /)
  if (trimmedUrl.startsWith("/")) {
    // Ensure it's a valid relative path (no protocol, no host)
    // Reject if it contains // (which could be used for protocol-relative URLs)
    if (trimmedUrl.startsWith("//")) {
      return null;
    }
    return trimmedUrl;
  }

  // For absolute URLs, validate against serverURL origin
  if (serverURL) {
    try {
      const callbackUrlObj = new URL(trimmedUrl);
      const serverUrlObj = new URL(serverURL);

      // Only allow if origin matches (protocol, host, port)
      if (
        callbackUrlObj.origin === serverUrlObj.origin &&
        (callbackUrlObj.protocol === "http:" || callbackUrlObj.protocol === "https:")
      ) {
        return trimmedUrl;
      }
    } catch (error) {
      // Invalid URL format
      return null;
    }
  }

  // Reject all other cases (absolute URLs without matching origin, invalid formats, etc.)
  return null;
}

