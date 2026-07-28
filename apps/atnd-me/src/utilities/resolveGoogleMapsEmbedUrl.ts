import { extractGoogleMapsPlaceName } from '@/utilities/extractGoogleMapsPlaceName'
import { normalizeGoogleMapsEmbedUrl } from '@/utilities/normalizeGoogleMapsEmbedUrl'

function isShortMapsLink(url: string): boolean {
  return url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')
}

export type ResolvedGoogleMapsEmbed = {
  embedSrc: string | null
  placeName: string | null
  /** Final URL after following short-link redirects (when available). */
  resolvedUrl: string | null
}

/**
 * Resolve a pasted Google Maps URL (including maps.app.goo.gl) to an embed src
 * and best-effort business / place name.
 */
export async function resolveGoogleMapsEmbed(
  input: string | null | undefined,
): Promise<ResolvedGoogleMapsEmbed> {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) {
    return { embedSrc: null, placeName: null, resolvedUrl: null }
  }

  // iframe HTML or non-short links — sync normalize + extract
  if (!isShortMapsLink(raw) || raw.includes('<iframe')) {
    const embedSrc = normalizeGoogleMapsEmbedUrl(raw)
    return {
      embedSrc,
      placeName: extractGoogleMapsPlaceName(raw),
      resolvedUrl: raw.includes('<iframe') ? null : raw,
    }
  }

  try {
    const finalUrl = await followMapsRedirect(raw)
    const embedSrc = normalizeGoogleMapsEmbedUrl(finalUrl)
    return {
      embedSrc,
      placeName: extractGoogleMapsPlaceName(finalUrl) ?? extractGoogleMapsPlaceName(raw),
      resolvedUrl: finalUrl,
    }
  } catch {
    return {
      embedSrc: normalizeGoogleMapsEmbedUrl(raw),
      placeName: extractGoogleMapsPlaceName(raw),
      resolvedUrl: null,
    }
  }
}

/** @deprecated Prefer resolveGoogleMapsEmbed for place name + embed src. */
export async function resolveGoogleMapsEmbedUrl(
  input: string | null | undefined,
): Promise<string | null> {
  const { embedSrc } = await resolveGoogleMapsEmbed(input)
  return embedSrc
}

async function followMapsRedirect(url: string): Promise<string> {
  // Prefer GET with redirect follow — Google short links often ignore/reject HEAD.
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'atnd-me/1.0 (map embed resolver)',
      Accept: 'text/html',
    },
    next: { revalidate: 86400 },
  })
  return res.url || url
}
