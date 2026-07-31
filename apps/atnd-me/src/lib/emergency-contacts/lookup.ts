import type { Payload } from 'payload'
import { EMERGENCY_CONTACTS_SLUG } from '@/collections/EmergencyContacts'
import type { EmergencyContactRecordSummary } from './types'

function relationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (value && typeof value === 'object' && 'id' in value) {
    return relationId((value as { id: unknown }).id)
  }
  return null
}

/**
 * Find a user by email that belongs to the given tenant via registrationTenant
 * or tenants membership array.
 */
export async function findTenantUserByEmail(
  payload: Payload,
  email: string,
  tenantId: number,
): Promise<{ id: number; email: string; name: string | null } | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const result = await payload.find({
    collection: 'users',
    where: {
      and: [
        { email: { equals: normalized } },
        {
          or: [
            { registrationTenant: { equals: tenantId } },
            { 'tenants.tenant': { equals: tenantId } },
          ],
        },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) return null

  return {
    id: doc.id,
    email: typeof doc.email === 'string' ? doc.email : normalized,
    name: typeof doc.name === 'string' ? doc.name : null,
  }
}

export async function findEmergencyContactForUser(
  payload: Payload,
  userId: number,
  tenantId: number,
): Promise<EmergencyContactRecordSummary | null> {
  const result = await payload.find({
    collection: EMERGENCY_CONTACTS_SLUG,
    where: {
      and: [{ user: { equals: userId } }, { tenant: { equals: tenantId } }],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) return null

  return toEmergencyContactSummary(doc as unknown as Record<string, unknown>)
}

export function toEmergencyContactSummary(doc: Record<string, unknown>): EmergencyContactRecordSummary {
  const userId = relationId(doc.user) ?? 0
  const peopleRaw = Array.isArray(doc.people) ? doc.people : []
  const people = peopleRaw.map((row) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
    const contactsRaw = Array.isArray(r.contacts) ? r.contacts : []
    return {
      fullName: typeof r.fullName === 'string' ? r.fullName : '',
      personType: (r.personType === 'child' || r.personType === 'other' ? r.personType : 'self') as
        | 'self'
        | 'child'
        | 'other',
      medicalNotes: typeof r.medicalNotes === 'string' ? r.medicalNotes : null,
      id: typeof r.id === 'string' ? r.id : null,
      contacts: contactsRaw.map((c) => {
        const ct = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
        return {
          name: typeof ct.name === 'string' ? ct.name : '',
          phone: typeof ct.phone === 'string' ? ct.phone : '',
          relationship: typeof ct.relationship === 'string' ? ct.relationship : '',
          id: typeof ct.id === 'string' ? ct.id : null,
        }
      }),
    }
  })

  return {
    id: typeof doc.id === 'number' ? doc.id : Number(doc.id),
    userId,
    status: doc.status === 'complete' ? 'complete' : 'incomplete',
    people,
    completedAt: typeof doc.completedAt === 'string' ? doc.completedAt : null,
  }
}
