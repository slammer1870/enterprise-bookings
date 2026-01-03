export type CompleteBookingMode = "login" | "register";

/**
 * Build the canonical URL to start/complete booking auth (modal-capable via intercepting routes).
 * Keeps callbackUrl intact so we can redirect back to the intended booking page after auth.
 */
export function buildCompleteBookingUrl({
  callbackUrl,
  mode = "login",
}: {
  callbackUrl?: string;
  mode?: CompleteBookingMode;
}): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (callbackUrl) params.set("callbackUrl", callbackUrl);
  return `/complete-booking?${params.toString()}`;
}


