import sharp from 'sharp'
import type { Payload, PayloadRequest } from 'payload'

import { monogramGlyphsToSvgPaths } from './monogramGlyphs'

/** Deterministic, non-generic palettes for default monogram logos. */
const PALETTES = [
  { bg: '#1a3a2f', fg: '#e8f0eb' }, // forest
  { bg: '#243447', fg: '#eef2f6' }, // slate
  { bg: '#3d2914', fg: '#f5ebe0' }, // espresso
  { bg: '#1e3a5f', fg: '#e8eef5' }, // navy
  { bg: '#4a3728', fg: '#faf6f1' }, // umber
  { bg: '#0f4c5c', fg: '#e6f2f5' }, // teal
  { bg: '#3b2f4a', fg: '#f3eef8' }, // plum
  { bg: '#2f3d2f', fg: '#eef3ee' }, // olive
] as const

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Monogram for a company name: up to 2 initials from words, else first alphanumeric char.
 */
export function monogramFromCompanyName(name: string): string {
  const words = name
    .trim()
    .split(/[\s/_-]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)

  if (words.length >= 2) {
    const a = words[0]?.[0]
    const b = words[1]?.[0]
    if (a && b) return `${a}${b}`.toUpperCase()
  }

  const first = words[0]?.[0] ?? name.match(/[A-Za-z0-9]/)?.[0]
  return (first ?? '?').toUpperCase()
}

function pickPalette(seed: string) {
  return PALETTES[hashString(seed) % PALETTES.length]!
}

/**
 * Build a square PNG monogram (first letter / initials of the company name).
 * Letters are drawn as SVG shapes (not `<text>`) so sharp/librsvg does not depend
 * on system fonts — Docker/preview images often lack Georgia and drop the glyph.
 */
export async function renderMonogramLogoPng(
  companyName: string,
  size = 512,
): Promise<{ buffer: Buffer; monogram: string; alt: string }> {
  const monogram = monogramFromCompanyName(companyName)
  const { bg, fg } = pickPalette(companyName.trim().toLowerCase() || monogram)
  const letterShapes = monogramGlyphsToSvgPaths(monogram, size, fg)
  const radius = Math.round(size * 0.18)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
  ${letterShapes}
</svg>`

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  return {
    buffer,
    monogram,
    alt: `${companyName.trim() || monogram} logo`,
  }
}

/**
 * Create a media doc + attach it as the tenant logo when the tenant has none yet.
 */
export async function ensureDefaultTenantLogo(opts: {
  payload: Payload
  tenantId: number
  tenantName: string
  req?: PayloadRequest
}): Promise<number | null> {
  const { payload, tenantId, tenantName, req } = opts

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: { logo: true, name: true } as any,
    req,
  })

  if (!tenant) return null
  if (tenant.logo != null) return null

  const name = (typeof tenant.name === 'string' && tenant.name.trim()) || tenantName
  const { buffer, alt } = await renderMonogramLogoPng(name)
  const slugSafe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const filename = `${slugSafe || 'tenant'}-logo.png`

  const media = await payload.create({
    collection: 'media',
    data: {
      alt,
      tenant: tenantId,
      // Public site / Next image optimizer fetch `/api/media/file/...` without tenant cookies.
      isPublic: true,
    },
    file: {
      name: filename,
      data: buffer,
      mimetype: 'image/png',
      size: buffer.byteLength,
    },
    overrideAccess: true,
    req,
    context: { tenant: tenantId },
  } as Parameters<typeof payload.create>[0])

  const mediaId = Number(media.id)
  if (!Number.isFinite(mediaId)) return null

  // Field-level access blocks client writes to `isPublic`; force it after create as well
  // in case create stripped the value despite overrideAccess.
  if ((media as { isPublic?: boolean | null }).isPublic !== true) {
    await payload.update({
      collection: 'media',
      id: mediaId,
      data: { isPublic: true },
      overrideAccess: true,
      req,
      context: { tenant: tenantId, syncPublicMedia: true },
    })
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { logo: mediaId },
    overrideAccess: true,
    req,
  })

  return mediaId
}
