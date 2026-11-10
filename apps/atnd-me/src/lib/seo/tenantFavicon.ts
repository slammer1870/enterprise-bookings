import type { Metadata } from 'next'
import sharp from 'sharp'

/**
 * Google Search only uses a favicon that is a square multiple of 48px.
 * 192 = 48 × 4, so it stays sharp when Google scales it down to 16px.
 */
export const TENANT_FAVICON_SIZE = 192

export const TENANT_FAVICON_PATH = '/favicon.ico'

const MAX_LOGO_BYTES = 8 * 1024 * 1024

type LogoLike = {
  url?: string | null
  sizes?: {
    square?: { url?: string | null } | null
  } | null
}

export function logoFileUrl(logo: unknown): string | null {
  if (!logo || typeof logo !== 'object') return null
  const doc = logo as LogoLike
  const square = doc.sizes?.square?.url
  if (typeof square === 'string' && square.trim()) return square.trim()
  if (typeof doc.url === 'string' && doc.url.trim()) return doc.url.trim()
  return null
}

/** Same-origin icon metadata. Never point Search at `/api/media`, which robots.txt disallows. */
export function publicFaviconIcons(kind: 'platform' | 'tenant'): NonNullable<Metadata['icons']> {
  if (kind === 'platform') {
    return {
      icon: [{ url: TENANT_FAVICON_PATH, type: 'image/x-icon' }],
      apple: [{ url: TENANT_FAVICON_PATH }],
    }
  }

  const size = `${TENANT_FAVICON_SIZE}x${TENANT_FAVICON_SIZE}`
  return {
    icon: [{ url: TENANT_FAVICON_PATH, sizes: size, type: 'image/png' }],
    apple: [{ url: TENANT_FAVICON_PATH, sizes: size, type: 'image/png' }],
  }
}

export function requestOrigin(
  headers: { get(name: string): string | null },
  fallback = 'http://localhost:3000',
): string {
  const host =
    headers.get('x-forwarded-host')?.split(',')[0]?.trim() || headers.get('host')?.trim() || ''
  if (!host) return fallback.replace(/\/$/, '')
  const hostname = (host.split(':')[0] ?? host).toLowerCase()
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto =
    forwarded ||
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
      ? 'http'
      : 'https')
  return `${proto}://${host}`
}

/** Resolve a stored media URL to an http(s) URL the server can fetch. */
export function absoluteLogoUrl(url: string, origin: string): string | null {
  try {
    const absolute = new URL(url, origin)
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return null
    return absolute.toString()
  } catch {
    return null
  }
}

export function looksLikeImage(bytes: Buffer, contentType: string): boolean {
  if (contentType.toLowerCase().startsWith('image/')) return true
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  if (bytes.length >= 6) {
    const head = bytes.subarray(0, 6).toString('ascii')
    if (head === 'GIF87a' || head === 'GIF89a') return true
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true
  }
  const start = bytes.subarray(0, Math.min(bytes.length, 256)).toString('utf8').trimStart().toLowerCase()
  return start.startsWith('<svg') || start.startsWith('<?xml')
}

export async function rasterizeFaviconPng(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 4096 * 4096, animated: false })
    .rotate()
    .resize(TENANT_FAVICON_SIZE, TENANT_FAVICON_SIZE, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
}

const resizedCache = new Map<string, { png: Buffer; expires: number }>()
const RESIZED_TTL_MS = 60 * 60 * 1000

export async function tenantFaviconPng(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const cached = resizedCache.get(url)
  if (cached && cached.expires > Date.now()) return cached.png

  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    throw new Error(`logo fetch failed (${response.status})`)
  }

  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGO_BYTES) {
    throw new Error('logo is too large')
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > MAX_LOGO_BYTES) throw new Error('logo is too large')
  if (!looksLikeImage(bytes, response.headers.get('content-type') ?? '')) {
    throw new Error('logo is not an image')
  }

  const png = await rasterizeFaviconPng(bytes)
  if (resizedCache.size > 200) {
    const oldest = resizedCache.keys().next().value
    if (oldest) resizedCache.delete(oldest)
  }
  resizedCache.set(url, { png, expires: Date.now() + RESIZED_TTL_MS })
  return png
}
