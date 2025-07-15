import { checkRole } from '@repo/shared-utils/src/check-role'
import type { CollectionConfig } from 'payload'

import { User } from '@repo/shared-types'

import { adminOrUserOrParentOrInstructor } from '@repo/shared-services/src/access/is-admin-or-user-or-parent-or-instructor'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    create: () => true,
    read: adminOrUserOrParentOrInstructor,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  auth: {
    maxLoginAttempts: 5,
    tokenExpiration: 604800,
    forgotPassword: {
      generateEmailHTML: (args) => {
        if (!args?.token || !args?.user) return ''
        const resetPasswordURL = `${process.env.NEXT_PUBLIC_SERVER_URL}/reset-password?token=${args.token}`

        return `  
          <!doctype html>
          <html>
            <body>
              <p>Hello, ${args.user.email}!</p>
              <p>Click below to reset your password.</p>
              <p>
                <a href="${resetPasswordURL}">${resetPasswordURL}</a>
              </p>
            </body>
          </html>
        `
      },
    },
  },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: false,
      access: {
        read: () => true,
      },
    },
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
      },
    },
    // Email added by default
    // Add more fields as needed
  ],
}
