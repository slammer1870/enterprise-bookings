import { describe, it, expect, beforeAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { EMERGENCY_CONTACTS_SLUG } from '@/collections/EmergencyContacts'
import {
  findEmergencyContactForUser,
  findTenantUserByEmail,
} from '@/lib/emergency-contacts/lookup'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Emergency contacts collection', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let userEmail: string

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Emergency Contacts Tenant',
        slug: `emergency-contacts-${Date.now()}`,
        timeZone: 'Europe/Dublin',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    userEmail = `emergency-contacts-${Date.now()}@test.com`
    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Emergency Parent',
        email: userEmail,
        password: 'test',
        role: ['user'],
        emailVerified: true,
        registrationTenant: tenantId,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number
  }, HOOK_TIMEOUT)

  it(
    'finds tenant user by email and upserts family emergency contacts',
    async () => {
      const found = await findTenantUserByEmail(payload, userEmail, tenantId)
      expect(found?.id).toBe(userId)

      const missing = await findTenantUserByEmail(payload, 'nobody@example.com', tenantId)
      expect(missing).toBeNull()

      const created = await payload.create({
        collection: EMERGENCY_CONTACTS_SLUG,
        data: {
          tenant: tenantId,
          user: userId,
          status: 'complete',
          completedAt: new Date().toISOString(),
          people: [
            {
              fullName: 'Emma Parent',
              personType: 'child',
              contacts: [{ name: 'Dad', phone: '555', relationship: 'father' }],
            },
          ],
        },
        overrideAccess: true,
      })

      expect(created.id).toBeTruthy()

      const summary = await findEmergencyContactForUser(payload, userId, tenantId)
      expect(summary?.status).toBe('complete')
      expect(summary?.people[0]?.fullName).toBe('Emma Parent')
      expect(summary?.people[0]?.contacts[0]?.phone).toBe('555')
    },
    TEST_TIMEOUT,
  )
})
