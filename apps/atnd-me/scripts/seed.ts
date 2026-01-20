#!/usr/bin/env tsx
/**
 * Standalone seed script for manual testing
 * 
 * Usage:
 *   pnpm seed
 * 
 * This script seeds the database with test data for manual testing of all app functionality.
 * 
 * SECURITY: This script is blocked in production environments.
 */

// Load environment variables from .env file
import 'dotenv/config'

import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seed } from '../src/endpoints/seed'
import { createLocalReq } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

async function main() {
  // CRITICAL: Block seed script in production
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'

  if (isProduction) {
    console.error('❌ ERROR: Seed script is disabled in production for security reasons.')
    console.error('   This script can only be run in development or staging environments.')
    console.error(`   Current NODE_ENV: ${nodeEnv}`)
    process.exit(1)
  }

  // Set default PAYLOAD_SECRET for development if not set
  if (!process.env.PAYLOAD_SECRET) {
    process.env.PAYLOAD_SECRET = 'dev-secret-key-for-seeding-only'
    console.warn('⚠️  PAYLOAD_SECRET not set, using default development secret')
  }

  // Check for required environment variables
  if (!process.env.DATABASE_URI) {
    console.error('❌ ERROR: DATABASE_URI is required but not set.')
    console.error('   Please set DATABASE_URI in your .env file or environment variables.')
    console.error('   Example: DATABASE_URI=postgres://user:password@localhost:5432/database')
    process.exit(1)
  }

  // Warn user about seeding
  console.warn('⚠️  WARNING: This will clear and recreate test data in the database.')
  console.warn(`   Environment: ${nodeEnv}`)
  console.warn('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n')
  
  // Give user a chance to cancel
  await new Promise(resolve => setTimeout(resolve, 3000))

  console.log('Starting seed process...')

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    // Create a dummy admin user for the request context
    // In a real scenario, you'd authenticate as an admin user
    const adminUser = await payload.find({
      collection: 'users',
      where: {
        roles: {
          contains: 'admin',
        },
      },
      limit: 1,
      overrideAccess: true, // Need to bypass access to find admin user
    })

    const user = adminUser.docs[0] || null

    if (!user) {
      console.error('❌ No admin user found. Please create an admin user first.')
      process.exit(1)
    }

    // Verify user is actually an admin
    if (!checkRole(['admin'], user as User)) {
      console.error('❌ User found but does not have admin role.')
      process.exit(1)
    }

    console.log(`✓ Authenticated as admin: ${user.email}`)

    const req = await createLocalReq({ user }, payload)

    await seed({ payload, req })

    console.log('✅ Seed completed successfully!')
    console.log('\n📝 Test Accounts:')
    console.log('  Admin: admin@test.com / password')
    console.log('  User 1: user1@test.com / password')
    console.log('  User 2: user2@test.com / password')
    console.log('  User 3: user3@test.com / password')
    console.log('\n📚 Test Data Created:')
    console.log('  - 4 test users (1 admin, 3 regular)')
    console.log('  - 2 instructors')
    console.log('  - 3 class options')
    console.log('  - 6 lessons (various states)')
    console.log('  - Multiple bookings (confirmed, pending, cancelled, waiting)')
    console.log('\n🎯 Test Scenarios:')
    console.log('  - Active lesson: /bookings/[activeLessonId]')
    console.log('  - Fully booked: /bookings/[fullyBookedLessonId]')
    console.log('  - Manage bookings: /bookings/[manageBookingsLessonId]/manage')
    console.log('  - Partially booked: /bookings/[partiallyBookedLessonId]')

    await payload.db?.destroy?.()
    process.exit(0)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }
}

main()
