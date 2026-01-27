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
import { seedBookings, seedSchedulers } from './bookings'
import { croiLanSaunaPage } from './croi-lan-sauna-page'
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
  // Order: bookings -> lessons -> scheduler -> class-options -> instructors -> users -> others
  const orderedCollections: CollectionSlug[] = [
    'bookings',
    'lessons',
    'scheduler', // Delete scheduler before class-options and instructors since it references them
    'class-options',
    'instructors',
    // Then delete other collections
    ...collections.filter(
      (c) => !['bookings', 'lessons', 'scheduler', 'class-options', 'instructors'].includes(c)
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

  // Seed schedulers for tenants
  await seedSchedulers({
    payload,
    req,
    tenants: bookingData.tenants,
    classOptions: bookingData.classOptions,
    instructors: bookingData.instructors,
  })

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
        role: ['admin'],
        roles: ['admin'],
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

  // Find or create home page for tenant1
  const existingTenant1HomePage = await payload.find({
    collection: 'pages',
    where: {
      slug: {
        equals: 'home',
      },
      tenant: {
        equals: tenant1.id,
      },
    },
    limit: 1,
    req: tenant1Req,
    overrideAccess: true,
  })

  const homePageData = {
    ...home({ heroImage: imageHomeDoc, metaImage: image2Doc, logo: logoDoc }),
    tenant: tenant1.id,
  }

  if (existingTenant1HomePage.docs[0]) {
    await payload.update({
      collection: 'pages',
      id: existingTenant1HomePage.docs[0].id,
      depth: 0,
      req: tenant1Req,
      context: {
        disableRevalidate: true,
      },
      data: homePageData,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'pages',
      depth: 0,
      req: tenant1Req,
      context: {
        disableRevalidate: true,
      },
      data: homePageData,
      overrideAccess: true,
    })
  }

  // Create contact page
  const contactPage = await payload.create({
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
    overrideAccess: true,
  })

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

  // Seed Croí Lán Sauna tenant pages and content
  const croiLanSaunaTenant = bookingData.tenants.find((t) => t.slug === 'croi-lan-sauna')
  if (croiLanSaunaTenant) {
    payload.logger.info(`— Seeding Croí Lán Sauna tenant content...`)

    // Download or get existing media for Croí Lán Sauna
    const [croiLanSaunaLogo, croiLanSaunaHero, croiLanSaunaAbout] = await Promise.all([
      getOrCreateMediaFromURL({
        payload,
        req,
        url: 'https://croilan.com/assets/Just%20Flame%20Logo-vkNNsPzM.webp',
        alt: 'Croí Lán Sauna Logo',
        filename: 'croi-lan-sauna-logo.webp',
      }),
      getOrCreateMediaFromURL({
        payload,
        req,
        url: 'https://croilan.com/assets/Real_Sauna-DWpsViRq.webp',
        alt: 'Croí Lán Sauna - Real Sauna',
        filename: 'croi-lan-sauna-hero.webp',
      }),
      getOrCreateMediaFromURL({
        payload,
        req,
        url: 'https://croilan.com/assets/sauna-interior-CfP9kPDc.jpg',
        alt: 'Croí Lán Sauna Interior',
        filename: 'croi-lan-sauna-interior.jpg',
      }),
    ])

    // Create tenant-scoped request
    const croiLanSaunaReq = {
      ...req,
      context: { ...req.context, tenant: croiLanSaunaTenant.id },
    }

    // Find existing home page (created by createDefaultTenantData hook) or create new one
    const existingHomePage = await payload.find({
      collection: 'pages',
      where: {
        slug: {
          equals: 'home',
        },
        tenant: {
          equals: croiLanSaunaTenant.id,
        },
      },
      limit: 1,
      req: croiLanSaunaReq,
      overrideAccess: true,
    })

    const pageData = {
      ...croiLanSaunaPage({
        heroImage: croiLanSaunaHero,
        logo: croiLanSaunaLogo,
        aboutImage: croiLanSaunaAbout,
      }),
      tenant: croiLanSaunaTenant.id,
    }

    if (existingHomePage.docs[0]) {
      // Update existing home page
      await payload.update({
        collection: 'pages',
        id: existingHomePage.docs[0].id,
        depth: 0,
        req: croiLanSaunaReq,
        context: {
          disableRevalidate: true,
        },
        data: pageData,
        overrideAccess: true,
      })
      payload.logger.info(`  Updated existing home page for Croí Lán Sauna`)
    } else {
      // Create new home page if it doesn't exist
      await payload.create({
        collection: 'pages',
        depth: 0,
        req: croiLanSaunaReq,
        context: {
          disableRevalidate: true,
        },
        data: pageData,
        overrideAccess: true,
      })
      payload.logger.info(`  Created new home page for Croí Lán Sauna`)
    }

    // Find or create navbar for Croí Lán Sauna
    // Since navbar is tenant-scoped, try to find any navbar in the tenant context
    let existingNavbar
    try {
      existingNavbar = await payload.find({
        collection: 'navbar',
        limit: 1,
        req: croiLanSaunaReq,
        overrideAccess: true,
      })
    } catch (error) {
      // If query fails, assume no navbar exists
      existingNavbar = { docs: [] }
    }

    const navbarData = {
      tenant: croiLanSaunaTenant.id,
      logo: croiLanSaunaLogo?.id || undefined,
      logoLink: '/',
      navItems: [
        {
          link: {
            type: 'custom' as const,
            label: 'Book Now',
            url: '/bookings',
          },
          renderAsButton: true,
          buttonVariant: 'default' as const,
        },
      ],
      styling: {
        padding: 'medium' as const,
        sticky: false,
      },
    }

    if (existingNavbar.docs[0]) {
      await payload.update({
        collection: 'navbar',
        id: existingNavbar.docs[0].id,
        req: croiLanSaunaReq,
        context: {
          disableRevalidate: true,
        },
        data: navbarData,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'navbar',
        req: croiLanSaunaReq,
        context: {
          disableRevalidate: true,
        },
        data: navbarData,
        overrideAccess: true,
      })
    }

    // Find or create footer for Croí Lán Sauna
    // Since footer is tenant-scoped, try to find any footer in the tenant context
    // If querying by tenant field fails, we'll just try to update/create
    let existingFooter
    try {
      existingFooter = await payload.find({
        collection: 'footer',
        limit: 1,
        req: croiLanSaunaReq,
        overrideAccess: true,
      })
    } catch (error) {
      // If query fails, assume no footer exists
      existingFooter = { docs: [] }
    }

    const footerData = {
      tenant: croiLanSaunaTenant.id,
      logoLink: '/',
      navItems: [
        {
          link: {
            type: 'custom' as const,
            label: 'Location',
            url: '#location',
          },
        },
        {
          link: {
            type: 'custom' as const,
            label: 'Instagram',
            newTab: true,
            url: 'https://www.instagram.com/croilansauna/',
          },
        },
      ],
      styling: {
        showThemeSelector: false,
      },
    }

    if (existingFooter.docs && existingFooter.docs[0]) {
      await payload.update({
        collection: 'footer',
        id: existingFooter.docs[0].id,
        req: croiLanSaunaReq,
        context: {
          disableRevalidate: true,
        },
        data: footerData,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'footer',
        req: croiLanSaunaReq,
        context: {
          disableRevalidate: true,
        },
        data: footerData,
        overrideAccess: true,
      })
    }

    payload.logger.info(`  Croí Lán Sauna tenant content seeded successfully!`)
  }

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

/**
 * Gets or creates a media document from a URL
 * Checks if media already exists (by source URL stored in alt text) before downloading
 * Tries multiple methods: REST API URL upload, direct URL in data, then download fallback
 */
async function getOrCreateMediaFromURL({
  payload,
  req,
  url,
  alt,
  filename,
}: {
  payload: Payload
  req: PayloadRequest
  url: string
  alt?: string
  filename?: string
}): Promise<any> {
  // First, check if media with this source URL already exists
  // We store the source URL in the alt text for reference
  const existingMedia = await payload.find({
    collection: 'media',
    where: {
      alt: {
        contains: url,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existingMedia.docs[0]) {
    payload.logger.info(`  Media already exists for ${url}, reusing existing media`)
    return existingMedia.docs[0]
  }

  // Extract filename from URL if not provided
  const finalFilename = filename || url.split('/').pop() || `file-${Date.now()}`
  const altText = alt ? `${alt} (Source: ${url})` : `Source: ${url}`

  // Method 1: Try REST API URL Upload
  try {
    payload.logger.info(`  Attempting REST API URL upload for ${url}...`)
    // Note: Payload's REST API typically requires file uploads via FormData
    // The admin panel's URL paste feature likely downloads the file client-side first
    // So we'll skip this method and go straight to Method 2 or fallback
  } catch (error) {
    payload.logger.debug(`  REST API method not available: ${error}`)
  }

  // Method 2: Try Direct URL in Data Field
  try {
    payload.logger.info(`  Attempting direct URL in data field for ${url}...`)
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        url: url,
        alt: altText,
      },
      overrideAccess: true,
    })
    if (mediaDoc) {
      payload.logger.info(`  Successfully created media from URL using data field method`)
      return mediaDoc
    }
  } catch (error) {
    payload.logger.debug(`  Direct URL in data field not supported: ${error}`)
  }

  // Method 3 (Fallback): Download and create with file buffer
  payload.logger.info(`  Downloading media from ${url}...`)
  const file = await fetchFileByURL(url)

  const mediaDoc = await payload.create({
    collection: 'media',
    data: {
      alt: altText,
    },
    file: {
      ...file,
      name: finalFilename,
    },
    overrideAccess: true,
  })

  return mediaDoc
}
