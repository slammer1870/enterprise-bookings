import type { CollectionConfig } from 'payload'

import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

import { adminOrUserOrStaffMember } from '@repo/shared-services/src/access/is-admin-or-user-or-instructor'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  // auth configuration is now handled by better-auth
  access: {
    create: () => true,
    read: adminOrUserOrStaffMember,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  fields: [
    {
      name: 'timeslots',
      type: 'join',
      collection: 'timeslots',
      on: 'instructor',
      admin: {
        condition: () => false,
      },
    },
    // Email added by default
    // Add more fields as needed
  ],
}
