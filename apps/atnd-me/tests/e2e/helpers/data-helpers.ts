import { getPayload, type Payload } from 'payload'
import config from '../../../src/payload.config'
import type { Tenant, User, Timeslot, EventType, Booking, Plan, Subscription } from '@repo/shared-types'
import { formatInTimeZone, resolveTimeZone } from '@repo/shared-utils'

/**
 * Helper functions for creating test data via Payload API
 * These functions use Payload directly (not via HTTP) for faster test setup
 */

let payloadInstance: Payload | null = null

/**
 * Get or create Payload instance for test data creation
 * 
 * Note: Schema push is already disabled via PW_E2E_PROFILE env var
 * set by Playwright's webServer command (see payload.config.ts)
 */
export async function getPayloadInstance(): Promise<Payload> {
  if (!payloadInstance) {
    const payloadConfig = await config
    payloadInstance = await getPayload({ config: payloadConfig })
  }
  return payloadInstance
}

function platformFeeOverrideTenantId(
  tenant: number | string | { id?: number | string } | null | undefined,
): number | null {
  if (typeof tenant === 'number' && Number.isFinite(tenant)) return tenant
  if (typeof tenant === 'string' && /^\d+$/.test(tenant)) return parseInt(tenant, 10)
  if (tenant && typeof tenant === 'object' && 'id' in tenant) {
    const id = tenant.id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

/** Pin drop-in platform fee for a tenant so parallel e2e tests do not leak overrides. */
export async function ensureTenantDropInPlatformFeePercent(
  tenantId: number,
  dropInPercent: number,
): Promise<void> {
  const payload = await getPayloadInstance()
  const platformFees = (await payload.findGlobal({
    slug: 'platform-fees',
    depth: 0,
    overrideAccess: true,
  })) as {
    defaults?: {
      dropInPercent?: number
      classPassPercent?: number
      subscriptionPercent?: number
    }
    overrides?: Array<{ tenant: number | string | { id?: number | string }; dropInPercent?: number }>
  } | null
  const overrides = platformFees?.overrides ?? []
  const existingIdx = overrides.findIndex(
    (override) => platformFeeOverrideTenantId(override.tenant) === tenantId,
  )
  const nextOverrides =
    existingIdx >= 0
      ? overrides.map((override, index) =>
          index === existingIdx ? { ...override, tenant: tenantId, dropInPercent } : override,
        )
      : [...overrides, { tenant: tenantId, dropInPercent }]

  await payload.updateGlobal({
    slug: 'platform-fees',
    data: {
      // Keep other product defaults; always restore drop-in default so int-test pollution
      // (which often mutates defaults.dropInPercent) cannot affect e2e totals.
      defaults: {
        dropInPercent: 2,
        classPassPercent: platformFees?.defaults?.classPassPercent ?? 3,
        subscriptionPercent: platformFees?.defaults?.subscriptionPercent ?? 4,
      },
      overrides: nextOverrides,
    },
    depth: 0,
    overrideAccess: true,
  } as Parameters<typeof payload.updateGlobal>[0])
}

async function resolveDefaultBranchIdForTenant(tenantId: number): Promise<number | undefined> {
  const payload = await getPayloadInstance()
  const locations = await payload.find({
    collection: 'locations',
    where: {
      and: [{ tenant: { equals: tenantId } }, { active: { equals: true } }],
    },
    sort: 'name',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const firstId = locations.docs[0]?.id
  return typeof firstId === 'number' && Number.isFinite(firstId) ? firstId : undefined
}

/**
 * Create a test tenant (idempotent by slug, then by name).
 * Reuses an existing tenant when one with the same slug or same name already exists,
 * so re-runs and multiple workers do not create duplicate "Test Tenant 1" etc.
 *
 * @param name - Tenant name
 * @param slug - Tenant slug (subdomain)
 * @param domain - Optional domain
 * @param allowedBlocks - Optional block slugs to enable for this tenant (pages layout). Empty = default blocks only.
 */
export async function createTestTenant(
  name: string,
  slug: string,
  domain?: string,
  allowedBlocks?: string[]
): Promise<Tenant> {
  const payload = await getPayloadInstance()

  // 1. Find by slug (same slug => same tenant)
  const bySlug = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  const existingBySlug = (bySlug?.docs?.[0] ?? null) as Tenant | null
  if (existingBySlug) {
    await createTestTenantHomePage(existingBySlug.id, existingBySlug.name ?? name).catch(() => null)
    return existingBySlug
  }

  // 2. Find by name so we don't create a second "Test Tenant 1" when slug differs (e.g. worker suffix)
  const byName = await payload.find({
    collection: 'tenants',
    where: { name: { equals: name } },
    limit: 1,
    overrideAccess: true,
  })
  const existingByName = (byName?.docs?.[0] ?? null) as Tenant | null
  if (existingByName) {
    await createTestTenantHomePage(existingByName.id, existingByName.name ?? name).catch(() => null)
    return existingByName
  }

  const tenant = (await payload.create({
    collection: 'tenants',
    data: {
      name,
      slug,
      ...(domain && { domain }),
      ...(allowedBlocks !== undefined && { allowedBlocks }),
    },
    overrideAccess: true,
  })) as Tenant

  // PW_E2E_SKIP_DEFAULT_TENANT_DATA skips the tenant hook that creates a "home" page.
  // Create one so /home works when tests hit tenant root (redirect to /home).
  await createTestTenantHomePage(tenant.id, name).catch(() => null)

  return tenant
}

/**
 * Create a minimal "home" page for a tenant so /home resolves (required when
 * PW_E2E_SKIP_DEFAULT_TENANT_DATA is set and the tenant hook doesn't run).
 */
async function createTestTenantHomePage(tenantId: number, tenantName: string): Promise<void> {
  const payload = await getPayloadInstance()
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'home' }, tenant: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) return

  const homePageData: Record<string, unknown> = {
    slug: 'home',
    title: `Welcome to ${tenantName}`,
    _status: 'published',
    tenant: tenantId,
    layout: [
      { blockType: 'heroScheduleSanctuary', blockName: 'Hero Schedule' },
    ],
  }
  await payload.create({
    collection: 'pages',
    data: homePageData,
    overrideAccess: true,
  })
}

/**
 * Create a test user
 * @param email - User email
 * @param password - User password
 * @param name - User name
 * @param roles - Better Auth `role` values (hasMany select; same as Payload `role` field)
 * @param registrationTenantId - Optional registration tenant ID
 */
export async function createTestUser(
  email: string,
  password: string = 'password',
  name: string = 'Test User',
  roles: string[] = ['user'],
  registrationTenantId?: string | number
): Promise<User> {
  const payload = await getPayloadInstance()

  const ensureCredentialAccount = async (userId: string | number) => {
    // Fetch hash/salt (hidden fields) so Better Auth can authenticate via `accounts`.
    const userWithSecrets = (await payload.findByID({
      collection: 'users',
      id: String(userId),
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    } as any)) as any

    if (!userWithSecrets?.hash || !userWithSecrets?.salt) return

    const passwordValue = `${userWithSecrets.salt}:${userWithSecrets.hash}`

    // Idempotent: ensure a credential account exists for the user.
    const existingAccounts = await payload.find({
      collection: 'accounts',
      where: {
        and: [
          { user: { equals: userId } },
          { providerId: { equals: 'credential' } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    if (existingAccounts?.docs?.[0]) return

    const baseData: Record<string, unknown> = {
      user: userId,
      accountId: String(userId),
      providerId: 'credential',
      password: passwordValue,
    }

    // Some versions/schemas require createdAt/updatedAt date fields on the Better Auth accounts model.
    // Try minimal payload first, then retry with timestamps if validation complains.
    try {
      await (payload as any).create({
        collection: 'accounts',
        data: baseData,
        overrideAccess: true,
      })
    } catch (err: any) {
      const message = String(err?.message || '')
      if (message.includes('updatedAt') || message.includes('createdAt')) {
        const now = new Date().toISOString()
        await (payload as any).create({
          collection: 'accounts',
          data: { ...baseData, createdAt: now, updatedAt: now },
          overrideAccess: true,
        })
        return
      }
      throw err
    }
  }

  // Tests are often re-run; make user creation idempotent by email.
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const existingUser = (existing?.docs?.[0] ?? null) as User | null
  if (existingUser) {
    await ensureCredentialAccount(existingUser.id)
    return existingUser
  }

  const createdUser = (await payload.create({
    collection: 'users',
    data: {
      name,
      email,
      password,
      role: roles,
      emailVerified: true,
      ...(registrationTenantId && { registrationTenant: registrationTenantId }),
    },
    draft: false,
    overrideAccess: true,
  } as Parameters<typeof payload.create>[0])) as User

  await ensureCredentialAccount(createdUser.id)
  return createdUser
}

/**
 * Create a test class option
 * @param tenantId - Tenant ID
 * @param name - Class option name
 * @param places - Number of places
 * @param description - Optional description
 * @param workerIndex - Optional worker index for additional isolation (default: 0)
 */
export async function createTestEventType(
  tenantId: string | number,
  name: string,
  places: number = 10,
  description?: string,
  workerIndex: number = 0
): Promise<EventType> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  // `event-types.name` is globally unique in this project.
  // Scope by tenant ID and worker index for parallel test isolation.
  const workerSuffix = workerIndex > 0 ? ` w${workerIndex}` : ''
  const scopedName = `${name} ${tenantIdNumber}${workerSuffix}`

  // Idempotent: if it already exists, reuse it.
  const existing = await payload.find({
    collection: 'event-types',
    where: { name: { equals: scopedName } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existingDoc = (existing?.docs?.[0] ?? null) as EventType | null
  if (existingDoc) return existingDoc

  return (await payload.create({
    collection: 'event-types',
    data: {
      name: scopedName,
      places,
      description: description || `Test class option: ${scopedName}`,
      tenant: tenantIdNumber,
    },
    overrideAccess: true,
  })) as EventType
}

/**
 * Create a test lesson
 * @param tenantId - Tenant ID
 * @param classOptionId - Class option ID
 * @param startTime - Timeslot start time
 * @param endTime - Timeslot end time
 * @param instructorId - Optional instructor ID
 * @param active - Whether lesson is active (default: true)
 */
export async function createTestTimeslot(
  tenantId: string | number,
  classOptionId: string | number,
  startTime: Date,
  endTime: Date,
  instructorId?: string | number,
  active: boolean = true,
  branchId?: number | null,
): Promise<Timeslot> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  const classOptionIdNumber = typeof classOptionId === 'string' ? Number(classOptionId) : classOptionId

  const tenantDoc = (await payload.findByID({
    collection: 'tenants',
    id: tenantIdNumber,
    depth: 0,
    overrideAccess: true,
  })) as Tenant | null
  const timeZone = resolveTimeZone(tenantDoc?.timeZone)
  // Timeslot validation combines sibling `date` with wall-clock times in tenant TZ; UTC YYYY-MM-DD can disagree.
  const date = formatInTimeZone(startTime, 'yyyy-MM-dd', timeZone)
  const resolvedBranchId =
    branchId === undefined
      ? await resolveDefaultBranchIdForTenant(tenantIdNumber)
      : branchId != null && Number.isFinite(branchId)
        ? branchId
        : null

  return (await payload.create({
    collection: 'timeslots',
    data: {
      tenant: tenantIdNumber,
      eventType: classOptionIdNumber,
      date,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      lockOutTime: 60, // Default: 60 minutes before lesson
      active,
      ...(resolvedBranchId != null ? { branch: resolvedBranchId } : {}),
      ...(instructorId && {
        staffMember: typeof instructorId === 'string' ? Number(instructorId) : instructorId,
      }),
    },
    draft: false,
    overrideAccess: true,
  })) as Timeslot
}

/**
 * Create a test booking
 * @param userId - User ID
 * @param lessonId - Timeslot ID
 * @param status - Booking status (default: 'pending')
 */
export async function createTestBooking(
  userId: string | number,
  lessonId: string | number,
  status: 'pending' | 'confirmed' | 'cancelled' | 'waiting' = 'pending'
): Promise<Booking> {
  const payload = await getPayloadInstance()

  // Get lesson to determine tenant
  const lesson = (await payload.findByID({
    collection: 'timeslots',
    id: typeof lessonId === 'string' ? lessonId : String(lessonId),
    overrideAccess: true,
  })) as Timeslot

  const userIdNumber = typeof userId === 'string' ? Number(userId) : userId
  const lessonIdNumber = typeof lessonId === 'string' ? Number(lessonId) : lessonId
  // Extract tenant ID from lesson.tenant (can be number, { id: number }, or null)
  const tenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null && 'id' in lesson.tenant
    ? lesson.tenant.id
    : typeof lesson.tenant === 'number'
      ? lesson.tenant
      : null

  return (await payload.create({
    collection: 'bookings',
    data: {
      user: userIdNumber,
      timeslot: lessonIdNumber,
      status,
      tenant: tenantId,
    },
    overrideAccess: true,
  })) as Booking
}

export async function updateTenantStripeConnect(
  tenantId: string | number,
  overrides?: {
    stripeConnectOnboardingStatus?: 'active' | 'not_connected'
    stripeConnectAccountId?: string | null
  }
): Promise<Tenant> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId

  const data: Record<string, unknown> = {
    stripeConnectOnboardingStatus:
      overrides?.stripeConnectOnboardingStatus ?? 'active',
  }
  if (overrides && 'stripeConnectAccountId' in overrides) {
    data.stripeConnectAccountId = overrides.stripeConnectAccountId
  } else {
    data.stripeConnectAccountId = `acct_test_${tenantIdNumber}`
  }

  return (await payload.update({
    collection: 'tenants',
    id: tenantIdNumber,
    data,
    overrideAccess: true,
  })) as Tenant
}

export async function createTestPlan(params: {
  tenantId: string | number
  name: string
  sessions: number
  allowMultipleBookingsPerTimeslot?: boolean
  stripeProductId?: string
  priceId?: string
}): Promise<Plan> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof params.tenantId === 'string' ? Number(params.tenantId) : params.tenantId

  return (await payload.create({
    collection: 'plans',
    data: {
      tenant: tenantIdNumber,
      name: params.name,
      status: 'active',
      skipSync: true,
      sessionsInformation: {
        sessions: params.sessions,
        interval: 'week',
        intervalCount: 1,
        allowMultipleBookingsPerTimeslot:
          params.allowMultipleBookingsPerTimeslot ?? false,
      },
      stripeProductId: params.stripeProductId ?? `prod_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      priceJSON: JSON.stringify({
        id: params.priceId ?? `price_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      }),
    },
    overrideAccess: true,
  })) as Plan
}

/**
 * Create a drop-in product and configure it as the allowed drop-in on an event type.
 * This makes `timeslotHasPaymentMethods` return true on the manage page, which is
 * required for the auto-cancel-pending-and-create-checkout-hold flow to run.
 *
 * @param tenantId - Tenant ID
 * @param eventTypeId - Event type ID to configure
 * @param name - Optional drop-in name (defaults to a unique value)
 * @returns The created drop-in document (with at least `id`)
 */
export async function createAndConfigureTestDropIn(
  tenantId: string | number,
  eventTypeId: string | number,
  name?: string,
): Promise<{ id: number }> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  const eventTypeIdNumber = typeof eventTypeId === 'string' ? Number(eventTypeId) : eventTypeId

  const dropIn = (await payload.create({
    collection: 'drop-ins',
    data: {
      name: name ?? `Test Drop-in ${tenantIdNumber}-${Date.now()}`,
      isActive: true,
      price: 10,
      adjustable: false,
      maxBookingsPerTimeslot: 2,
      tenant: tenantIdNumber,
    },
    overrideAccess: true,
  })) as { id: number }

  await payload.update({
    collection: 'event-types',
    id: eventTypeIdNumber,
    data: {
      paymentMethods: { allowedDropIn: dropIn.id },
    },
    overrideAccess: true,
  })

  return dropIn
}

export async function setEventTypeAllowedPlans(
  classOptionId: string | number,
  planIds: Array<string | number>
): Promise<EventType> {
  const payload = await getPayloadInstance()
  const classOptionIdNumber =
    typeof classOptionId === 'string' ? Number(classOptionId) : classOptionId

  return (await payload.update({
    collection: 'event-types',
    id: classOptionIdNumber,
    data: {
      paymentMethods: {
        allowedPlans: planIds.map((id) => (typeof id === 'string' ? Number(id) : id)),
      },
    },
    overrideAccess: true,
  })) as EventType
}

export async function createTestSubscription(params: {
  userId: string | number
  tenantId: string | number
  planId: string | number
  status?: Subscription['status']
  stripeSubscriptionId?: string | null
  stripeCustomerId?: string | null
  stripeAccountId?: string | null
  startDate?: Date
  endDate?: Date
}): Promise<Subscription> {
  const payload = await getPayloadInstance()
  const userIdNumber = typeof params.userId === 'string' ? Number(params.userId) : params.userId
  const tenantIdNumber = typeof params.tenantId === 'string' ? Number(params.tenantId) : params.tenantId
  const planIdNumber = typeof params.planId === 'string' ? Number(params.planId) : params.planId
  const startDate = params.startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const endDate = params.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return (await payload.create({
    collection: 'subscriptions',
    data: {
      user: userIdNumber,
      tenant: tenantIdNumber,
      plan: planIdNumber,
      status: params.status ?? 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      stripeCustomerId: params.stripeCustomerId ?? `cus_test_${userIdNumber}`,
      stripeAccountId: params.stripeAccountId ?? `acct_test_${tenantIdNumber}`,
    },
    overrideAccess: true,
  })) as Subscription
}

/**
 * Create a test page
 * @param tenantId - Tenant ID
 * @param slug - Page slug
 * @param title - Page title
 * @param opts - Optional `requireAuth` (CMS “Require sign-in”) and/or custom `layout`
 */
export async function createTestPage(
  tenantId: string | number,
  slug: string,
  title: string,
  opts?: {
    requireAuth?: boolean
    layout?: Record<string, unknown>[]
    meta?: Record<string, unknown>
  }
): Promise<any> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  const layout = opts?.layout ?? [{ blockType: 'content', columns: [] }]
  return await payload.create({
    collection: 'pages',
    data: {
      slug,
      title,
      tenant: tenantIdNumber,
      _status: 'published',
      ...(opts?.requireAuth === true ? { requireAuth: true } : {}),
      ...(opts?.meta ? { meta: opts.meta } : {}),
      layout,
    },
    draft: false,
    overrideAccess: true,
  })
}

/**
 * Clean up test data
 * @param tenantIds - Array of tenant IDs to delete
 * @param userIds - Array of user IDs to delete
 */
export async function cleanupTestData(
  tenantIds: (string | number)[] = [],
  userIds: (string | number)[] = []
): Promise<void> {
  const payload = await getPayloadInstance()

  try {
    // Delete users
    if (userIds.length > 0) {
      await payload.delete({
        collection: 'users',
        where: { id: { in: userIds } },
      })
    }

    // Delete tenants (this should cascade delete related data)
    if (tenantIds.length > 0) {
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: tenantIds } },
      })
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn('Error cleaning up test data:', error)
  }
}

