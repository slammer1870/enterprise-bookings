import { checkRole } from '@repo/shared-utils/src/check-role'
import type { CollectionConfig } from 'payload'

import { User } from '@repo/shared-types'

import { adminOrUserOrParentOrInstructor } from '@repo/shared-services/src/access/is-admin-or-user-or-parent-or-instructor'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'createdAt'],
  },
  access: {
    create: () => true,
    read: adminOrUserOrParentOrInstructor,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
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
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      admin: {
        position: 'sidebar',
        description: 'Parent of the user',
        condition: ({ children }) => {
          if (children && children.docs.length > 0) {
            return false
          }
          return true
        },
      },
    },
    {
      name: 'children',
      type: 'join',
      collection: 'users',
      on: 'parent',
      admin: {
        condition: ({ children }) => {
          if (children && children.docs.length > 0) {
            return true
          }
          return false
        },
      },
    },
    // Email added by default
    // Add more fields as needed
  ],
}
