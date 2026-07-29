import { NextResponse } from 'next/server'

import { resolveGoogleMapsEmbed } from '@/utilities/resolveGoogleMapsEmbedUrl'

export const dynamic = 'force-dynamic'

/**
 * Resolve a pasted Google Maps URL (including maps.app.goo.gl short links)
 * to an embed src and best-effort business / place name.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = (searchParams.get('url') || '').trim()
  if (!url) {
    return NextResponse.json(
      { error: 'Missing url', embedSrc: null, placeName: null },
      { status: 400 },
    )
  }

  // Only allow Google Maps hosts — avoid open redirect / SSRF
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json(
      { error: 'Invalid url', embedSrc: null, placeName: null },
      { status: 400 },
    )
  }

  const host = parsed.hostname.toLowerCase()
  const allowed =
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host.endsWith('.google.com') ||
    host === 'google.com' ||
    host.endsWith('.google.ie') ||
    host === 'maps.google.com'

  if (!allowed) {
    return NextResponse.json(
      { error: 'Unsupported maps host', embedSrc: null, placeName: null },
      { status: 400 },
    )
  }

  const { embedSrc, placeName } = await resolveGoogleMapsEmbed(url)
  return NextResponse.json({ embedSrc, placeName })
}
