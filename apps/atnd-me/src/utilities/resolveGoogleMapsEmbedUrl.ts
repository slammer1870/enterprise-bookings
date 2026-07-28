import { normalizeGoogleMapsEmbedUrl } from '@/utilities/normalizeGoogleMapsEmbedUrl'

function isShortMapsLink(url: string): boolean {
  return url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')
}

/**
 * Resolve short Google Maps links (maps.app.goo.gl) to an embeddable iframe src
 * by following the redirect to the full place URL.
 */
export async function resolveGoogleMapsEmbedUrl(
  input: string | null | undefined,
): Promise<string | null> {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return null

  // iframe HTML or already-normalized paths — sync is enough
  if (!isShortMapsLink(raw) || raw.includes('<iframe')) {
    return normalizeGoogleMapsEmbedUrl(raw)
  }

  try {
    const res = await fetch(raw, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'atnd-me/1.0 (map embed resolver)',
      },
      next: { revalidate: 86400 },
    })
    const finalUrl = res.url || raw
    return normalizeGoogleMapsEmbedUrl(finalUrl)
  } catch {
    // Fallback: q= short link (often blank in iframes, but better than nothing)
    return normalizeGoogleMapsEmbedUrl(raw)
  }
}