/**
 * Setup test data for multi-tenant E2E tests
 * Creates test tenants, users, and default data
 * @param workerIndex - Optional worker index for parallel test isolation (default: 0)
 */
export async function setupE2ETestData(workerIndex: number = 0): Promise<{
  tenants: Tenant[]
  users: {
    superAdmin: User
    tenantAdmin1: User
    tenantAdmin2: User
    user1: User
    user2: User
    user3: User
    locationManager1: User
    userSingleBranch: User
  }
  /** Two active sites on `tenants[0]` for multi-branch E2E (US7-F2). */
  tenant1Locations: { north: { id: number; slug: string; name: string }; south: { id: number; slug: string; name: string } }
  /** One active site on `tenants[2]` for single-branch flows (US7-C3). */
  tenant3Location: { id: number; slug: string; name: string }
  workerIndex: number
}> {
  const payload = await getPayloadInstance()
  // IMPORTANT: Some environments validate `users.email` more strictly than RFC.
  // Avoid punctuation like `-` in the local-part to keep emails universally valid.
  const emailSuffix = workerIndex > 0 ? `w${workerIndex}` : ''
  const workerSuffix = workerIndex > 0 ? `-w${workerIndex}` : ''

  // Create test tenants with worker-scoped slugs AND names to prevent the
  // "find by name" fallback in createTestTenant from merging workers onto
  // the same tenant (which causes cross-worker location accumulation).
  const tenantLabel = workerIndex > 0 ? ` W${workerIndex}` : ''
  const tenant1 = await createTestTenant(`Test Tenant 1${tenantLabel}`, `test-tenant-1${workerSuffix}`)
  const tenant2 = await createTestTenant(`Test Tenant 2${tenantLabel}`, `test-tenant-2${workerSuffix}`)
  const tenant3 = await createTestTenant(`Test Tenant 3${tenantLabel}`, `test-tenant-3${workerSuffix}`)

  // Create super admin with worker-scoped email
  const superAdmin = await createTestUser(
    `admin${emailSuffix}@test.com`,
    'password',
    'Super Admin',
    ['super-admin']
  )

  // Create tenant-admin users with worker-scoped emails
  const tenantAdmin1 = await createTestUser(
    `tenantadmin1${emailSuffix}@test.com`,
    'password',
    'Tenant Admin 1',
    ['admin']
  )
  // Assign tenant-admin to tenant1 using consolidated tenants[n].roles structure
  await payload.update({
    collection: 'users',
    where: { email: { equals: tenantAdmin1.email } },
    data: {
      tenants: [{ tenant: tenant1.id, roles: ['admin'] }],
      registrationTenant: tenant1.id,
    } as Parameters<typeof payload.update>[0]['data'],
    overrideAccess: true,
  })

  const tenantAdmin2 = await createTestUser(
    `tenantadmin2${emailSuffix}@test.com`,
    'password',
    'Tenant Admin 2',
    ['admin']
  )
  // Assign tenant-admin to tenant2
  await payload.update({
    collection: 'users',
    where: { email: { equals: tenantAdmin2.email } },
    data: {
      tenants: [{ tenant: tenant2.id, roles: ['admin'] }],
      registrationTenant: tenant2.id,
    } as Parameters<typeof payload.update>[0]['data'],
    overrideAccess: true,
  })

  // Create regular users with worker-scoped emails
  const user1 = await createTestUser(
    `user1${emailSuffix}@test.com`,
    'password',
    'User 1',
    ['user'],
    tenant1.id
  )
  const user2 = await createTestUser(
    `user2${emailSuffix}@test.com`,
    'password',
    'User 2',
    ['user'],
    tenant2.id
  )
  const user3 = await createTestUser(
    `user3${emailSuffix}@test.com`,
    'password',
    'User 3',
    ['user']
  )

  const locSlugNorth = `e2e-mtl-north${workerSuffix}`
  const locSlugSouth = `e2e-mtl-south${workerSuffix}`
  const locSlugOnly = `e2e-mtl-only${workerSuffix}`

  const findOrCreateLocation = async (
    slug: string,
    tenantId: number,
    name: string,
  ): Promise<{ id: number; slug?: string; name?: string }> => {
    const existing = await payload.find({
      collection: 'locations',
      where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenantId } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs[0]) return existing.docs[0] as { id: number; slug?: string; name?: string }
    return (await payload.create({
      collection: 'locations',
      data: { name, slug, tenant: tenantId, active: true },
      overrideAccess: true,
    })) as { id: number; slug?: string; name?: string }
  }

  const branchNorth = await findOrCreateLocation(
    locSlugNorth,
    tenant1.id,
    `E2E Multi North${workerSuffix ? ` ${workerSuffix}` : ''}`,
  )

  const branchSouth = await findOrCreateLocation(
    locSlugSouth,
    tenant1.id,
    `E2E Multi South${workerSuffix ? ` ${workerSuffix}` : ''}`,
  )

  const tenant3OnlyLocation = await findOrCreateLocation(
    locSlugOnly,
    tenant3.id,
    `E2E Single Site${workerSuffix ? ` ${workerSuffix}` : ''}`,
  )

  // Deactivate any extra locations that don't belong to this worker's test run.
  // Previous runs with a different number of workers can leave stale active
  // locations on these tenants, causing the schedule to show a branch picker
  // when it should not (or to filter to the wrong branch).
  const workerTenant1LocationIds = [branchNorth.id, branchSouth.id]
  const workerTenant3LocationIds = [tenant3OnlyLocation.id]
  await Promise.all([
    payload.update({
      collection: 'locations',
      where: {
        and: [
          { tenant: { equals: tenant1.id } },
          { active: { equals: true } },
          { id: { not_in: workerTenant1LocationIds } },
        ],
      },
      data: { active: false },
      overrideAccess: true,
    }),
    payload.update({
      collection: 'locations',
      where: {
        and: [
          { tenant: { equals: tenant3.id } },
          { active: { equals: true } },
          { id: { not_in: workerTenant3LocationIds } },
        ],
      },
      data: { active: false },
      overrideAccess: true,
    }),
  ])

  const locationManager1 = (await createTestUser(
    `locmgr1${emailSuffix}@test.com`,
    'password',
    'E2E Site Manager',
    ['location-manager'],
    tenant1.id,
  )) as User

  await payload.update({
    collection: 'users',
    where: { email: { equals: locationManager1.email } },
    data: {
      tenants: [{ tenant: tenant1.id, roles: ['location-manager'] }],
      registrationTenant: tenant1.id,
      locations: [branchNorth.id],
    } as Parameters<typeof payload.update>[0]['data'],
    overrideAccess: true,
  })

  const userSingleBranch = (await createTestUser(
    `usersinglebranch${emailSuffix}@test.com`,
    'password',
    'Single Branch Customer',
    ['user'],
    tenant3.id,
  )) as User

  return {
    tenants: [tenant1, tenant2, tenant3],
    users: {
      superAdmin,
      tenantAdmin1,
      tenantAdmin2,
      user1,
      user2,
      user3,
      locationManager1,
      userSingleBranch,
    },
    tenant1Locations: {
      north: {
        id: branchNorth.id,
        slug: branchNorth.slug ?? locSlugNorth,
        name: branchNorth.name ?? `E2E Multi North${workerSuffix ? ` ${workerSuffix}` : ''}`,
      },
      south: {
        id: branchSouth.id,
        slug: branchSouth.slug ?? locSlugSouth,
        name: branchSouth.name ?? `E2E Multi South${workerSuffix ? ` ${workerSuffix}` : ''}`,
      },
    },
    tenant3Location: {
      id: tenant3OnlyLocation.id,
      slug: tenant3OnlyLocation.slug ?? locSlugOnly,
      name: tenant3OnlyLocation.name ?? `E2E Single Site${workerSuffix ? ` ${workerSuffix}` : ''}`,
    },
    workerIndex,
  }
}
