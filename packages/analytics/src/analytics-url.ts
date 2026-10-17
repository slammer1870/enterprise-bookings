const ATTRIBUTION_QUERY_PARAMS = new Set<string>([
  "ref",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
]);

const QUERY_FREE_PATHS = new Set([
  "/complete-booking",
  "/join-waitlist",
  "/search",
  "/success",
]);

export function sanitizeAnalyticsUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  url.username = "";
  url.password = "";
  url.hash = "";
  url.pathname = url.pathname.replace(
    /^\/bookings\/[^/]+(?=\/|$)/,
    "/bookings/_ID_",
  );

  const queryFree =
    url.pathname === "/auth" ||
    url.pathname.startsWith("/auth/") ||
    QUERY_FREE_PATHS.has(url.pathname);
  for (const key of [...url.searchParams.keys()]) {
    if (queryFree || !ATTRIBUTION_QUERY_PARAMS.has(key)) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}
