import type { CollectionConfig } from 'payload'

import { checkRole } from '@repo/shared-utils/src/check-role'
import type { User } from '@repo/shared-types'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
