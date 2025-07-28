import { GlobalConfig } from 'payload'

import { revalidateFooter } from './hooks/revalidate-footer'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'logo',
      type: 'text',
      required: true,
      defaultValue: 'BRÚ',
    },
    {
      name: 'navigationItems',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'link',
          type: 'text',
          required: true,
        },
        {
          name: 'isExternal',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
      defaultValue: [
        { label: 'Schedule', link: '/#schedule', isExternal: false },
        { label: 'Kids Classes', link: '/kids', isExternal: false },
        { label: 'Seminars', link: '/seminars', isExternal: false },
        { label: 'Private Lessons', link: '/private-lessons', isExternal: false },
        { label: 'Online Store', link: 'https://store.brugrappling.ie/', isExternal: true },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}

export default Footer
