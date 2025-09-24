import { checkRole } from '@repo/shared-utils'
import type { CollectionConfig } from 'payload'
import { User } from '@repo/shared-types'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req: { user } }) => checkRole(['admin'], user as unknown as User),
    update: ({ req: { user } }) => checkRole(['admin'], user as unknown as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as unknown as User),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
