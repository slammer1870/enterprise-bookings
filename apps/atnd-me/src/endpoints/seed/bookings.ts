import type { Payload, PayloadRequest } from 'payload'
import type { User, Timeslot, Booking } from '@repo/shared-types'
import type { Tenant, EventType, StaffMember } from '@/payload-types'

const SAUNA_TENANTS = [
  { name: 'Dundrum', slug: 'dundrum', description: 'Sauna — Dublin South' },
  { name: 'Greystones', slug: 'greystones', description: 'Sauna — Wicklow coast' },
  { name: 'Tallaght', slug: 'tallaght', description: 'Sauna — Dublin South-West' },
] as const

/**
 * Deletes default data created by createDefaultTenantData hook for a specific tenant
 */
async function deleteDefaultTenantData(
  tenantId: number | string,
  payload: Payload,
  req: PayloadRequest,
) {
  const tenantReq = {
    ...req,
    context: { ...req.context, tenant: tenantId },
  }

  payload.logger.info(`  Deleting default data for tenant ${tenantId}...`)

  try {
    const timeslots = await payload.find({
      collection: 'timeslots',
      where: {
        location: { equals: 'Main Studio' },
        tenant: { equals: tenantId },
      },
      limit: 100,
      req: tenantReq,
      overrideAccess: true,
    })

    for (const timeslot of timeslots.docs) {
      await payload.delete({
        collection: 'timeslots',
        id: timeslot.id,
        req: tenantReq,
        overrideAccess: true,
      })
    }
  } catch (error) {
    payload.logger.warn(`    Could not delete default timeslots: ${error}`)
  }

  const defaultEventTypePatterns = [
    `Yoga Class ${tenantId}`,
    `Fitness Class ${tenantId}`,
    `Small Group Class ${tenantId}`,
  ]

  for (const pattern of defaultEventTypePatterns) {
    try {
      const eventTypes = await payload.find({
        collection: 'event-types',
        where: {
          name: { equals: pattern },
          tenant: { equals: tenantId },
        },
        limit: 100,
        req: tenantReq,
        overrideAccess: true,
      })

      for (const eventType of eventTypes.docs) {
        await payload.delete({
          collection: 'event-types',
          id: eventType.id,
          req: tenantReq,
          overrideAccess: true,
        })
      }
    } catch (error) {
      payload.logger.warn(`    Could not delete class option ${pattern}: ${error}`)
    }
  }
}

/**
 * Seeds booking data for sauna demo: Dundrum, Greystones, Tallaght.
 * Creates tenants, admin user, demo users, staffMembers, class options, timeslots, bookings.
 */
