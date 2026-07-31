import type { Access, CollectionConfig, FieldHook } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import {
  getUserTenantIDs,
  tenantScopedCreate,
  tenantScopedReadFiltered,
  tenantScopedUpdate,
} from '@/access/tenant-scoped'
import { isStaffOnlyUser } from '@/access/userTenantAccess'

export const EMERGENCY_CONTACTS_SLUG = 'emergency-contacts' as const

type PersonRow = {
  fullName?: string | null
  personType?: string | null
  contacts?: Array<{
    name?: string | null
    phone?: string | null
    relationship?: string | null
  }> | null
}

function peopleFromDoc(doc: unknown): PersonRow[] {
  if (!doc || typeof doc !== 'object') return []
  const people = (doc as { people?: unknown }).people
  return Array.isArray(people) ? (people as PersonRow[]) : []
}

const populatePeopleSummary: FieldHook = ({ data, siblingData, originalDoc }) => {
  const source = siblingData ?? data ?? originalDoc
  const people = peopleFromDoc(source)
  if (!people.length) return '—'
  return people
    .map((person) => {
      const name = person.fullName?.trim() || 'Unnamed'
      const type = person.personType ? ` (${person.personType})` : ''
      return `${name}${type}`
    })
    .join(', ')
}

const populatePrimaryContact: FieldHook = ({ data, siblingData, originalDoc }) => {
  const source = siblingData ?? data ?? originalDoc
  const people = peopleFromDoc(source)
  for (const person of people) {
    const contact = person.contacts?.[0]
    if (!contact) continue
    const name = contact.name?.trim() || 'Contact'
    const phone = contact.phone?.trim()
    const relationship = contact.relationship?.trim()
    const parts = [name]
    if (phone) parts.push(phone)
    if (relationship) parts.push(`(${relationship})`)
    return parts.join(' · ')
  }
  return '—'
}

const staffOrSuperAdminRead: Access = async (args) => {
  const user = args.req.user
  if (!user) return false
  if (checkRole(['super-admin'], user as SharedUser | null)) {
    return tenantScopedReadFiltered(args)
  }
  if (checkRole(['admin', 'staff', 'location-manager'], user as SharedUser | null)) {
    return tenantScopedReadFiltered(args)
  }
  // Account holders can read their own record (e.g. admin UI / future account page).
  const tenantIds = getUserTenantIDs(user)
  return {
    and: [
      { user: { equals: user.id } },
      ...(tenantIds.length > 0 ? [{ tenant: { in: tenantIds } }] : []),
    ],
  }
}

const tenantAdminCreate: Access = async (args) => {
  if (isStaffOnlyUser(args.req.user)) return false
  return tenantScopedCreate(args)
}

const tenantAdminUpdate: Access = async (args) => {
  if (isStaffOnlyUser(args.req.user)) return false
  return tenantScopedUpdate(args)
}

export const EmergencyContacts: CollectionConfig = {
  slug: EMERGENCY_CONTACTS_SLUG,
  labels: {
    singular: 'Emergency contact',
    plural: 'Emergency contacts',
  },
  admin: {
    group: 'Auth',
    useAsTitle: 'user',
    defaultColumns: ['user', 'peopleSummary', 'primaryContact', 'status', 'completedAt'],
    description:
      'Family emergency contact details per account holder. Public fill goes through the Emergency Contact Form block; tenant admins can also create and edit here.',
  },
  access: {
    read: staffOrSuperAdminRead,
    create: tenantAdminCreate,
    update: tenantAdminUpdate,
    delete: ({ req: { user } }) =>
      checkRole(['super-admin', 'admin'], user as SharedUser | null),
  },
  indexes: [
    {
      fields: ['tenant', 'user'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (!data) return data
        if (data.status === 'complete' && !data.completedAt && !originalDoc?.completedAt) {
          data.completedAt = new Date().toISOString()
        }
        if (operation === 'create' && data.status === 'complete' && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Account holder / booker this family record belongs to.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'incomplete',
      options: [
        { label: 'Incomplete', value: 'incomplete' },
        { label: 'Complete', value: 'complete' },
      ],
      index: true,
    },
    {
      name: 'peopleSummary',
      type: 'text',
      label: 'People',
      virtual: true,
      admin: {
        readOnly: true,
        description: 'Names covered by this record (self, children, etc.).',
      },
      hooks: {
        afterRead: [populatePeopleSummary],
      },
    },
    {
      name: 'primaryContact',
      type: 'text',
      label: 'Primary contact',
      virtual: true,
      admin: {
        readOnly: true,
        description: 'First listed emergency contact name, phone, and relationship.',
      },
      hooks: {
        afterRead: [populatePrimaryContact],
      },
    },
    {
      name: 'people',
      type: 'array',
      labels: {
        singular: 'Person',
        plural: 'People',
      },
      admin: {
        description: 'Who the emergency contacts are for (self, children, etc.).',
      },
      fields: [
        {
          name: 'fullName',
          type: 'text',
          required: true,
          label: 'Full name',
        },
        {
          name: 'personType',
          type: 'select',
          required: true,
          defaultValue: 'self',
          options: [
            { label: 'Self', value: 'self' },
            { label: 'Child', value: 'child' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'contacts',
          type: 'array',
          minRows: 1,
          labels: {
            singular: 'Emergency contact',
            plural: 'Emergency contacts',
          },
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Contact name',
            },
            {
              name: 'phone',
              type: 'text',
              required: true,
              label: 'Phone',
            },
            {
              name: 'relationship',
              type: 'text',
              required: true,
              label: 'Relationship',
              admin: {
                description: 'e.g. parent, spouse, guardian',
              },
            },
          ],
        },
        {
          name: 'medicalNotes',
          type: 'textarea',
          label: 'Medical / allergy notes',
        },
      ],
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        readOnly: true,
      },
    },
  ],
}
