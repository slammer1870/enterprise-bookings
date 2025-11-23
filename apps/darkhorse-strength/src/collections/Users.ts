import { checkRole } from '@repo/shared-utils/src/check-role'
import type { CollectionConfig } from 'payload'

import { User } from '@repo/shared-types'

import { adminOrUserOrInstructor } from '@repo/shared-services/src/access/is-admin-or-user-or-instructor'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    create: () => true,
    read: adminOrUserOrInstructor,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  // auth configuration is now handled by better-auth
  fields: [
    {
      name: 'lessons',
      type: 'join',
      collection: 'lessons',
      on: 'instructor',
      admin: {
        condition: () => false,
      },
    },
    // Email added by default
    // Add more fields as needed
    // Note: 'image' field is provided by better-auth
  ],
}
