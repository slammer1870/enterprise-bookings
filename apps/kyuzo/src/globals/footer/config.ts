import { GlobalConfig } from 'payload'

import { revalidateFooter } from './hooks/revalidate-footer'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'brandName',
      type: 'text',
      required: true,
      defaultValue: 'Kyuzo Brazilian Jiu Jitsu',
    },
    {
      name: 'copyrightText',
      type: 'text',
      required: true,
      defaultValue: 'Kyuzo',
    },
    {
      name: 'socialLinks',
      type: 'group',
      fields: [
        {
          name: 'facebook',
          type: 'text',
          defaultValue: 'https://www.facebook.com/kyuzogym/',
        },
        {
          name: 'twitter',
          type: 'text',
          defaultValue: 'https://twitter.com/kyuzogym',
        },
        {
          name: 'instagram',
          type: 'text',
          defaultValue: 'https://www.instagram.com/kyuzojiujitsu/',
        },
        {
          name: 'youtube',
          type: 'text',
          defaultValue: 'https://www.youtube.com/channel/UCes5Th2Jn9EojMblvqdAKkw',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}

export default Footer
