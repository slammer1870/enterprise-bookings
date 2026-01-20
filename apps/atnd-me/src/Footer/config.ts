import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { revalidateFooter } from './hooks/revalidateFooter'

// Single-tenant Footer global with configurable logo, nav items and styling
export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
      admin: {
        description: 'Custom logo for this site. If not set, default logo will be used.',
        position: 'sidebar',
      },
    },
    {
      name: 'logoLink',
      type: 'text',
      label: 'Logo Link URL',
      admin: {
        description: 'URL the logo should link to (defaults to "/")',
        position: 'sidebar',
      },
      defaultValue: '/',
    },
    {
      name: 'copyrightText',
      type: 'text',
      label: 'Copyright Text',
      admin: {
        description: 'Copyright notice to display in footer',
        position: 'sidebar',
      },
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'Navigation Items',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 10,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
    {
      name: 'styling',
      type: 'group',
      label: 'Styling Options',
      fields: [
        {
          name: 'backgroundColor',
          type: 'text',
          label: 'Background Color',
          admin: {
            description: 'CSS color value (e.g., "#000000", "var(--background)")',
          },
        },
        {
          name: 'textColor',
          type: 'text',
          label: 'Text Color',
          admin: {
            description: 'CSS color value for text',
          },
        },
        {
          name: 'showThemeSelector',
          type: 'checkbox',
          label: 'Show Theme Selector',
          defaultValue: true,
          admin: {
            description: 'Display theme selector in footer',
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
