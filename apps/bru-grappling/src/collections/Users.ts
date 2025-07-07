import type { CollectionConfig } from 'payload'

import { adminOrUserOrInstructor } from '@repo/shared-services/src/access/is-admin-or-user-or-instructor'

import { checkRole } from '@repo/shared-utils'

import { User } from '@repo/shared-types'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    create: () => true,
    read: adminOrUserOrInstructor,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
