/**
 * Turn a pasted Google Maps link (or full iframe HTML) into an embeddable iframe src.
 * No API key required.
 */
export function normalizeGoogleMapsEmbedUrl(input: string | null | undefined): string | null {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return null

  // User pasted the full Share → Embed iframe snippet
  const iframeSrc = raw.match(/src=["']([^"']+)["']/i)?.[1]?.trim()
  if (iframeSrc) return normalizeGoogleMapsEmbedUrl(iframeSrc)

  // Already an embed URL
  if (
    raw.includes('google.com/maps/embed') ||
    raw.includes('maps/embed/v1') ||
    /[?&]output=embed(?:&|$)/.test(raw)
  ) {
    return raw
  }

  // /maps/place/Business+Name/@lat,lng/... — prefer place name so the embed
  // shows the business listing (coords alone drop the Google Place identity).
  const placeSeg = raw.match(/\/maps\/place\/([^/]+)/i)?.[1]
  if (placeSeg) {
    try {
      const name = decodeURIComponent(placeSeg.replace(/\+/g, ' ')).trim()
      if (name && !/^0x/i.test(name) && !/^data=/i.test(name)) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(name)}&output=embed`
      }
    } catch {
      // fall through
    }
  }

  // Coordinate-only share link (no place name segment) — pin the lat/lng
  const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (at) {
    return `https://maps.google.com/maps?q=${at[1]},${at[2]}&z=15&output=embed`
  }

  // Any other Google Maps / short link — use as the query target
  if (
    /google\.[^/]+\/maps/i.test(raw) ||
    raw.includes('maps.app.goo.gl') ||
    raw.includes('goo.gl/maps')
  ) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`
  }

  // Bare address or place name
  return `https://maps.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`
}
