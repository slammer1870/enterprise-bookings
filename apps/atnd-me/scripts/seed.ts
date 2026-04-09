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

import { createLocalReq } from 'payload'

import { getPayload } from '../src/lib/payload'
import { seed } from '../src/endpoints/seed'
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
    const payload = await getPayload()

    // Find or create an admin user for the request context
    let adminUser = await payload.find({
      collection: 'users',
      where: {
        roles: {
          contains: 'admin',
        },
      },
      limit: 1,
      overrideAccess: true, // Need to bypass access to find admin user
    })

    let user = adminUser.docs[0] || null

    // If no admin user exists, create one
    if (!user) {
      console.log('No admin user found. Creating admin user...')
      user = await payload.create({
        collection: 'users',
        data: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'password',
          emailVerified: true,
          role: ['admin'],
          roles: ['admin'],
        },
        overrideAccess: true,
      })
      console.log(`✓ Created admin user: ${user.email}`)
    } else {
      // Verify user is actually an admin
      if (!checkRole(['admin'], user as User)) {
        console.error('❌ User found but does not have admin role.')
        process.exit(1)
      }
      console.log(`✓ Authenticated as admin: ${user.email}`)
    }

    const req = await createLocalReq({ user: { ...user, collection: 'users' } }, payload)

    await seed({ payload, req })

    console.log('✅ Seed completed successfully!')
    console.log('\n📝 Test Accounts:')
    console.log('  Admin: admin@test.com / password')
    console.log('  Demo users: demo1@test.com … demo5@test.com / password')
    console.log('\n🏢 Sauna Demo Tenants:')
    console.log('  - Dundrum (slug: dundrum) — Dublin South, Stripe Connect')
    console.log('  - Greystones (slug: greystones) — Wicklow coast, Stripe Connect')
    console.log('  - Tallaght (slug: tallaght) — Dublin South-West, Stripe Connect')
    console.log('\n🌐 Subdomains: dundrum.localhost, greystones.localhost, tallaght.localhost')
    console.log('\n📚 Each tenant: 50 min session (Stripe + Class Pass), 30 min session (Class Pass only)')
    console.log('  Pages, navbar, footer, schedulers, timeslots, bookings per tenant.')

    await payload.db?.destroy?.()
    process.exit(0)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }
}

main()
