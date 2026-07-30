import type { Access, CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIDs, tenantScopedReadFiltered } from '@/access/tenant-scoped'

export const EMERGENCY_CONTACTS_SLUG = 'emergency-contacts' as const

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

export const EmergencyContacts: CollectionConfig = {
  slug: EMERGENCY_CONTACTS_SLUG,
  labels: {
    singular: 'Emergency contact',
    plural: 'Emergency contacts',
  },
  admin: {
    group: 'Bookings',
    useAsTitle: 'id',
    defaultColumns: ['user', 'status', 'completedAt', 'updatedAt'],
    description:
      'Family emergency contact details per account holder. Public fill goes through the Emergency Contact Form block APIs.',
  },
  access: {
    read: staffOrSuperAdminRead,
    // Creates/updates go through /api/emergency-contacts with a verification token.
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) =>
      checkRole(['super-admin', 'admin'], user as SharedUser | null),
  },
  indexes: [
    {
      fields: ['tenant', 'user'],
      unique: true,
    },
  ],
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
