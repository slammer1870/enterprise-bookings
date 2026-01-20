import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'

// Single-tenant Header global with configurable logo, nav items and styling
export const Header: GlobalConfig = {
  slug: 'header',
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
      name: 'navItems',
      type: 'array',
      label: 'Navigation Items',
      fields: [
        link({
          appearances: false,
        }),
        {
          name: 'renderAsButton',
          type: 'checkbox',
          label: 'Render as Button',
          defaultValue: false,
          admin: {
            description: 'If enabled, this nav item will render as a button instead of a text link.',
          },
        },
        {
          name: 'buttonVariant',
          type: 'select',
          label: 'Button Variant',
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Outline', value: 'outline' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Ghost', value: 'ghost' },
          ],
          defaultValue: 'default',
          admin: {
            description: 'Choose which button style to use for this nav item.',
            condition: (_data, siblingData) => Boolean(siblingData?.renderAsButton),
          },
        },
      ],
      maxRows: 10,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
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
            description: 'CSS color value (e.g., "#ffffff", "transparent", "var(--background)")',
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
          name: 'sticky',
          type: 'checkbox',
          label: 'Sticky Header',
          defaultValue: false,
          admin: {
            description: 'Make header stick to top when scrolling',
          },
        },
        {
          name: 'padding',
          type: 'select',
          label: 'Padding',
          options: [
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
          ],
          defaultValue: 'medium',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
