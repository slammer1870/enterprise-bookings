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
    // We only need fields that could reference media; keep it reasonably narrow.
    // (Explicit typing is messy across apps; keep runtime safety with `as any`.)
    select: {
      id: true,
      layout: true,
      hero: true,
      featuredImage: true,
      meta: true,
      tenant: true,
    } as any,
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
      select: {
        id: true,
        logo: true,
        navItems: true,
        styling: true,
        tenant: true,
      } as any,
    }),
    req.payload.find({
      collection: 'footer',
      limit: 1000,
      pagination: false,
      depth: 2,
      overrideAccess: true,
      req,
      select: {
        id: true,
        logo: true,
        navItems: true,
        styling: true,
        tenant: true,
      } as any,
    }),
  ])

  for (const doc of [...navbars.docs, ...footers.docs]) {
    collectMediaIds(doc, undefined, ids)
  }

  // Only user images for hosts assigned on an active timeslot appear on the public
  // schedule/event pages. Next/Image fetches `/api/media/file/...` without tenant
  // cookies, so those media docs must be marked isPublic — not every user image.
  const hostedTimeslots = await req.payload.find({
    collection: 'timeslots',
    where: {
      and: [{ staffMember: { exists: true } }, { active: { not_equals: false } }],
    },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
    select: {
      id: true,
      staffMember: true,
    } as any,
  })

  const staffUserIds = new Set<number>()
  for (const slot of hostedTimeslots.docs) {
    const raw = (slot as { staffMember?: unknown }).staffMember
    const id =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && /^\d+$/.test(raw)
          ? parseInt(raw, 10)
          : raw && typeof raw === 'object' && raw !== null && 'id' in raw
            ? Number((raw as { id: unknown }).id)
            : NaN
    if (Number.isFinite(id)) staffUserIds.add(id)
  }

  if (staffUserIds.size > 0) {
    const staffUsers = await req.payload.find({
      collection: 'users',
      where: {
        and: [{ id: { in: [...staffUserIds] } }, { image: { exists: true } }],
      },
      limit: 1000,
      pagination: false,
      depth: 1,
      overrideAccess: true,
      req,
      select: {
        id: true,
        image: true,
      } as any,
    })

    for (const staffUser of staffUsers.docs) {
      collectMediaIds(staffUser, undefined, ids)
    }
  }

  // Published post images (hero, rich-text MediaBlocks, SEO meta) must be public
  // so Next/Image can fetch `/api/media/file/...` without tenant cookies.
  const posts = await req.payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    limit: 1000,
    pagination: false,
    depth: 2,
    overrideAccess: true,
    req,
    select: {
      id: true,
      heroImage: true,
      content: true,
      meta: true,
      tenant: true,
    } as any,
  })

  for (const post of posts.docs) {
    collectMediaIds(post, undefined, ids)
  }

  // Course cover images appear on public listing/detail pages; Next/Image fetches
  // `/api/media/file/...` without tenant cookies, so these must be marked isPublic.
  const courses = await req.payload.find({
    collection: 'courses',
    where: { status: { not_equals: 'archived' } },
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: true,
    req,
    select: {
      id: true,
      coverImage: true,
      tenant: true,
    } as any,
  })

  for (const course of courses.docs) {
    collectMediaIds(course, undefined, ids)
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
    select: { id: true, isPublic: true } as any,
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

