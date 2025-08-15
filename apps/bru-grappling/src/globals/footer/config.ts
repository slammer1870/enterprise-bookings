import { GlobalConfig } from 'payload'

import { revalidateFooter } from './hooks/revalidate-footer'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'companyName',
      type: 'text',
      required: true,
      defaultValue: 'Brú Grappling Studio',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'email',
      type: 'text',
      required: true,
      defaultValue: 'info@brugrappling.ie',
    },
    {
      name: 'locationUrl',
      type: 'text',
      required: true,
      defaultValue: 'https://goo.gl/maps/aqepRdNh9YcYNGuEA',
    },
    {
      name: 'instagramUrl',
      type: 'text',
      required: true,
      defaultValue: 'https://www.instagram.com/bru_grappling/',
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}

export default Footer
