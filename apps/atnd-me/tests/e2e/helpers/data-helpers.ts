import type { Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant, User, Lesson, ClassOption, Booking } from '@repo/shared-types'

/**
 * Helper functions for creating test data via Payload API
 * These functions use Payload directly (not via HTTP) for faster test setup
 */

let payloadInstance: Payload | null = null

/**
 * Get or create Payload instance for test data creation
 */
async function getPayloadInstance(): Promise<Payload> {
  if (!payloadInstance) {
    const payloadConfig = await config
    payloadInstance = await getPayload({ config: payloadConfig })
  }
  return payloadInstance
}

/**
 * Create a test tenant
 * @param name - Tenant name
 * @param slug - Tenant slug (subdomain)
 * @param domain - Optional domain
 */
export async function createTestTenant(
  name: string,
  slug: string,
  domain?: string
): Promise<Tenant> {
  const payload = await getPayloadInstance()
  // Tests are often re-run against a non-empty DB; make tenant creation idempotent.
  const existing = await payload.find({
    collection: 'tenants',
    where: {
      slug: { equals: slug },
    },
    limit: 1,
    overrideAccess: true,
  })

  const existingTenant = (existing?.docs?.[0] ?? null) as Tenant | null
  if (existingTenant) return existingTenant

  return (await payload.create({
    collection: 'tenants',
    data: {
      name,
      slug,
      ...(domain && { domain }),
    },
    overrideAccess: true,
  })) as Tenant
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
      hero: {
        type: 'none',
      },
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
  // Assign tenant-admin to tenant1
  await payload.update({
    collection: 'users',
    where: { email: { equals: tenantAdmin1.email } },
    data: {
      tenants: [{ tenant: tenant1.id }],
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
