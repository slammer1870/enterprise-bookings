import type { PayloadRequest } from 'payload'

type UnknownDoc = Record<string, unknown>

function looksLikeMediaDoc(value: unknown): value is { id: number } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'number' &&
    (typeof v.url === 'string' ||
      typeof v.filename === 'string' ||
      typeof v.mimeType === 'string' ||
      typeof v.thumbnailURL === 'string' ||
      typeof v.filesize === 'number' ||
      typeof v.width === 'number' ||
      typeof v.height === 'number')
  )
}

function likelyMediaField(key: string): boolean {
  return /image|logo|media/i.test(key)
}

export function collectMediaIds(value: unknown, parentKey?: string, out: Set<number> = new Set()): Set<number> {
  if (value == null) return out

  if (typeof value === 'number' && parentKey && likelyMediaField(parentKey)) {
    out.add(value)
    return out
  }

  if (Array.isArray(value)) {
    for (const item of value) collectMediaIds(item, parentKey, out)
    return out
  }

  if (looksLikeMediaDoc(value)) {
    out.add(value.id)
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as UnknownDoc)) {
      collectMediaIds(child, key, out)
    }
  }

  return out
}

async function getPublishedPublicMediaIds(req: PayloadRequest): Promise<Set<number>> {
  const ids = new Set<number>()

  const pages = await req.payload.find({
    collection: 'pages',
    where: { _status: { equals: 'published' } },
    limit: 1000,
    pagination: false,
    depth: 2,
    overrideAccess: true,
    req,
  })

  for (const page of pages.docs) {
    collectMediaIds(page, undefined, ids)
  }

  const [navbars, footers] = await Promise.all([
    req.payload.find({
      collection: 'navbar',
      limit: 1000,
      pagination: false,
      depth: 2,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'footer',
      limit: 1000,
      pagination: false,
      depth: 2,
      overrideAccess: true,
      req,
    }),
  ])

  for (const doc of [...navbars.docs, ...footers.docs]) {
    collectMediaIds(doc, undefined, ids)
  }

  return ids
}

export async function syncPublicMediaFlags(req: PayloadRequest): Promise<void> {
  const publicIds = await getPublishedPublicMediaIds(req)

  const media = await req.payload.find({
    collection: 'media',
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const doc of media.docs as Array<{ id: number; isPublic?: boolean | null }>) {
    const shouldBePublic = publicIds.has(doc.id)
    const isPublic = doc.isPublic === true
    if (shouldBePublic === isPublic) continue

    await req.payload.update({
      collection: 'media',
      id: doc.id,
      data: { isPublic: shouldBePublic },
      overrideAccess: true,
      req,
      context: { ...(req.context ?? {}), syncPublicMedia: true },
    })
  }
}

