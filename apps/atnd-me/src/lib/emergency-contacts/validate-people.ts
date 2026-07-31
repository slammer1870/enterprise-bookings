import type { EmergencyContactPerson, EmergencyContactPersonType } from './types'

const PERSON_TYPES = new Set<EmergencyContactPersonType>(['self', 'child', 'other'])

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizePeopleInput(raw: unknown): {
  people: EmergencyContactPerson[]
  error?: string
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { people: [], error: 'Add at least one person this form covers.' }
  }

  const people: EmergencyContactPerson[] = []

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') {
      return { people: [], error: `Person ${i + 1} is invalid.` }
    }
    const r = row as Record<string, unknown>
    const fullName = asTrimmedString(r.fullName)
    if (!fullName) {
      return { people: [], error: `Person ${i + 1}: full name is required.` }
    }

    const personTypeRaw = asTrimmedString(r.personType) ?? 'self'
    if (!PERSON_TYPES.has(personTypeRaw as EmergencyContactPersonType)) {
      return { people: [], error: `Person ${i + 1}: invalid person type.` }
    }
    const personType = personTypeRaw as EmergencyContactPersonType

    if (!Array.isArray(r.contacts) || r.contacts.length === 0) {
      return {
        people: [],
        error: `Person ${i + 1} (${fullName}): add at least one emergency contact.`,
      }
    }

    const contacts = []
    for (let c = 0; c < r.contacts.length; c++) {
      const contact = r.contacts[c]
      if (!contact || typeof contact !== 'object') {
        return { people: [], error: `Person ${i + 1}: contact ${c + 1} is invalid.` }
      }
      const ct = contact as Record<string, unknown>
      const name = asTrimmedString(ct.name)
      const phone = asTrimmedString(ct.phone)
      const relationship = asTrimmedString(ct.relationship)
      if (!name || !phone || !relationship) {
        return {
          people: [],
          error: `Person ${i + 1} (${fullName}): contact ${c + 1} needs name, phone, and relationship.`,
        }
      }
      contacts.push({ name, phone, relationship })
    }

    const medicalNotes =
      typeof r.medicalNotes === 'string' && r.medicalNotes.trim()
        ? r.medicalNotes.trim()
        : null

    people.push({
      fullName,
      personType,
      contacts,
      medicalNotes,
    })
  }

  return { people }
}
