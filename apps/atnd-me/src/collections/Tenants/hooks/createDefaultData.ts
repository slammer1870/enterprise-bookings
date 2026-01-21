import type { Payload, PayloadRequest } from 'payload'
import type { Tenant } from '@/payload-types'
import type { Media } from '@/payload-types'

/**
 * Creates default data for a new tenant to help with onboarding
 * Creates: home page, class options, lessons, navbar, footer
 */
export async function createDefaultTenantData({
  tenant,
  payload,
  req,
}: {
  tenant: Tenant
  payload: Payload
  req: PayloadRequest
}) {
  // Set tenant context for all operations
  const tenantReq = {
    ...req,
    context: { ...req.context, tenant: tenant.id },
  }

  try {
    payload.logger.info(`Creating default data for tenant: ${tenant.name} (${tenant.slug})`)

    // 1. Get or create default media (placeholder images)
    // Try to find existing placeholder media, or create new ones
    let heroImage: Media | null = null
    let metaImage: Media | null = null

    try {
      const existingMedia = await payload.find({
        collection: 'media',
        where: {
          filename: {
            equals: 'default-hero.jpg',
          },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existingMedia.docs[0]) {
        heroImage = existingMedia.docs[0] as Media
        metaImage = existingMedia.docs[0] as Media
      }
    } catch (error) {
      payload.logger.warn('Could not find default media, skipping image setup')
    }

    // 2. Create default class options (names include tenant slug to satisfy unique:true across tenants)
    payload.logger.info('  Creating default class options...')
    const suffix = ` (${tenant.slug})`
    const classOptions = await Promise.all([
      payload.create({
        collection: 'class-options',
        data: {
          name: `Yoga Class${suffix}`,
          places: 10,
          description: 'A relaxing yoga class for all levels',
          tenant: tenant.id,
        },
        req: tenantReq,
        overrideAccess: true,
      }),
      payload.create({
        collection: 'class-options',
        data: {
          name: `Fitness Class${suffix}`,
          places: 15,
          description: 'High-intensity fitness training',
          tenant: tenant.id,
        },
        req: tenantReq,
        overrideAccess: true,
      }),
      payload.create({
        collection: 'class-options',
        data: {
          name: `Small Group Class${suffix}`,
          places: 5,
          description: 'Intimate small group session',
          tenant: tenant.id,
        },
        req: tenantReq,
        overrideAccess: true,
      }),
    ])

    // 3. Create default home page (simplified version without images)
    payload.logger.info('  Creating default home page...')
    
    // Create a simple home page without images to avoid validation errors
    // Images can be added later by the tenant admin
    const homePageData: any = {
      slug: 'home',
      title: `Welcome to ${tenant.name}`,
      _status: 'published',
      hero: {
        type: 'lowImpact',
        richText: {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: `Welcome to ${tenant.name}`,
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                tag: 'h1',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
      layout: [
        // Simple HeroScheduleBlock without images
        {
          blockName: 'Hero Schedule',
          blockType: 'heroSchedule',
          title: `Welcome to ${tenant.name}`,
          logo: (tenant.logo && typeof tenant.logo === 'object' && 'id' in tenant.logo) ? tenant.logo.id : undefined,
          links: [
            {
              link: {
                type: 'custom',
                appearance: 'default',
                label: 'Book a Class',
                url: '/bookings',
              },
            },
          ],
        },
      ],
      meta: {
        description: `Welcome to ${tenant.name}. Book classes and manage your bookings.`,
        title: `Welcome to ${tenant.name}`,
      },
    }

    const homePage = await payload.create({
      collection: 'pages',
      data: {
        ...homePageData,
        tenant: tenant.id,
      },
      req: tenantReq,
      overrideAccess: true,
    })

    // 4. Create default lessons (2-3 upcoming lessons)
    payload.logger.info('  Creating default lessons...')
    const lessonReq = {
      ...tenantReq,
      context: { ...tenantReq.context, triggerAfterChange: false },
    }
    const now = new Date()
    
    // Lesson 1: Tomorrow at 10:00-11:00
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(11, 0, 0, 0)

    await payload.create({
      collection: 'lessons',
      data: {
        date: tomorrow.toISOString(),
        startTime: tomorrow.toISOString(),
        endTime: tomorrowEnd.toISOString(),
        classOption: typeof classOptions[0] === 'object' && 'id' in classOptions[0] ? classOptions[0].id : classOptions[0],
        location: 'Main Studio',
        active: true,
        lockOutTime: 30,
        tenant: tenant.id,
      },
      req: lessonReq,
      overrideAccess: true,
    })

    // Lesson 2: Day after tomorrow at 14:00-15:00
    const dayAfterTomorrow = new Date(now)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    dayAfterTomorrow.setHours(14, 0, 0, 0)
    const dayAfterTomorrowEnd = new Date(dayAfterTomorrow)
    dayAfterTomorrowEnd.setHours(15, 0, 0, 0)

    await payload.create({
      collection: 'lessons',
      data: {
        date: dayAfterTomorrow.toISOString(),
        startTime: dayAfterTomorrow.toISOString(),
        endTime: dayAfterTomorrowEnd.toISOString(),
        classOption: typeof classOptions[1] === 'object' && 'id' in classOptions[1] ? classOptions[1].id : classOptions[1],
        location: 'Main Studio',
        active: true,
        lockOutTime: 30,
        tenant: tenant.id,
      },
      req: lessonReq,
      overrideAccess: true,
    })

    // 5. Create default navbar
    payload.logger.info('  Creating default navbar...')
    await payload.create({
      collection: 'navbar',
      data: {
        logo: (typeof tenant.logo === 'object' && tenant.logo !== null && 'id' in tenant.logo) ? tenant.logo.id : undefined,
        logoLink: '/',
        navItems: [
          {
            link: {
              type: 'reference',
              reference: {
                relationTo: 'pages',
                value: typeof homePage === 'object' && 'id' in homePage ? homePage.id : homePage,
              },
              label: 'Home',
            },
          },
          {
            link: {
              type: 'custom',
              url: '/bookings',
              label: 'Bookings',
            },
          },
        ],
        styling: {
          backgroundColor: '#ffffff',
          textColor: '#000000',
        },
        tenant: tenant.id,
      },
      req: tenantReq,
      overrideAccess: true,
    })

    // 6. Create default footer
    payload.logger.info('  Creating default footer...')
    await payload.create({
      collection: 'footer',
      data: {
        logoLink: '/',
        navItems: [],
        styling: {
          backgroundColor: '#f3f4f6',
          textColor: '#000000',
        },
        tenant: tenant.id,
      },
      req: tenantReq,
      overrideAccess: true,
    })

    payload.logger.info(`✅ Default data created successfully for tenant: ${tenant.name}`)
  } catch (error) {
    payload.logger.error(`Error creating default data for tenant ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`)
    // Don't throw - allow tenant creation to succeed even if default data fails
    // Admin can create data manually if needed
  }
}
