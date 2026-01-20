import type { Payload, PayloadRequest } from 'payload'
import type { User, Lesson, ClassOption, Booking, Instructor } from '@repo/shared-types'

/**
 * Seeds booking-related data for manual testing
 * Creates:
 * - Test users (admin and regular users)
 * - Instructors
 * - Class options
 * - Lessons (various states: active, fully booked, upcoming, past)
 * - Bookings (various states: confirmed, pending, cancelled, waiting)
 */
export async function seedBookings({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<{
  users: User[]
  instructors: Instructor[]
  classOptions: ClassOption[]
  lessons: Lesson[]
  bookings: Booking[]
}> {
  payload.logger.info('— Seeding booking data...')

  // Clear existing booking data in order to respect foreign key constraints
  // Order: bookings -> lessons -> class-options -> instructors
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

  // Delete existing test users if they exist (to avoid email conflicts)
  payload.logger.info('  Cleaning up existing test users...')
  const testUserEmails = ['admin@test.com', 'user1@test.com', 'user2@test.com', 'user3@test.com']
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
      
      if (existingUsers.docs.length > 0) {
        await payload.delete({
          collection: 'users',
          id: existingUsers.docs[0].id,
          overrideAccess: true,
        })
      }
    } catch (e) {
      // Ignore errors if user doesn't exist or deletion fails
      payload.logger.warn(`  Could not delete user ${email}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  // Create test users
  payload.logger.info('  Creating test users...')
  const testUsers = await Promise.all([
    // Admin user
    payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: 'admin@test.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        roles: ['admin'],
      },
      overrideAccess: true,
    }),
    // Regular users
    payload.create({
      collection: 'users',
      data: {
        name: 'Test User 1',
        email: 'user1@test.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        roles: ['user'],
      },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: {
        name: 'Test User 2',
        email: 'user2@test.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        roles: ['user'],
      },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: {
        name: 'Test User 3',
        email: 'user3@test.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        roles: ['user'],
      },
      overrideAccess: true,
    }),
  ])

  // Create instructor users first
  payload.logger.info('  Creating instructor users...')
  const instructorUserEmails = ['john@instructor.com', 'jane@instructor.com']
  
  // Delete existing instructor users if they exist
  for (const email of instructorUserEmails) {
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
      
      if (existingUsers.docs.length > 0) {
        await payload.delete({
          collection: 'users',
          id: existingUsers.docs[0].id,
          overrideAccess: true,
        })
      }
    } catch (e) {
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
        roles: ['user'],
      },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: {
        name: 'Jane Instructor',
        email: 'jane@instructor.com'.toLowerCase(),
        password: 'password',
        emailVerified: true,
        roles: ['user'],
      },
      overrideAccess: true,
    }),
  ])

  // Create instructors (they require a user relationship)
  payload.logger.info('  Creating instructors...')
  const instructors = await Promise.all([
    payload.create({
      collection: 'instructors',
      data: {
        user: instructorUsers[0].id,
        active: true,
      },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'instructors',
      data: {
        user: instructorUsers[1].id,
        active: true,
      },
      overrideAccess: true,
    }),
  ])

  // Create class options
  payload.logger.info('  Creating class options...')
  const classOptions = await Promise.all([
    payload.create({
      collection: 'class-options',
      draft: false,
      data: {
        name: 'Yoga Class',
        places: 10,
        description: 'A relaxing yoga class for all levels',
      },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'class-options',
      draft: false,
      data: {
        name: 'Fitness Class',
        places: 15,
        description: 'High-intensity fitness training',
      },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'class-options',
      draft: false,
      data: {
        name: 'Small Group Class',
        places: 5,
        description: 'Intimate small group session',
      },
      overrideAccess: true,
    }),
  ])

  // Create lessons with various states
  payload.logger.info('  Creating lessons...')
  const now = new Date()
  const lessons: Lesson[] = []

  // Past lesson (for history)
  const pastLessonDate = new Date(now)
  pastLessonDate.setDate(pastLessonDate.getDate() - 2)
  pastLessonDate.setHours(10, 0, 0, 0)
  const pastLessonEnd = new Date(pastLessonDate)
  pastLessonEnd.setHours(11, 0, 0, 0)

  const pastLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      date: pastLessonDate.toISOString(),
      startTime: pastLessonDate.toISOString(),
      endTime: pastLessonEnd.toISOString(),
      classOption: classOptions[0].id,
      location: 'Studio A',
      instructor: instructors[0].id,
      active: true,
      lockOutTime: 30,
    },
    overrideAccess: true,
  })
  lessons.push(pastLesson as Lesson)

  // Active lesson (available for booking)
  const activeLessonDate = new Date(now)
  activeLessonDate.setDate(activeLessonDate.getDate() + 1)
  activeLessonDate.setHours(14, 0, 0, 0)
  const activeLessonEnd = new Date(activeLessonDate)
  activeLessonEnd.setHours(15, 0, 0, 0)

  const activeLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      date: activeLessonDate.toISOString(),
      startTime: activeLessonDate.toISOString(),
      endTime: activeLessonEnd.toISOString(),
      classOption: classOptions[0].id,
      location: 'Studio A',
      instructor: instructors[0].id,
      active: true,
      lockOutTime: 30,
    },
    overrideAccess: true,
  })
  lessons.push(activeLesson as Lesson)

  // Lesson with some bookings (partially booked)
  const partiallyBookedDate = new Date(now)
  partiallyBookedDate.setDate(partiallyBookedDate.getDate() + 2)
  partiallyBookedDate.setHours(16, 0, 0, 0)
  const partiallyBookedEnd = new Date(partiallyBookedDate)
  partiallyBookedEnd.setHours(17, 0, 0, 0)

  const partiallyBookedLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      date: partiallyBookedDate.toISOString(),
      startTime: partiallyBookedDate.toISOString(),
      endTime: partiallyBookedEnd.toISOString(),
      classOption: classOptions[1].id,
      location: 'Studio B',
      instructor: instructors[1].id,
      active: true,
      lockOutTime: 30,
    },
    overrideAccess: true,
  })
  lessons.push(partiallyBookedLesson as Lesson)

  // Fully booked lesson
  const fullyBookedDate = new Date(now)
  fullyBookedDate.setDate(fullyBookedDate.getDate() + 3)
  fullyBookedDate.setHours(10, 0, 0, 0)
  const fullyBookedEnd = new Date(fullyBookedDate)
  fullyBookedEnd.setHours(11, 0, 0, 0)

  const fullyBookedLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      date: fullyBookedDate.toISOString(),
      startTime: fullyBookedDate.toISOString(),
      endTime: fullyBookedEnd.toISOString(),
      classOption: classOptions[2].id, // Small group (5 places)
      location: 'Studio C',
      instructor: instructors[0].id,
      active: true,
      lockOutTime: 30,
    },
    overrideAccess: true,
  })
  lessons.push(fullyBookedLesson as Lesson)

  // Upcoming lesson (for future booking)
  const upcomingDate = new Date(now)
  upcomingDate.setDate(upcomingDate.getDate() + 5)
  upcomingDate.setHours(18, 0, 0, 0)
  const upcomingEnd = new Date(upcomingDate)
  upcomingEnd.setHours(19, 0, 0, 0)

  const upcomingLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      date: upcomingDate.toISOString(),
      startTime: upcomingDate.toISOString(),
      endTime: upcomingEnd.toISOString(),
      classOption: classOptions[0].id,
      location: 'Studio A',
      instructor: instructors[1].id,
      active: true,
      lockOutTime: 30,
    },
    overrideAccess: true,
  })
  lessons.push(upcomingLesson as Lesson)

  // Lesson for managing bookings (user has multiple bookings)
  const manageBookingsDate = new Date(now)
  manageBookingsDate.setDate(manageBookingsDate.getDate() + 4)
  manageBookingsDate.setHours(12, 0, 0, 0)
  const manageBookingsEnd = new Date(manageBookingsDate)
  manageBookingsEnd.setHours(13, 0, 0, 0)

  const manageBookingsLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      date: manageBookingsDate.toISOString(),
      startTime: manageBookingsDate.toISOString(),
      endTime: manageBookingsEnd.toISOString(),
      classOption: classOptions[1].id,
      location: 'Studio B',
      instructor: instructors[0].id,
      active: true,
      lockOutTime: 30,
    },
    overrideAccess: true,
  })
  lessons.push(manageBookingsLesson as Lesson)

  // Create bookings
  payload.logger.info('  Creating bookings...')
  const bookings: Booking[] = []

  // Past lesson booking (completed)
  const pastBooking = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[1].id,
      lesson: pastLesson.id,
      status: 'confirmed',
    },
    overrideAccess: true,
  })
  bookings.push(pastBooking as Booking)

  // Active lesson bookings (user1 has 1 booking, user2 has 2 bookings)
  const activeBooking1 = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[1].id,
      lesson: activeLesson.id,
      status: 'confirmed',
    },
    overrideAccess: true,
  })
  bookings.push(activeBooking1 as Booking)

  const activeBooking2 = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[2].id,
      lesson: activeLesson.id,
      status: 'confirmed',
    },
    overrideAccess: true,
  })
  bookings.push(activeBooking2 as Booking)

  const activeBooking3 = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[2].id,
      lesson: activeLesson.id,
      status: 'confirmed',
    },
    overrideAccess: true,
  })
  bookings.push(activeBooking3 as Booking)

  // Partially booked lesson (some bookings)
  for (let i = 0; i < 3; i++) {
    const booking = await payload.create({
      collection: 'bookings',
      draft: false,
      data: {
        user: testUsers[i + 1].id,
        lesson: partiallyBookedLesson.id,
        status: 'confirmed',
      },
      overrideAccess: true,
    })
    bookings.push(booking as Booking)
  }

  // Fully booked lesson (all 5 places taken)
  for (let i = 0; i < 5; i++) {
    const booking = await payload.create({
      collection: 'bookings',
      draft: false,
      data: {
        user: testUsers[(i % 3) + 1].id,
        lesson: fullyBookedLesson.id,
        status: 'confirmed',
      },
      overrideAccess: true,
    })
    bookings.push(booking as Booking)
  }

  // Manage bookings lesson (user1 has 3 bookings for this lesson)
  for (let i = 0; i < 3; i++) {
    const booking = await payload.create({
      collection: 'bookings',
      draft: false,
      data: {
        user: testUsers[1].id,
        lesson: manageBookingsLesson.id,
        status: 'confirmed',
      },
      overrideAccess: true,
    })
    bookings.push(booking as Booking)
  }

  // Pending booking (for payment flow testing)
  const pendingBooking = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[1].id,
      lesson: upcomingLesson.id,
      status: 'pending',
    },
    overrideAccess: true,
  })
  bookings.push(pendingBooking as Booking)

  // Cancelled booking
  const cancelledBooking = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[2].id,
      lesson: upcomingLesson.id,
      status: 'cancelled',
    },
    overrideAccess: true,
  })
  bookings.push(cancelledBooking as Booking)

  // Waiting list booking
  const waitingBooking = await payload.create({
    collection: 'bookings',
    draft: false,
    data: {
      user: testUsers[3].id,
      lesson: fullyBookedLesson.id,
      status: 'waiting',
    },
    overrideAccess: true,
  })
  bookings.push(waitingBooking as Booking)

  payload.logger.info('  Booking data seeded successfully!')
  payload.logger.info(`  Created: ${testUsers.length} users, ${instructors.length} instructors, ${classOptions.length} class options, ${lessons.length} lessons, ${bookings.length} bookings`)

  return {
    users: testUsers as User[],
    instructors: instructors as Instructor[],
    classOptions: classOptions as ClassOption[],
    lessons: lessons as Lesson[],
    bookings: bookings as Booking[],
  }
}
