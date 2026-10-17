import type { EmergencyContactPerson } from './types'
import type { EmergencyContactRecordSummary } from './types'

export type EmergencyContactSessionUser = {
  id: number
  email: string
  name: string | null
}

export function parseEmergencyContactSessionUser(user: unknown): EmergencyContactSessionUser | null {
  if (!user || typeof user !== 'object') return null
  const u = user as { id?: unknown; email?: unknown; name?: unknown }
  const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : ''
  if (!email) return null

  let id: number | null = null
  if (typeof u.id === 'number' && Number.isFinite(u.id)) id = u.id
  else if (typeof u.id === 'string' && /^\d+$/.test(u.id.trim())) id = parseInt(u.id.trim(), 10)
  if (id == null || id <= 0) return null

  return {
    id,
    email,
    name: typeof u.name === 'string' ? u.name : null,
  }
}

export function initialPeopleForSession(
  existing: EmergencyContactRecordSummary | null,
  userName: string | null,
): EmergencyContactPerson[] {
  if (existing?.people?.length) {
    return existing.people
  }

  return [
    {
      fullName: userName?.trim() ?? '',
      personType: 'self',
      contacts: [{ name: '', phone: '', relationship: '' }],
      medicalNotes: '',
    },
  ]
}