export async function seedBookings({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<{
  tenants: Tenant[]
  users: User[]
  staffMembers: StaffMember[]
  eventTypes: EventType[]
  timeslots: Timeslot[]
  bookings: Booking[]
}> {
  payload.logger.info('— Seeding sauna demo (Dundrum, Greystones, Tallaght)...')

  payload.logger.info('  Clearing existing booking data...')
  try {
    await payload.db.deleteMany({ collection: 'transactions', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete transactions: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  try {
    await payload.db.deleteMany({ collection: 'bookings', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete bookings: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  try {
    await payload.db.deleteMany({ collection: 'timeslots', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete timeslots: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  try {
    await payload.db.deleteMany({ collection: 'event-types', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete event-types: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  try {
    await payload.db.deleteMany({ collection: 'class-passes', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete class-passes: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  try {
    await payload.db.deleteMany({ collection: 'class-pass-types', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete class-pass-types: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  try {
    await payload.db.deleteMany({ collection: 'staff-members', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete staffMembers: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  const demoUserEmails = ['admin@test.com', 'demo1@test.com', 'demo2@test.com', 'demo3@test.com', 'demo4@test.com', 'demo5@test.com']
  for (const email of demoUserEmails) {
    try {
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: email.toLowerCase() } },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs[0]) {
        await payload.delete({ collection: 'users', id: existing.docs[0].id, overrideAccess: true })
      }
    } catch (e) {
      payload.logger.warn(`  Could not delete user ${email}: ${e}`)
    }
  }

  const createWithTenant = async <T = unknown>(
    collection: string,
    data: Record<string, unknown>,
    tenantId: number | string,
    options?: Omit<Parameters<typeof payload.create>[0], 'collection' | 'data' | 'req'>,
  ): Promise<T> => {
    const tenantReq = { ...req, context: { ...req.context, tenant: tenantId } }
    return payload.create({
      collection,
      data: { ...data, tenant: tenantId },
      req: tenantReq,
      ...options,
    } as Parameters<typeof payload.create>[0]) as Promise<T>
  }

  const getId = (item: unknown): number | string => {
    if (!item) return ''
    return typeof item === 'object' && item !== null && 'id' in item
      ? (item as { id: number | string }).id
      : (item as number | string)
  }

  payload.logger.info('  Creating tenants...')
  const tenants: Tenant[] = []
  const defaultAllowedBlocks: NonNullable<Tenant['allowedBlocks']> = [
    'threeColumnLayout',
    'location',
    'faqs',
  ]
  const tenantDataWithBlocks = SAUNA_TENANTS.map((t) => ({
    ...t,
    allowedBlocks: defaultAllowedBlocks,
  }))
  for (const t of tenantDataWithBlocks) {
    const existing = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: t.slug } },
      limit: 1,
      overrideAccess: true,
    })
    const tenant = existing.docs[0]
      ? await payload.update({
          collection: 'tenants',
          id: existing.docs[0].id,
          data: t,
          overrideAccess: true,
        })
      : await payload.create({
          collection: 'tenants',
          data: t,
          overrideAccess: true,
        })
    tenants.push(tenant as Tenant)
  }

  payload.logger.info('  Enabling Stripe Connect for all tenants...')
  for (const t of tenants) {
    await payload.update({
      collection: 'tenants',
      id: t.id,
      data: {
        stripeConnectAccountId: `acct_seed_${(t as { slug?: string }).slug ?? t.id}`,
        stripeConnectOnboardingStatus: 'active',
        stripeConnectConnectedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  }

  payload.logger.info('  Waiting for createDefaultTenantData hook...')
  await new Promise((r) => setTimeout(r, 2000))
  for (const t of tenants) {
    await deleteDefaultTenantData(t.id, payload, req)
  }

  payload.logger.info('  Creating admin and demo users...')
  const adminUser = await payload.create({
    collection: 'users',
    data: {
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password',
      emailVerified: true,
      role: ['admin'],
      roles: ['admin'],
    },
    draft: false,
    overrideAccess: true,
  })

  const demoUsers: { id: number }[] = []
  for (let i = 1; i <= 5; i++) {
    const u = await payload.create({
      collection: 'users',
      data: {
        name: `Demo User ${i}`,
        email: `demo${i}@test.com`,
        password: 'password',
        emailVerified: true,
        role: ['user'],
        roles: ['user'],
      },
      draft: false,
      overrideAccess: true,
    })
    demoUsers.push({ id: u.id as number })
  }

  const allTimeslots: Timeslot[] = []
  const allBookings: Booking[] = []
  const allEventTypes: EventType[] = []
  const allStaffMembers: StaffMember[] = []

  const now = new Date()

  for (const tenant of tenants) {
    payload.logger.info(`  Seeding tenant: ${tenant.name}...`)

    const staffMemberEmail = `${(tenant as { slug?: string }).slug}@staffMember.com`.toLowerCase()
    let staffMemberUser = await payload.find({
      collection: 'users',
      where: { email: { equals: staffMemberEmail } },
      limit: 1,
      overrideAccess: true,
    }).then((r) => r.docs[0])

    if (!staffMemberUser) {
      staffMemberUser = await payload.create({
        collection: 'users',
        data: {
          name: `${tenant.name} StaffMember`,
          email: staffMemberEmail,
          password: 'password',
          emailVerified: true,
          role: ['user'],
          roles: ['user'],
        },
        draft: false,
        overrideAccess: true,
      })
    }

    const staffMember = await createWithTenant(
      'staff-members',
      { user: staffMemberUser.id, active: true },
      tenant.id,
      { overrideAccess: true },
    )
    allStaffMembers.push(staffMember as StaffMember)

    const saunaOnly = await createWithTenant(
      'class-pass-types',
      {
        name: 'Sauna Only',
        slug: `sauna-only-${tenant.id}`,
        description: 'Valid for sauna sessions only',
        quantity: 10,
      },
      tenant.id,
      { overrideAccess: true },
    )
    const allAccess = await createWithTenant(
      'class-pass-types',
      {
        name: 'All Access',
        slug: `all-access-${tenant.id}`,
        description: 'Valid for all sessions',
        quantity: 10,
      },
      tenant.id,
      { overrideAccess: true },
    )
    const saunaOnlyId = getId(saunaOnly)
    const allAccessId = getId(allAccess)

    const opt50 = await createWithTenant(
      'event-types',
      {
        name: 'Wood fired sauna (50 min)',
        places: 12,
        description: '50-minute sauna. Pay by card or use Sauna Only / All Access pass.',
        paymentMethods: { allowedClassPasses: [saunaOnlyId, allAccessId] },
      },
      tenant.id,
      { draft: false, overrideAccess: true },
    )
    const opt30 = await createWithTenant(
      'event-types',
      {
        name: 'Wood fired sauna (30 min)',
        places: 8,
        description: '30-minute sauna. Sauna Only or All Access pass only.',
        paymentMethods: { allowedClassPasses: [saunaOnlyId, allAccessId] },
      },
      tenant.id,
      { draft: false, overrideAccess: true },
    )
    allEventTypes.push(opt50 as EventType, opt30 as EventType)
    const opt50Id = getId(opt50)

    const pastTimeslots: { id: number }[] = []
    for (let d = 1; d <= 21; d++) {
      const timeslotDate = new Date(now)
      timeslotDate.setDate(timeslotDate.getDate() - d)
      timeslotDate.setHours(17, 0, 0, 0)
      const endDate = new Date(timeslotDate)
      endDate.setHours(17, 50, 0, 0)
      const timeslot = await createWithTenant(
        'timeslots',
        {
          date: timeslotDate.toISOString(),
          startTime: timeslotDate.toISOString(),
          endTime: endDate.toISOString(),
          eventType: opt50Id,
          location: 'Sauna 1',
          active: true,
          lockOutTime: 30,
        },
        tenant.id,
        { draft: false, overrideAccess: true },
      )
      pastTimeslots.push({ id: (timeslot as { id: number }).id })
      allTimeslots.push(timeslot as Timeslot)
    }

    const upcomingTimeslots: { id: number }[] = []
    for (let d = 1; d <= 7; d++) {
      const timeslotDate = new Date(now)
      timeslotDate.setDate(timeslotDate.getDate() + d)
      timeslotDate.setHours(17, 0, 0, 0)
      const endDate = new Date(timeslotDate)
      endDate.setHours(17, 50, 0, 0)
      const timeslot = await createWithTenant(
        'timeslots',
        {
          date: timeslotDate.toISOString(),
          startTime: timeslotDate.toISOString(),
          endTime: endDate.toISOString(),
          eventType: opt50Id,
          location: 'Sauna 1',
          active: true,
          lockOutTime: 30,
        },
        tenant.id,
        { draft: false, overrideAccess: true },
      )
      upcomingTimeslots.push({ id: (timeslot as { id: number }).id })
      allTimeslots.push(timeslot as Timeslot)
    }

    const bookingCount = tenant.slug === 'dundrum' ? 45 : tenant.slug === 'greystones' ? 32 : 28
    const timeslotPool = [...pastTimeslots, ...upcomingTimeslots]

    // Build a weighted day distribution for realistic graph variation:
    // - Spread over last 63 days (9 weeks) for analytics presets (7, 30, 91 days)
    // - Weekends (Sat/Sun) get ~1.5x weight
    // - Deterministic per-day variation (hash of day + tenant) for reproducibility
    const daysBack = 63
    const seedOffset = (tenant.slug === 'dundrum' ? 0 : tenant.slug === 'greystones' ? 1000 : 2000)
    const weights: number[] = []
    for (let d = 0; d < daysBack; d++) {
      const date = new Date(now)
      date.setDate(date.getDate() - d)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const baseWeight = isWeekend ? 1.5 : 1
      const pseudoRandom = 0.5 + 0.5 * (Math.abs(Math.sin((d + seedOffset) * 12.9898) * 43758.5453) % 1)
      weights.push(baseWeight * pseudoRandom)
    }
    const totalWeight = weights.reduce((a, b) => a + b, 0)

    // Allocate bookings to days proportionally, with remainder distributed to highest-weight days
    const bookingsPerDay: number[] = new Array(daysBack).fill(0)
    let allocated = 0
    for (let d = 0; d < daysBack; d++) {
      const w = weights[d]!
      const share = (w / totalWeight) * bookingCount
      const count = Math.floor(share)
      bookingsPerDay[d] = count
      allocated += count
    }
    const remainder = bookingCount - allocated
    const sortedByWeight = weights
      .map((w, i) => [i, w] as const)
      .sort((a, b) => b[1] - a[1])
    for (let r = 0; r < remainder; r++) {
      const idx = sortedByWeight[r]![0]
      const current = bookingsPerDay[idx] ?? 0
      bookingsPerDay[idx] = current + 1
    }

    let bookingIndex = 0
    for (let d = 0; d < daysBack && bookingIndex < bookingCount; d++) {
      const perDay = bookingsPerDay[d] ?? 0
      for (let c = 0; c < perDay && bookingIndex < bookingCount; c++) {
        const timeslot = timeslotPool[bookingIndex % timeslotPool.length]
        const user = demoUsers[bookingIndex % demoUsers.length]
        if (!timeslot || !user) continue
        const bookingDate = new Date(now)
        bookingDate.setDate(bookingDate.getDate() - d)
        const b = await createWithTenant(
          'bookings',
          {
            user: user.id,
            timeslot: timeslot.id,
            status: 'confirmed',
            createdAt: bookingDate.toISOString(),
          },
          tenant.id,
          { draft: false, overrideAccess: true },
        )
        allBookings.push(b as Booking)
        bookingIndex++
      }
    }
  }

  payload.logger.info(
    `  Created: ${tenants.length} tenants, ${1 + demoUsers.length} users, ${allStaffMembers.length} staffMembers, ${allEventTypes.length} class options, ${allTimeslots.length} timeslots, ${allBookings.length} bookings`,
  )

  return {
    tenants,
    users: [adminUser as User, ...(demoUsers as unknown as User[])],
    staffMembers: allStaffMembers,
    eventTypes: allEventTypes,
    timeslots: allTimeslots,
    bookings: allBookings,
  }
}

/**
 * Seeds scheduler documents for each tenant (sauna schedule: daily 17:00, 18:00)
 */
export async function seedSchedulers({
  payload,
  req,
  tenants,
  eventTypes,
  staffMembers,
}: {
  payload: Payload
  req: PayloadRequest
  tenants: Tenant[]
  eventTypes: EventType[]
  staffMembers: StaffMember[]
}): Promise<void> {
  payload.logger.info('— Seeding schedulers for tenants...')

  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 7)
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + 90)

  const getId = (item: unknown): number | string => {
    if (!item) return ''
    return typeof item === 'object' && item !== null && 'id' in item
      ? (item as { id: number | string }).id
      : (item as number | string)
  }

  for (const tenant of tenants) {
    const tenantReq = { ...req, context: { ...req.context, tenant: tenant.id } }
    const tenantEventTypes = eventTypes.filter((co) => getId(co.tenant) === tenant.id)
    const tenantStaffMembers = staffMembers.filter((inst) => getId(inst.tenant) === tenant.id)

    const defaultEventType = tenantEventTypes[0]
    const defaultStaffMember = tenantStaffMembers[0]
    const defaultEventTypeId =
      typeof getId(defaultEventType) === 'string'
        ? Number(getId(defaultEventType))
        : (getId(defaultEventType) as number)
    const defaultStaffMemberIdRaw = getId(defaultStaffMember)
    const defaultStaffMemberId =
      typeof defaultStaffMemberIdRaw === 'string' ? Number(defaultStaffMemberIdRaw) : defaultStaffMemberIdRaw

    if (!defaultEventTypeId || !defaultStaffMemberId) {
      payload.logger.warn(`  Skipping scheduler for tenant ${tenant.id}: missing class option or staffMember`)
      continue
    }

    const weekDays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ].map(() => ({
      timeSlot: [
        {
          startTime: new Date('2000-01-01T17:00:00').toISOString(),
          endTime: new Date('2000-01-01T17:50:00').toISOString(),
          eventType: defaultEventTypeId,
          location: 'Sauna 1',
          staffMember: defaultStaffMemberId as number,
          active: true,
        },
        {
          startTime: new Date('2000-01-01T18:00:00').toISOString(),
          endTime: new Date('2000-01-01T18:50:00').toISOString(),
          eventType: defaultEventTypeId,
          location: 'Sauna 1',
          staffMember: defaultStaffMemberId as number,
          active: true,
        },
      ],
    }))

    const schedulerData = {
      tenant: tenant.id,
      startDate: startDate.toISOString().split('T')[0] as string,
      endDate: endDate.toISOString().split('T')[0] as string,
      lockOutTime: 30,
      defaultEventType: defaultEventTypeId,
      week: { days: weekDays },
      clearExisting: false,
    }

    const existing = await payload.find({
      collection: 'scheduler',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'scheduler',
        id: existing.docs[0].id,
        data: schedulerData,
        req: tenantReq,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'scheduler',
        data: schedulerData,
        req: tenantReq,
        overrideAccess: true,
        draft: false,
      })
    }
  }

  payload.logger.info('  Schedulers seeded successfully!')
}
