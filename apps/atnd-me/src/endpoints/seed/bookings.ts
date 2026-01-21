import type { Payload, PayloadRequest } from 'payload'
import type { User, Lesson, ClassOption, Booking, Instructor } from '@repo/shared-types'
import type { Tenant } from '@/payload-types'

/**
 * Seeds booking-related data for manual testing with multi-tenant support
 * Creates:
 * - Test tenants (2 tenants for testing isolation)
 * - Test users (admin, tenant-admin, and regular users)
 * - Instructors (scoped to tenants)
 * - Class options (scoped to tenants)
 * - Lessons (various states: active, fully booked, upcoming, past) - scoped to tenants
 * - Bookings (various states: confirmed, pending, cancelled, waiting) - scoped to tenants
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
  instructors: Instructor[]
  classOptions: ClassOption[]
  lessons: Lesson[]
  bookings: Booking[]
}> {
  payload.logger.info('— Seeding booking data with multi-tenant support...')

  // Clear existing booking data in order to respect foreign key constraints
  // Order: bookings -> lessons -> class-options -> instructors -> tenants
  payload.logger.info('  Clearing existing booking data...')
  try {
    await payload.db.deleteMany({ collection: 'bookings', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete bookings: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  
  try {
    await payload.db.deleteMany({ collection: 'lessons', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete lessons: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  
  try {
    await payload.db.deleteMany({ collection: 'class-options', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete class-options: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
  
  try {
    await payload.db.deleteMany({ collection: 'instructors', req, where: {} })
  } catch (e) {
    payload.logger.warn(`  Could not delete instructors: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // Note: We don't delete existing tenants here because they may have foreign key constraints
  // Instead, we'll update them if they exist (see tenant creation below)
  payload.logger.info('  Checking for existing test tenants...')

  // Delete existing test users if they exist (to avoid email conflicts)
  payload.logger.info('  Cleaning up existing test users...')
  const testUserEmails = ['admin@test.com', 'user1@test.com', 'user2@test.com', 'user3@test.com', 'tenant-admin@test.com']
  for (const email of testUserEmails) {
    try {
      const existingUsers = await payload.find({
        collection: 'users',
        where: {
          email: {
            equals: email.toLowerCase(),
          },
        },
        limit: 1,
        overrideAccess: true,
      })
      
      const existingUser = existingUsers.docs[0]
      if (existingUser) {
        await payload.delete({
          collection: 'users',
          id: existingUser.id,
          overrideAccess: true,
        })
      }
    } catch (e) {
      // Ignore errors if user doesn't exist or deletion fails
      payload.logger.warn(`  Could not delete user ${email}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  // Create or update test tenants (use upsert pattern to handle existing tenants)
  payload.logger.info('  Creating test tenants...')
  const tenant1Data = {
    name: 'Demo Tenant 1',
    slug: 'demo-tenant-1',
    description: 'First demo tenant for testing multi-tenant functionality',
  }
  const tenant2Data = {
    name: 'Demo Tenant 2',
    slug: 'demo-tenant-2',
    description: 'Second demo tenant for testing tenant isolation',
  }

  // Find existing tenants by slug
  const existingTenant1 = await payload.find({
    collection: 'tenants',
    where: {
      slug: {
        equals: tenant1Data.slug,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

  const existingTenant2 = await payload.find({
    collection: 'tenants',
    where: {
      slug: {
        equals: tenant2Data.slug,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

  // Create or update tenants
  const tenants = await Promise.all([
    existingTenant1.docs[0]
      ? payload.update({
          collection: 'tenants',
          id: existingTenant1.docs[0].id,
          data: tenant1Data,
          overrideAccess: true,
        })
      : payload.create({
          collection: 'tenants',
          data: tenant1Data,
          overrideAccess: true,
        }),
    existingTenant2.docs[0]
      ? payload.update({
          collection: 'tenants',
          id: existingTenant2.docs[0].id,
          data: tenant2Data,
          overrideAccess: true,
        })
      : payload.create({
          collection: 'tenants',
          data: tenant2Data,
          overrideAccess: true,
        }),
  ])

  const tenant1 = tenants[0] as Tenant
  const tenant2 = tenants[1] as Tenant

  // Helper function to create tenant-scoped documents with tenant context
  const createWithTenant = async <T = any>(
    collection: string,
    data: any,
    tenantId: number | string,
    options?: Omit<Parameters<typeof payload.create>[0], 'collection' | 'data' | 'req'>
  ): Promise<T> => {
    const tenantReq = {
      ...req,
      context: { ...req.context, tenant: tenantId },
    }
    // Explicitly set tenant in data as well (multi-tenant plugin may need it)
    const dataWithTenant = {
      ...data,
      tenant: tenantId,
    }
    return payload.create({
      collection,
      data: dataWithTenant,
      req: tenantReq,
      ...options,
    } as Parameters<typeof payload.create>[0]) as Promise<T>
  }

  // Create or update test users
  payload.logger.info('  Creating test users...')
  const testUserData = [
    { name: 'Admin User', email: 'admin@test.com', role: 'admin' as const, roles: ['admin'] as ('admin' | 'user' | 'tenant-admin')[] },
    { name: 'Test User 1', email: 'user1@test.com', role: 'user' as const, roles: ['user'] as ('admin' | 'user' | 'tenant-admin')[] },
    { name: 'Test User 2', email: 'user2@test.com', role: 'user' as const, roles: ['user'] as ('admin' | 'user' | 'tenant-admin')[] },
    { name: 'Test User 3', email: 'user3@test.com', role: 'user' as const, roles: ['user'] as ('admin' | 'user' | 'tenant-admin')[] },
  ]

  const testUsers = await Promise.all(
    testUserData.map(async (userData) => {
      // Check if user already exists
      const existingUser = await payload.find({
        collection: 'users',
        where: {
          email: {
            equals: userData.email.toLowerCase(),
          },
        },
        limit: 1,
        overrideAccess: true,
      })

      const userPayload = {
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: 'password',
        emailVerified: true,
        role: userData.role,
        roles: userData.roles,
      }

      return existingUser.docs[0]
        ? await payload.update({
            collection: 'users',
            id: existingUser.docs[0].id,
            data: userPayload,
            draft: false,
            overrideAccess: true,
          })
        : await payload.create({
            collection: 'users',
            data: userPayload,
            draft: false,
            overrideAccess: true,
          })
    })
  )

  // Create or update tenant-admin user for tenant1
  payload.logger.info('  Creating tenant-admin user...')
  const tenantAdminEmail = 'tenant-admin@test.com'.toLowerCase()
  
  // Check if tenant-admin user already exists
  const existingTenantAdmin = await payload.find({
    collection: 'users',
    where: {
      email: {
        equals: tenantAdminEmail,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

      const tenantAdminData = {
        name: 'Tenant Admin',
        email: tenantAdminEmail,
        password: 'password',
        emailVerified: true,
        role: 'tenant-admin' as const,
        roles: ['tenant-admin'] as ('admin' | 'user' | 'tenant-admin')[],
        // Assign tenant-admin to tenant1
        tenants: [{ tenant: tenant1.id }],
      }

  const tenantAdminUser = existingTenantAdmin.docs[0]
    ? await payload.update({
        collection: 'users',
        id: existingTenantAdmin.docs[0].id,
        data: tenantAdminData as any,
        draft: false,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'users',
        data: tenantAdminData,
        draft: false,
        overrideAccess: true,
      })

  // Create instructor users first
  payload.logger.info('  Creating instructor users...')
  const instructorUserEmails = ['john@instructor.com', 'jane@instructor.com']
  
  // Delete existing instructor users if they exist
  const allInstructorEmails = [...instructorUserEmails, 'tenant2@instructor.com']
  for (const email of allInstructorEmails) {
    try {
      const existingUsers = await payload.find({
        collection: 'users',
        where: {
          email: {
            equals: email.toLowerCase(),
          },
        },
        limit: 1,
        overrideAccess: true,
      })
      
      const existingUser = existingUsers.docs[0]
      if (existingUser) {
        await payload.delete({
          collection: 'users',
          id: existingUser.id,
          overrideAccess: true,
        })
      }
    } catch (_e) {
      // Ignore errors
    }
  }

  const instructorUsers = await Promise.all([
    payload.create({
      collection: 'users',
      data: {
        name: 'John Instructor',
        email: 'john@instructor.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        role: 'user' as const,
        roles: ['user'] as ('admin' | 'user' | 'tenant-admin')[],
      },
      draft: false,
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: {
        name: 'Jane Instructor',
        email: 'jane@instructor.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        role: 'user' as const,
        roles: ['user'] as ('admin' | 'user' | 'tenant-admin')[],
      },
      draft: false,
      overrideAccess: true,
    }),
  ])

  // Create instructors (they require a user relationship) - scoped to tenant1
  payload.logger.info('  Creating instructors for tenant1...')
  const instructor1User = instructorUsers[0]
  const instructor1UserId = instructor1User && typeof instructor1User === 'object' && 'id' in instructor1User 
    ? instructor1User.id 
    : instructor1User
  const instructor2User = instructorUsers[1]
  const instructor2UserId = instructor2User && typeof instructor2User === 'object' && 'id' in instructor2User 
    ? instructor2User.id 
    : instructor2User
  
  if (!instructor1UserId) throw new Error('Instructor 1 user not found')
  if (!instructor2UserId) throw new Error('Instructor 2 user not found')
  
  const instructors = await Promise.all([
    createWithTenant(
      'instructors',
      {
        user: instructor1UserId,
        active: true,
      },
      tenant1.id,
      { overrideAccess: true }
    ),
    createWithTenant(
      'instructors',
      {
        user: instructor2UserId,
        active: true,
      },
      tenant1.id,
      { overrideAccess: true }
    ),
  ])

  // Create instructors for tenant2 as well (for testing isolation)
  // Note: We need a separate instructor user since instructors have a unique constraint on user
  payload.logger.info('  Creating instructor user for tenant2...')
  const tenant2InstructorEmail = 'tenant2@instructor.com'.toLowerCase()
  
  // Check if tenant2 instructor user already exists
  const existingTenant2Instructor = await payload.find({
    collection: 'users',
    where: {
      email: {
        equals: tenant2InstructorEmail,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

      const tenant2InstructorData = {
        name: 'Tenant2 Instructor',
        email: tenant2InstructorEmail,
        password: 'password',
        emailVerified: true,
        role: 'user' as const,
        roles: ['user'] as ('admin' | 'user' | 'tenant-admin')[],
      }

  const tenant2InstructorUser = existingTenant2Instructor.docs[0]
    ? await payload.update({
        collection: 'users',
        id: existingTenant2Instructor.docs[0].id,
        data: tenant2InstructorData,
        draft: false,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'users',
        data: tenant2InstructorData,
        draft: false,
        overrideAccess: true,
      })

  payload.logger.info('  Creating instructors for tenant2...')
  const tenant2InstructorUserId = tenant2InstructorUser && typeof tenant2InstructorUser === 'object' && 'id' in tenant2InstructorUser 
    ? tenant2InstructorUser.id 
    : tenant2InstructorUser
  if (!tenant2InstructorUserId) throw new Error('Tenant2 instructor user not found')
  
  const tenant2Instructors = await Promise.all([
    createWithTenant(
      'instructors',
      {
        user: tenant2InstructorUserId,
        active: true,
      },
      tenant2.id,
      { overrideAccess: true }
    ),
  ])

  // Create class options - scoped to tenant1
  payload.logger.info('  Creating class options for tenant1...')
  const classOptions = await Promise.all([
    createWithTenant(
      'class-options',
      {
        name: 'Yoga Class',
        places: 10,
        description: 'A relaxing yoga class for all levels',
      },
      tenant1.id,
      { draft: false, overrideAccess: true }
    ),
    createWithTenant(
      'class-options',
      {
        name: 'Fitness Class',
        places: 15,
        description: 'High-intensity fitness training',
      },
      tenant1.id,
      { draft: false, overrideAccess: true }
    ),
    createWithTenant(
      'class-options',
      {
        name: 'Small Group Class',
        places: 5,
        description: 'Intimate small group session',
      },
      tenant1.id,
      { draft: false, overrideAccess: true }
    ),
  ])

  // Create lessons with various states
  payload.logger.info('  Creating lessons...')
  const now = new Date()
  const lessons: Lesson[] = []

  // Extract IDs from class options and instructors
  const classOption0 = classOptions[0]
  const classOption0Id = classOption0 && typeof classOption0 === 'object' && 'id' in classOption0 ? classOption0.id : classOption0
  const classOption1 = classOptions[1]
  const classOption1Id = classOption1 && typeof classOption1 === 'object' && 'id' in classOption1 ? classOption1.id : classOption1
  const classOption2 = classOptions[2]
  const classOption2Id = classOption2 && typeof classOption2 === 'object' && 'id' in classOption2 ? classOption2.id : classOption2
  
  const instructor0 = instructors[0]
  const instructor0Id = instructor0 && typeof instructor0 === 'object' && 'id' in instructor0 ? instructor0.id : instructor0
  const instructor1 = instructors[1]
  const instructor1Id = instructor1 && typeof instructor1 === 'object' && 'id' in instructor1 ? instructor1.id : instructor1
  
  if (!classOption0Id || !classOption1Id || !classOption2Id) throw new Error('Class options not found')
  if (!instructor0Id || !instructor1Id) throw new Error('Instructors not found')

  // Past lesson (for history)
  const pastLessonDate = new Date(now)
  pastLessonDate.setDate(pastLessonDate.getDate() - 2)
  pastLessonDate.setHours(10, 0, 0, 0)
  const pastLessonEnd = new Date(pastLessonDate)
  pastLessonEnd.setHours(11, 0, 0, 0)

  const pastLesson = await createWithTenant(
    'lessons',
    {
      date: pastLessonDate.toISOString(),
      startTime: pastLessonDate.toISOString(),
      endTime: pastLessonEnd.toISOString(),
      classOption: classOption0Id,
      location: 'Studio A',
      instructor: instructor0Id,
      active: true,
      lockOutTime: 30,
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(pastLesson as Lesson)

  // Active lesson (available for booking)
  const activeLessonDate = new Date(now)
  activeLessonDate.setDate(activeLessonDate.getDate() + 1)
  activeLessonDate.setHours(14, 0, 0, 0)
  const activeLessonEnd = new Date(activeLessonDate)
  activeLessonEnd.setHours(15, 0, 0, 0)

  const activeLesson = await createWithTenant(
    'lessons',
    {
      date: activeLessonDate.toISOString(),
      startTime: activeLessonDate.toISOString(),
      endTime: activeLessonEnd.toISOString(),
      classOption: classOption0Id,
      location: 'Studio A',
      instructor: instructor0Id,
      active: true,
      lockOutTime: 30,
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(activeLesson as Lesson)

  // Lesson with some bookings (partially booked)
  const partiallyBookedDate = new Date(now)
  partiallyBookedDate.setDate(partiallyBookedDate.getDate() + 2)
  partiallyBookedDate.setHours(16, 0, 0, 0)
  const partiallyBookedEnd = new Date(partiallyBookedDate)
  partiallyBookedEnd.setHours(17, 0, 0, 0)

  const partiallyBookedLesson = await createWithTenant(
    'lessons',
    {
      date: partiallyBookedDate.toISOString(),
      startTime: partiallyBookedDate.toISOString(),
      endTime: partiallyBookedEnd.toISOString(),
      classOption: classOption1Id,
      location: 'Studio B',
      instructor: instructor1Id,
      active: true,
      lockOutTime: 30,
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(partiallyBookedLesson as Lesson)

  // Fully booked lesson
  const fullyBookedDate = new Date(now)
  fullyBookedDate.setDate(fullyBookedDate.getDate() + 3)
  fullyBookedDate.setHours(10, 0, 0, 0)
  const fullyBookedEnd = new Date(fullyBookedDate)
  fullyBookedEnd.setHours(11, 0, 0, 0)

  const fullyBookedLesson = await createWithTenant(
    'lessons',
    {
      date: fullyBookedDate.toISOString(),
      startTime: fullyBookedDate.toISOString(),
      endTime: fullyBookedEnd.toISOString(),
      classOption: classOption2Id, // Small group (5 places)
      location: 'Studio C',
      instructor: instructor0Id,
      active: true,
      lockOutTime: 30,
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(fullyBookedLesson as Lesson)

  // Upcoming lesson (for future booking)
  const upcomingDate = new Date(now)
  upcomingDate.setDate(upcomingDate.getDate() + 5)
  upcomingDate.setHours(18, 0, 0, 0)
  const upcomingEnd = new Date(upcomingDate)
  upcomingEnd.setHours(19, 0, 0, 0)

  const upcomingLesson = await createWithTenant(
    'lessons',
    {
      date: upcomingDate.toISOString(),
      startTime: upcomingDate.toISOString(),
      endTime: upcomingEnd.toISOString(),
      classOption: classOption0Id,
      location: 'Studio A',
      instructor: instructor1Id,
      active: true,
      lockOutTime: 30,
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(upcomingLesson as Lesson)

  // Lesson for managing bookings (user has multiple bookings)
  const manageBookingsDate = new Date(now)
  manageBookingsDate.setDate(manageBookingsDate.getDate() + 4)
  manageBookingsDate.setHours(12, 0, 0, 0)
  const manageBookingsEnd = new Date(manageBookingsDate)
  manageBookingsEnd.setHours(13, 0, 0, 0)

  const manageBookingsLesson = await createWithTenant(
    'lessons',
    {
      date: manageBookingsDate.toISOString(),
      startTime: manageBookingsDate.toISOString(),
      endTime: manageBookingsEnd.toISOString(),
      classOption: classOption1Id,
      location: 'Studio B',
      instructor: instructor0Id,
      active: true,
      lockOutTime: 30,
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(manageBookingsLesson as Lesson)

  // Create a lesson for tenant2 to test tenant isolation
  payload.logger.info('  Creating lesson for tenant2 (to test isolation)...')
  const tenant2ClassOption = await createWithTenant(
    'class-options',
    {
      name: 'Tenant 2 Class',
      places: 10,
      description: 'Class option for tenant 2',
    },
    tenant2.id,
    { draft: false, overrideAccess: true }
  )

  const tenant2LessonDate = new Date(now)
  tenant2LessonDate.setDate(tenant2LessonDate.getDate() + 1)
  tenant2LessonDate.setHours(10, 0, 0, 0)
  const tenant2LessonEnd = new Date(tenant2LessonDate)
  tenant2LessonEnd.setHours(11, 0, 0, 0)

  const tenant2ClassOptionId = tenant2ClassOption && typeof tenant2ClassOption === 'object' && 'id' in tenant2ClassOption 
    ? tenant2ClassOption.id 
    : tenant2ClassOption
  const tenant2Instructor0 = tenant2Instructors[0]
  const tenant2Instructor0Id = tenant2Instructor0 && typeof tenant2Instructor0 === 'object' && 'id' in tenant2Instructor0 
    ? tenant2Instructor0.id 
    : tenant2Instructor0
  
  if (!tenant2ClassOptionId) throw new Error('Tenant2 class option not found')
  if (!tenant2Instructor0Id) throw new Error('Tenant2 instructor not found')

  const tenant2Lesson = await createWithTenant(
    'lessons',
    {
      date: tenant2LessonDate.toISOString(),
      startTime: tenant2LessonDate.toISOString(),
      endTime: tenant2LessonEnd.toISOString(),
      classOption: tenant2ClassOptionId,
      location: 'Tenant 2 Studio',
      instructor: tenant2Instructor0Id,
      active: true,
      lockOutTime: 30,
    },
    tenant2.id,
    { draft: false, overrideAccess: true }
  )
  lessons.push(tenant2Lesson as Lesson)

  // Create bookings - scoped to tenant1 (bookings inherit tenant from lesson)
  payload.logger.info('  Creating bookings for tenant1...')
  const bookings: Booking[] = []

  // Past lesson booking (completed)
  const user1 = testUsers[1]
  const user1Id = user1 && typeof user1 === 'object' && 'id' in user1 ? user1.id : user1
  const user2 = testUsers[2]
  const user2Id = user2 && typeof user2 === 'object' && 'id' in user2 ? user2.id : user2
  const user3 = testUsers[3]
  const user3Id = user3 && typeof user3 === 'object' && 'id' in user3 ? user3.id : user3

  if (!user1Id) throw new Error('User 1 not found')
  if (!user2Id) throw new Error('User 2 not found')
  if (!user3Id) throw new Error('User 3 not found')

  // Extract lesson IDs
  const pastLessonId = pastLesson && typeof pastLesson === 'object' && 'id' in pastLesson ? pastLesson.id : pastLesson
  const activeLessonId = activeLesson && typeof activeLesson === 'object' && 'id' in activeLesson ? activeLesson.id : activeLesson
  const partiallyBookedLessonId = partiallyBookedLesson && typeof partiallyBookedLesson === 'object' && 'id' in partiallyBookedLesson ? partiallyBookedLesson.id : partiallyBookedLesson
  const fullyBookedLessonId = fullyBookedLesson && typeof fullyBookedLesson === 'object' && 'id' in fullyBookedLesson ? fullyBookedLesson.id : fullyBookedLesson
  const upcomingLessonId = upcomingLesson && typeof upcomingLesson === 'object' && 'id' in upcomingLesson ? upcomingLesson.id : upcomingLesson
  const manageBookingsLessonId = manageBookingsLesson && typeof manageBookingsLesson === 'object' && 'id' in manageBookingsLesson ? manageBookingsLesson.id : manageBookingsLesson
  
  if (!pastLessonId || !activeLessonId || !partiallyBookedLessonId || !fullyBookedLessonId || !upcomingLessonId || !manageBookingsLessonId) {
    throw new Error('One or more lessons not found')
  }

  const pastBooking = await createWithTenant(
    'bookings',
    {
      user: user1Id,
      lesson: pastLessonId,
      status: 'confirmed',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(pastBooking as Booking)

  // Active lesson bookings (user1 has 1 booking, user2 has 2 bookings)
  const activeBooking1 = await createWithTenant(
    'bookings',
    {
      user: user1Id,
      lesson: activeLessonId,
      status: 'confirmed',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(activeBooking1 as Booking)

  const activeBooking2 = await createWithTenant(
    'bookings',
    {
      user: user2Id,
      lesson: activeLessonId,
      status: 'confirmed',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(activeBooking2 as Booking)

  const activeBooking3 = await createWithTenant(
    'bookings',
    {
      user: user2Id,
      lesson: activeLessonId,
      status: 'confirmed',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(activeBooking3 as Booking)

  // Partially booked lesson (some bookings)
  for (let i = 0; i < 3; i++) {
    const user = testUsers[i + 1]
    if (!user) continue
    const userId = typeof user === 'object' && 'id' in user ? user.id : user
    if (!userId) continue
    const booking = await createWithTenant(
      'bookings',
      {
        user: userId,
        lesson: partiallyBookedLessonId,
        status: 'confirmed',
      },
      tenant1.id,
      { draft: false, overrideAccess: true }
    )
    bookings.push(booking as Booking)
  }

  // Fully booked lesson (all 5 places taken)
  for (let i = 0; i < 5; i++) {
    const user = testUsers[(i % 3) + 1]
    if (!user) continue
    const userId = typeof user === 'object' && 'id' in user ? user.id : user
    if (!userId) continue
    const booking = await createWithTenant(
      'bookings',
      {
        user: userId,
        lesson: fullyBookedLessonId,
        status: 'confirmed',
      },
      tenant1.id,
      { draft: false, overrideAccess: true }
    )
    bookings.push(booking as Booking)
  }

  // Manage bookings lesson (user1 has 3 bookings for this lesson)
  for (let i = 0; i < 3; i++) {
    const booking = await createWithTenant(
      'bookings',
      {
        user: user1Id,
        lesson: manageBookingsLessonId,
        status: 'confirmed',
      },
      tenant1.id,
      { draft: false, overrideAccess: true }
    )
    bookings.push(booking as Booking)
  }

  // Pending booking (for payment flow testing)
  const pendingBooking = await createWithTenant(
    'bookings',
    {
      user: user1Id,
      lesson: upcomingLessonId,
      status: 'pending',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(pendingBooking as Booking)

  // Cancelled booking
  const cancelledBooking = await createWithTenant(
    'bookings',
    {
      user: user2Id,
      lesson: upcomingLessonId,
      status: 'cancelled',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(cancelledBooking as Booking)

  // Waiting list booking
  const waitingBooking = await createWithTenant(
    'bookings',
    {
      user: user3Id,
      lesson: fullyBookedLessonId,
      status: 'waiting',
    },
    tenant1.id,
    { draft: false, overrideAccess: true }
  )
  bookings.push(waitingBooking as Booking)

  payload.logger.info('  Booking data seeded successfully!')
  payload.logger.info(`  Created: ${tenants.length} tenants, ${testUsers.length + 1} users (including tenant-admin), ${instructors.length + tenant2Instructors.length} instructors, ${classOptions.length + 1} class options, ${lessons.length} lessons, ${bookings.length} bookings`)

  return {
    tenants: tenants as Tenant[],
    users: [...testUsers, tenantAdminUser] as User[],
    instructors: [...instructors, ...tenant2Instructors] as Instructor[],
    classOptions: [...classOptions, tenant2ClassOption] as ClassOption[],
    lessons: lessons as Lesson[],
    bookings: bookings as Booking[],
  }
}
