import { createLocalReq, getPayload } from 'payload'
import { seed } from '@/endpoints/seed'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

export const maxDuration = 60 // This function can run for a maximum of 60 seconds

/**
 * Production protection for seed endpoint
 * - Only allows seeding in development/staging environments
 * - Requires admin role
 * - Optionally requires a secret token (SEED_SECRET env var)
 */
export async function POST(): Promise<Response> {
  // CRITICAL: Block seed endpoint in production
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'
  
  if (isProduction) {
    return new Response(
      JSON.stringify({ 
        error: 'Seed endpoint is disabled in production for security reasons.',
        message: 'This endpoint can only be used in development or staging environments.'
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Optional: Require a secret token for additional security (even in non-production)
  const seedSecret = process.env.SEED_SECRET
  if (seedSecret) {
    const requestHeaders = await headers()
    const providedSecret = requestHeaders.get('x-seed-secret')
    
    if (providedSecret !== seedSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid seed secret.',
          message: 'A valid seed secret is required to access this endpoint.'
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  // Authenticate by passing request headers
  const { user } = await payload.auth({ headers: requestHeaders })

  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required.' }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Require admin role
  if (!checkRole(['admin'], user as User)) {
    return new Response(
      JSON.stringify({ 
        error: 'Admin access required.',
        message: 'Only administrators can access the seed endpoint.'
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Log warning about seeding (even in non-production)
  payload.logger.warn({
    message: 'Seed endpoint accessed',
    user: user.email,
    environment: nodeEnv,
    timestamp: new Date().toISOString(),
  })

  try {
    // Create a Payload request object to pass to the Local API for transactions
    const payloadReq = await createLocalReq({ user }, payload)

    await seed({ payload, req: payloadReq })

    payload.logger.info({
      message: 'Seed completed successfully',
      user: user.email,
      environment: nodeEnv,
    })

    return Response.json({ 
      success: true,
      message: 'Database seeded successfully.',
      environment: nodeEnv,
    })
  } catch (e) {
    payload.logger.error({ 
      err: e, 
      message: 'Error seeding data',
      user: user.email,
      environment: nodeEnv,
    })
    return new Response(
      JSON.stringify({ 
        error: 'Error seeding data.',
        message: e instanceof Error ? e.message : 'Unknown error occurred.'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
