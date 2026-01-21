import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'

import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { image1 } from './image-1'
import { image2 } from './image-2'
import { imageHero1 } from './image-hero-1'
import { logo as logoData } from './logo'
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'
import { seedBookings } from './bookings'
import { readFile } from 'fs/promises'
import { join } from 'path'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'forms',
  'form-submissions',
  'search',
  'bookings',
  'lessons',
  'class-options',
  'instructors',
  'navbar',
  'footer',
  'scheduler',
]

// Note: header and footer are now collections (navbar, footer), not globals
const globals: GlobalSlug[] = []

const categories = ['Technology', 'News', 'Finance', 'Design', 'Software', 'Engineering']

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  const nodeEnv = process.env.NODE_ENV || 'development'
  
  // Additional safety check (should already be checked at route level)
  if (nodeEnv === 'production') {
    throw new Error('Seed function cannot be run in production environment')
  }

  payload.logger.info('Seeding database...')
  payload.logger.warn(`⚠️  Running seed in ${nodeEnv} environment`)

  // we need to clear the media directory before seeding
  // as well as the collections and globals
  // this is because while `yarn seed` drops the database
  // the custom `/api/seed` endpoint does not
  payload.logger.info(`— Clearing collections and globals...`)

  // clear the database
  // Update globals individually to avoid type errors (not all globals have navItems)
  for (const global of globals) {
    try {
      if (global === 'header' || global === 'footer') {
        await payload.updateGlobal({
          slug: global,
          data: { navItems: [] } as any,
          depth: 0,
          context: {
            disableRevalidate: true,
          },
        })
      } else {
        await payload.updateGlobal({
          slug: global,
          data: {} as any,
          depth: 0,
          context: {
            disableRevalidate: true,
          },
        })
      }
    } catch (error) {
      // Ignore errors if global doesn't exist or doesn't have navItems
      payload.logger.warn(`Could not clear global ${global}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Delete collections in order to respect foreign key constraints
  // Order: bookings -> lessons -> class-options -> instructors -> users -> others
  const orderedCollections: CollectionSlug[] = [
    'bookings',
    'lessons',
    'class-options',
    'instructors',
    // Then delete other collections
    ...collections.filter(
      (c) => !['bookings', 'lessons', 'class-options', 'instructors'].includes(c)
    ),
  ]

  // Delete in order (not parallel) to respect foreign key constraints
  for (const collection of orderedCollections) {
    try {
      await payload.db.deleteMany({ collection, req, where: {} })
    } catch (error) {
      // Log but continue - some collections might not exist or have constraints
      payload.logger.warn(`Could not delete ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  // Seed booking data (tenants, users, instructors, class options, lessons, bookings)
  const bookingData = await seedBookings({ payload, req })
  const tenant1 = bookingData.tenants?.[0]
  if (!tenant1) {
    throw new Error('Seed bookings did not create any tenants; cannot seed tenant-scoped data')
  }

  payload.logger.info(`— Seeding demo author and user...`)

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: {
      email: {
        equals: 'demo-author@example.com',
      },
    },
  })

  payload.logger.info(`— Seeding media...`)

  const [image1Buffer, image2Buffer, image3Buffer, hero1Buffer, logoBuffer] = await Promise.all([
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post1.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post2.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post3.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp',
    ),
    // Read logo from seed directory
    readLogoFile(),
  ])

  const [demoAuthor, image1Doc, image2Doc, image3Doc, imageHomeDoc, logoDoc] = await Promise.all([
    payload.create({
      collection: 'users',
      // Explicitly set draft to avoid the `draft: true` overload in generated Payload types.
      draft: false,
      data: {
        name: 'Demo Author',
        email: 'demo-author@example.com',
        password: 'password',
        emailVerified: true,
        role: 'admin',
      },
    }),
    payload.create({
      collection: 'media',
      data: image1,
      file: image1Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image2Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image3Buffer,
    }),
    payload.create({
      collection: 'media',
      data: imageHero1,
      file: hero1Buffer,
    }),
    logoBuffer
      ? payload.create({
          collection: 'media',
          data: logoData,
          file: logoBuffer,
        })
      : Promise.resolve(null),
    categories.map((category) =>
      payload.create({
        collection: 'categories',
        data: {
          title: category,
          slug: category,
        },
      }),
    ),
  ])

  payload.logger.info(`— Seeding posts...`)

  // Do not create posts with `Promise.all` because we want the posts to be created in order
  // This way we can sort them by `createdAt` or `publishedAt` and they will be in the expected order
  const post1Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post1({ heroImage: image1Doc, blockImage: image2Doc, author: demoAuthor }),
  })

  const post2Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post2({ heroImage: image2Doc, blockImage: image3Doc, author: demoAuthor }),
  })

  const post3Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post3({ heroImage: image3Doc, blockImage: image1Doc, author: demoAuthor }),
  })

  // update each post with related posts
  await payload.update({
    id: post1Doc.id,
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: {
      relatedPosts: [post2Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post2Doc.id,
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: {
      relatedPosts: [post1Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post3Doc.id,
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: {
      relatedPosts: [post1Doc.id, post2Doc.id],
    },
  })

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
  })

  payload.logger.info(`— Seeding pages (tenant-scoped)...`)

  // Create pages scoped to tenant1
  const tenant1Req = {
    ...req,
    context: { ...req.context, tenant: tenant1.id },
  }

  const [_, contactPage] = await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      req: tenant1Req,
      context: {
        disableRevalidate: true,
      },
      data: {
        ...home({ heroImage: imageHomeDoc, metaImage: image2Doc, logo: logoDoc }),
        tenant: tenant1.id, // Explicitly set tenant
      },
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      req: tenant1Req,
      context: {
        disableRevalidate: true,
      },
      data: {
        ...contactPageData({ contactForm: contactForm }),
        tenant: tenant1.id, // Explicitly set tenant
      },
    }),
  ])

  payload.logger.info(`— Seeding navbar and footer (tenant-scoped)...`)

  // Create navbar and footer for tenant1
  await Promise.all([
    payload.create({
      collection: 'navbar',
      req: tenant1Req,
      context: {
        disableRevalidate: true,
      },
      data: {
        tenant: tenant1.id, // Explicitly set tenant
        logo: logoDoc?.id || undefined,
        logoLink: '/',
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Book Now',
              url: '/bookings',
            },
            renderAsButton: true,
            buttonVariant: 'default',
          },
        ],
        styling: {
          padding: 'medium',
          sticky: false,
        },
      },
    }),
    payload.create({
      collection: 'footer',
      req: tenant1Req,
      context: {
        disableRevalidate: true,
      },
      data: {
        tenant: tenant1.id, // Explicitly set tenant
        logoLink: '/',
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Admin',
              url: '/admin',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Source Code',
              newTab: true,
              url: 'https://github.com/payloadcms/payload/tree/main/templates/website',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Payload',
              newTab: true,
              url: 'https://payloadcms.com/',
            },
          },
        ],
        styling: {
          showThemeSelector: true,
        },
      },
    }),
  ])

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

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

async function readLogoFile(): Promise<File | null> {
  try {
    const logoPath = join(process.cwd(), 'src/endpoints/seed/logo.png')
    const fileBuffer = await readFile(logoPath)
    
    return {
      name: 'logo.png',
      data: fileBuffer,
      mimetype: 'image/png',
      size: fileBuffer.length,
    }
  } catch (error) {
    // Logo file doesn't exist, return null (logo will be optional)
    return null
  }
}
