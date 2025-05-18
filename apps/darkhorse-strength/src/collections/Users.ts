import { checkRole } from '@repo/shared-utils/src/check-role'
import type { CollectionConfig } from 'payload'

import { User } from '@repo/shared-types'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  auth: {
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
    // Email added by default
    // Add more fields as needed
  ],
}
