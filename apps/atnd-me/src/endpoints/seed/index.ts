import type { CollectionSlug, Payload, PayloadRequest, File } from 'payload'
import type { Media } from '@/payload-types'

import { seedBookings, seedSchedulers } from './bookings'
import { saunaPage } from './sauna-page'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'forms',
  'form-submissions',
  'search',
  'bookings',
  'timeslots',
  'event-types',
  'staff-members',
  'navbar',
  'footer',
  'scheduler',
]

// Next.js revalidation errors are normal when seeding without a server running
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (nodeEnv === 'production') {
    throw new Error('Seed function cannot be run in production environment')
  }

  payload.logger.info('Seeding database (Dundrum, Greystones, Tallaght)...')
  payload.logger.warn(`⚠️  Running seed in ${nodeEnv} environment`)

  payload.logger.info(`— Clearing collections...`)

  const orderedCollections: CollectionSlug[] = [
    'transactions',
    'bookings',
    'timeslots',
    'scheduler',
    'event-types',
    'class-passes',
    'class-pass-types',
    'staff-members',
    ...collections.filter(
      (c) =>
        ![
          'transactions',
          'bookings',
          'timeslots',
          'scheduler',
          'event-types',
          'class-passes',
          'class-pass-types',
          'staff-members',
        ].includes(c),
    ),
    'tenants',
  ]

  for (const collection of orderedCollections) {
    try {
      await payload.db.deleteMany({ collection, req, where: {} })
    } catch (error) {
      payload.logger.warn(`Could not delete ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection]?.config?.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  const bookingData = await seedBookings({ payload, req })
  if (!bookingData.tenants?.length) {
    throw new Error('Seed bookings did not create any tenants')
  }

  await seedSchedulers({
    payload,
    req,
    tenants: bookingData.tenants,
    classOptions: bookingData.classOptions,
    instructors: bookingData.instructors,
  })

  payload.logger.info(`— Seeding pages, navbar and footer for each tenant...`)

  const saunaImageUrl = 'https://croilan.com/assets/Real_Sauna-DWpsViRq.webp'
  const saunaInteriorUrl = 'https://croilan.com/assets/sauna-interior-CfP9kPDc.jpg'
  const logoUrl = 'https://croilan.com/assets/Just%20Flame%20Logo-vkNNsPzM.webp'

  for (const tenant of bookingData.tenants) {
    const tenantName = (tenant as { name?: string }).name ?? String(tenant.id)
    const tenantSlug = (tenant as { slug?: string }).slug ?? ''
    payload.logger.info(`  Seeding content for ${tenantName}...`)

    const [heroImage, aboutImage, logo] = await Promise.all([
      getOrCreateMediaFromURL({
        payload,
        req,
        url: saunaImageUrl,
        alt: `${tenantName} Hero`,
        filename: `${tenantSlug}-hero.webp`,
      }),
      getOrCreateMediaFromURL({
        payload,
        req: req,
        url: saunaInteriorUrl,
        alt: `${tenantName} Interior`,
        filename: `${tenantSlug}-interior.jpg`,
      }),
      getOrCreateMediaFromURL({
        payload,
        req: req,
        url: logoUrl,
        alt: `${tenantName} Logo`,
        filename: `${tenantSlug}-logo.webp`,
      }),
    ])

    if (!heroImage || !aboutImage) {
      payload.logger.warn(`  Could not fetch media for ${tenantName}, skipping pages`)
      continue
    }

    const tenantReq = {
      ...req,
      context: { ...req.context, tenant: tenant.id },
    }

    const pageData = {
      ...saunaPage({
        tenantName,
        heroImage,
        logo: logo ?? undefined,
        aboutImage,
      }),
      tenant: tenant.id,
    }

    const existingPage = await payload.find({
      collection: 'pages',
      where: {
        slug: { equals: 'home' },
        tenant: { equals: tenant.id },
      },
      limit: 1,
      req: tenantReq,
      overrideAccess: true,
    })

    if (existingPage.docs[0]) {
      await payload.update({
        collection: 'pages',
        id: existingPage.docs[0].id,
        depth: 0,
        req: tenantReq,
        context: { disableRevalidate: true },
        data: pageData,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'pages',
        depth: 0,
        req: tenantReq,
        context: { disableRevalidate: true },
        data: pageData,
        overrideAccess: true,
      })
    }

    const existingNavbar = await payload.find({
      collection: 'navbar',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      req: tenantReq,
      overrideAccess: true,
    })

    const navbarData = {
      tenant: tenant.id,
      logo: logo?.id || undefined,
      logoLink: '/',
      navItems: [
        {
          link: { type: 'custom' as const, label: 'Book Now', url: '/bookings' },
          renderAsButton: true,
          buttonVariant: 'default' as const,
        },
      ],
      styling: { padding: 'medium' as const, sticky: false },
    }

    if (existingNavbar.docs[0]) {
      await payload.update({
        collection: 'navbar',
        id: existingNavbar.docs[0].id,
        req: tenantReq,
        context: { disableRevalidate: true },
        data: navbarData,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'navbar',
        req: tenantReq,
        context: { disableRevalidate: true },
        data: navbarData,
        overrideAccess: true,
      })
    }

    const existingFooter = await payload.find({
      collection: 'footer',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      req: tenantReq,
      overrideAccess: true,
    })

    const footerData = {
      tenant: tenant.id,
      logoLink: '/',
      navItems: [
        { link: { type: 'custom' as const, label: 'Book Now', url: '/bookings' } },
        { link: { type: 'custom' as const, label: 'Admin', url: '/admin' } },
      ],
      styling: { showThemeSelector: false },
    }

    if (existingFooter.docs[0]) {
      await payload.update({
        collection: 'footer',
        id: existingFooter.docs[0].id,
        req: tenantReq,
        context: { disableRevalidate: true },
        data: footerData,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'footer',
        req: tenantReq,
        context: { disableRevalidate: true },
        data: footerData,
        overrideAccess: true,
      })
    }
  }

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, { credentials: 'include', method: 'GET' })
  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }
  const data = await res.arrayBuffer()
  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}

async function getOrCreateMediaFromURL({
  payload,
  req: _req,
  url,
  alt,
  filename,
}: {
  payload: Payload
  req: PayloadRequest
  url: string
  alt?: string
  filename?: string
}): Promise<Media | null> {
  const existingMedia = await payload.find({
    collection: 'media',
    where: { alt: { contains: url } },
    limit: 1,
    overrideAccess: true,
  })

  if (existingMedia.docs[0]) {
    return existingMedia.docs[0] as Media
  }

  const finalFilename = filename || url.split('/').pop() || `file-${Date.now()}`
  const altText = alt ? `${alt} (Source: ${url})` : `Source: ${url}`

  try {
    const file = await fetchFileByURL(url)
    const mediaDoc = await payload.create({
      collection: 'media',
      data: { alt: altText },
      file: { ...file, name: finalFilename },
      overrideAccess: true,
    })
    return mediaDoc as Media
  } catch (error) {
    payload.logger.warn(`  Could not create media from ${url}: ${error}`)
    return null
  }
}
