import { describe, it, expect, beforeAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { EMERGENCY_CONTACTS_SLUG } from '@/collections/EmergencyContacts'
import {
  findEmergencyContactForUser,
  findTenantUserByEmail,
} from '@/lib/emergency-contacts/lookup'
import type { User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Emergency contacts collection', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let userEmail: string
  let locationManager: User
  let contactId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Emergency Contacts Tenant',
        slug: `emergency-contacts-${ts}`,
        timeZone: 'Europe/Dublin',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    userEmail = `emergency-contacts-${ts}@test.com`
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

    locationManager = (await payload.create({
      collection: 'users',
      data: {
        name: 'LM Emergency Viewer',
        email: `lm-emergency-${ts}@test.com`,
        password: 'test',
        role: ['location-manager'],
        emailVerified: true,
        tenants: [{ tenant: tenantId, roles: ['location-manager'] }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const created = await payload.create({
      collection: EMERGENCY_CONTACTS_SLUG,
      data: {
        tenant: tenantId,
        user: userId,
        status: 'complete',
        completedAt: new Date().toISOString(),
        people: [
          {
            fullName: 'Seed Child',
            personType: 'child',
            contacts: [{ name: 'Mum', phone: '111', relationship: 'mother' }],
          },
        ],
      },
      overrideAccess: true,
    })
    contactId = created.id as number
  }, HOOK_TIMEOUT)

  it(
    'finds tenant user by email and upserts family emergency contacts',
    async () => {
      const found = await findTenantUserByEmail(payload, userEmail, tenantId)
      expect(found?.id).toBe(userId)

      const missing = await findTenantUserByEmail(payload, 'nobody@example.com', tenantId)
      expect(missing).toBeNull()

      await payload.update({
        collection: EMERGENCY_CONTACTS_SLUG,
        id: contactId,
        data: {
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

      const summary = await findEmergencyContactForUser(payload, userId, tenantId)
      expect(summary?.status).toBe('complete')
      expect(summary?.people[0]?.fullName).toBe('Emma Parent')
      expect(summary?.people[0]?.contacts[0]?.phone).toBe('555')
    },
    TEST_TIMEOUT,
  )

  it(
    'location-manager can read tenant emergency contacts',
    async () => {
      const req = {
        user: locationManager,
        context: { tenant: tenantId },
        payload,
        headers: new Headers(),
      } as unknown as Parameters<typeof payload.find>[0]['req']

      const result = await payload.find({
        collection: EMERGENCY_CONTACTS_SLUG,
        where: { id: { equals: contactId } },
        limit: 1,
        req,
        overrideAccess: false,
        depth: 0,
      })
      expect(result.docs.map((d) => d.id)).toContain(contactId)
    },
    TEST_TIMEOUT,
  )
})
