/**
 * Extract a human-readable place / business name from a Google Maps URL.
 * No API key required — uses path and query segments only.
 */
export function extractGoogleMapsPlaceName(input: string | null | undefined): string | null {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return null

  // iframe HTML
  const iframeSrc = raw.match(/src=["']([^"']+)["']/i)?.[1]?.trim()
  if (iframeSrc) return extractGoogleMapsPlaceName(iframeSrc)

  try {
    const url = new URL(raw)

    // /maps/place/Business+Name/@lat,lng or /maps/place/Business+Name/data=...
    const placeSeg = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1]
    if (placeSeg) {
      const name = cleanPlaceName(decodeURIComponent(placeSeg.replace(/\+/g, ' ')))
      if (name) return name
    }

    // /maps/search/Business+Name
    const searchSeg = url.pathname.match(/\/maps\/search\/([^/]+)/i)?.[1]
    if (searchSeg) {
      const name = cleanPlaceName(decodeURIComponent(searchSeg.replace(/\+/g, ' ')))
      if (name) return name
    }

    const q = url.searchParams.get('q') || url.searchParams.get('query')
    if (q) {
      const fromQuery = placeNameFromQuery(q)
      if (fromQuery) return fromQuery
    }
  } catch {
    // Not a URL — treat as bare place name / address when it looks like one
    if (!/^https?:\/\//i.test(raw) && !raw.includes('<iframe')) {
      return placeNameFromQuery(raw)
    }
  }

  return null
}

function placeNameFromQuery(q: string): string | null {
  const trimmed = q.trim()
  if (!trimmed) return null

  // Coordinates only
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(trimmed)) return null

  // Full Google Maps URL pasted into q=
  if (/google\.[^/]+\/maps/i.test(trimmed) || trimmed.includes('maps.app.goo.gl')) {
    return extractGoogleMapsPlaceName(trimmed)
  }

  // "Business Name, 123 Street, City" → prefer the business name segment
  const first = trimmed.split(',')[0]?.trim() ?? trimmed
  return cleanPlaceName(first)
}

function cleanPlaceName(name: string): string | null {
  const cleaned = name
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null
  // Hex / opaque place ids and data blobs
  if (/^0x[0-9a-f]+$/i.test(cleaned)) return null
  if (/^data=/i.test(cleaned)) return null
  if (/^ChIJ[A-Za-z0-9_-]+$/.test(cleaned)) return null
  // Pure coordinates
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(cleaned)) return null
  // Too short / useless
  if (cleaned.length < 2) return null

  return cleaned
}
