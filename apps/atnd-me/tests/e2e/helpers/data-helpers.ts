import { getPayload, type Payload } from 'payload'
import config from '../../../src/payload.config'
import type { Tenant, User, Lesson, ClassOption, Booking, Plan, Subscription } from '@repo/shared-types'

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
      { blockType: 'heroSchedule', blockName: 'Hero Schedule', title: tenantName },
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
 * @param roles - User roles
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
      roles,
      // Sync role field for Better Auth compatibility (Better Auth uses 'role', rolesPlugin uses 'roles')
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
export async function createTestClassOption(
  tenantId: string | number,
  name: string,
  places: number = 10,
  description?: string,
  workerIndex: number = 0
): Promise<ClassOption> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  // `class-options.name` is globally unique in this project.
  // Scope by tenant ID and worker index for parallel test isolation.
  const workerSuffix = workerIndex > 0 ? ` w${workerIndex}` : ''
  const scopedName = `${name} ${tenantIdNumber}${workerSuffix}`

  // Idempotent: if it already exists, reuse it.
  const existing = await payload.find({
    collection: 'class-options',
    where: { name: { equals: scopedName } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existingDoc = (existing?.docs?.[0] ?? null) as ClassOption | null
  if (existingDoc) return existingDoc

  return (await payload.create({
    collection: 'class-options',
    data: {
      name: scopedName,
      places,
      description: description || `Test class option: ${scopedName}`,
      tenant: tenantIdNumber,
    },
    overrideAccess: true,
  })) as ClassOption
}

/**
 * Create a test lesson
 * @param tenantId - Tenant ID
 * @param classOptionId - Class option ID
 * @param startTime - Lesson start time
 * @param endTime - Lesson end time
 * @param instructorId - Optional instructor ID
 * @param active - Whether lesson is active (default: true)
 */
export async function createTestLesson(
  tenantId: string | number,
  classOptionId: string | number,
  startTime: Date,
  endTime: Date,
  instructorId?: string | number,
  active: boolean = true
): Promise<Lesson> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  const classOptionIdNumber = typeof classOptionId === 'string' ? Number(classOptionId) : classOptionId
  // Extract date from startTime (YYYY-MM-DD format)
  const date = startTime.toISOString().split('T')[0] as string

  return (await payload.create({
    collection: 'lessons',
    data: {
      tenant: tenantIdNumber,
      classOption: classOptionIdNumber,
      date,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      lockOutTime: 60, // Default: 60 minutes before lesson
      active,
      ...(instructorId && { instructor: typeof instructorId === 'string' ? Number(instructorId) : instructorId }),
    },
    draft: false,
    overrideAccess: true,
  })) as Lesson
}

/**
 * Create a test booking
 * @param userId - User ID
 * @param lessonId - Lesson ID
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
    collection: 'lessons',
    id: typeof lessonId === 'string' ? lessonId : String(lessonId),
    overrideAccess: true,
  })) as Lesson

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
      lesson: lessonIdNumber,
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

  return (await payload.update({
    collection: 'tenants',
    id: tenantIdNumber,
    data: {
      stripeConnectOnboardingStatus:
        overrides?.stripeConnectOnboardingStatus ?? 'active',
      stripeConnectAccountId:
        overrides?.stripeConnectAccountId ?? `acct_test_${tenantIdNumber}`,
    },
    overrideAccess: true,
  })) as Tenant
}

export async function createTestPlan(params: {
  tenantId: string | number
  name: string
  sessions: number
  allowMultipleBookingsPerLesson?: boolean
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
      sessionsInformation: {
        sessions: params.sessions,
        interval: 'week',
        intervalCount: 1,
        allowMultipleBookingsPerLesson:
          params.allowMultipleBookingsPerLesson ?? false,
      },
      stripeProductId: params.stripeProductId ?? `prod_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      priceJSON: JSON.stringify({
        id: params.priceId ?? `price_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      }),
    },
    overrideAccess: true,
  })) as Plan
}

export async function setClassOptionAllowedPlans(
  classOptionId: string | number,
  planIds: Array<string | number>
): Promise<ClassOption> {
  const payload = await getPayloadInstance()
  const classOptionIdNumber =
    typeof classOptionId === 'string' ? Number(classOptionId) : classOptionId

  return (await payload.update({
    collection: 'class-options',
    id: classOptionIdNumber,
    data: {
      paymentMethods: {
        allowedPlans: planIds.map((id) => (typeof id === 'string' ? Number(id) : id)),
      },
    },
    overrideAccess: true,
  })) as ClassOption
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
 */
export async function createTestPage(
  tenantId: string | number,
  slug: string,
  title: string
): Promise<any> {
  const payload = await getPayloadInstance()
  const tenantIdNumber = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  return await payload.create({
    collection: 'pages',
    data: {
      slug,
      title,
      tenant: tenantIdNumber,
      _status: 'published',
      // Pages.layout is required; provide a minimal valid block.
      layout: [{ blockType: 'content', columns: [] }],
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
  }
  workerIndex: number
}> {
  const payload = await getPayloadInstance()
  // IMPORTANT: Some environments validate `users.email` more strictly than RFC.
  // Avoid punctuation like `-` in the local-part to keep emails universally valid.
  const emailSuffix = workerIndex > 0 ? `w${workerIndex}` : ''
  const workerSuffix = workerIndex > 0 ? `-w${workerIndex}` : ''

  // Create test tenants with worker-scoped slugs
  const tenant1 = await createTestTenant('Test Tenant 1', `test-tenant-1${workerSuffix}`)
  const tenant2 = await createTestTenant('Test Tenant 2', `test-tenant-2${workerSuffix}`)
  const tenant3 = await createTestTenant('Test Tenant 3', `test-tenant-3${workerSuffix}`)

  // Create super admin with worker-scoped email
  const superAdmin = await createTestUser(
    `admin${emailSuffix}@test.com`,
    'password',
    'Super Admin',
    ['admin']
  )

  // Create tenant-admin users with worker-scoped emails
  const tenantAdmin1 = await createTestUser(
    `tenantadmin1${emailSuffix}@test.com`,
    'password',
    'Tenant Admin 1',
    ['tenant-admin']
  )
  // Assign tenant-admin to tenant1 (tenants array + registrationTenant so status API can resolve tenant)
  await payload.update({
    collection: 'users',
    where: { email: { equals: tenantAdmin1.email } },
    data: {
      tenants: [{ tenant: tenant1.id }],
      registrationTenant: tenant1.id,
    },
    overrideAccess: true,
  })

  const tenantAdmin2 = await createTestUser(
    `tenantadmin2${emailSuffix}@test.com`,
    'password',
    'Tenant Admin 2',
    ['tenant-admin']
  )
  // Assign tenant-admin to tenant2
  await payload.update({
    collection: 'users',
    where: { email: { equals: tenantAdmin2.email } },
    data: {
      tenants: [{ tenant: tenant2.id }],
      registrationTenant: tenant2.id,
    },
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
  return {
    tenants: [tenant1, tenant2, tenant3],
    users: {
      superAdmin,
      tenantAdmin1,
      tenantAdmin2,
      user1,
      user2,
      user3,
    },
    workerIndex,
  }
}
