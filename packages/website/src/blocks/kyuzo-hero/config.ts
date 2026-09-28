import type { Block } from 'payload'
import { hexColorField } from '../../fields/hexColorField'

export const KyuzoHero: Block = {
  slug: 'kyuzoHero',
  interfaceName: 'KyuzoHeroBlock',
  labels: {
    singular: 'Hero (Kyuzo)',
    plural: 'Heroes (Kyuzo)',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'Kyuzo Brazilian Jiu Jitsu',
    },
    {
      name: 'subheading',
      type: 'text',
      required: true,
      label: 'Subheading',
      defaultValue: 'Sign up today to get started on your Jiu Jitsu Journey!',
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Background Image',
    },
    hexColorField({
      name: 'panelBackgroundColor',
      label: 'Form panel background color',
      description: 'Defaults to the existing Kyuzo red when omitted.',
    }),
    hexColorField({
      name: 'overlayColor',
      label: 'Overlay color',
      description: 'Leave blank to keep the existing gradient overlay.',
    }),
    hexColorField({
      name: 'circleColor',
      label: 'Decorative circle color',
      description: 'Leave blank to hide the decorative circle.',
    }),
    hexColorField({
      name: 'headingColor',
      label: 'Heading text color',
    }),
    hexColorField({
      name: 'subheadingColor',
      label: 'Subheading text color',
    }),
    {
      name: 'overlayOpacity',
      type: 'number',
      min: 0,
      max: 1,
      admin: {
        description: 'Overlay opacity from 0 (transparent) to 1 (opaque).',
        step: 0.05,
      },
    },
    {
      name: 'ctas',
      type: 'array',
      label: 'Call to action buttons',
      maxRows: 2,
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
          label: 'Text',
        },
        {
          name: 'link',
          type: 'text',
          required: true,
          label: 'Link',
        },
        {
          name: 'style',
          type: 'select',
          options: [
            { label: 'Filled', value: 'filled' },
            { label: 'Outline', value: 'outline' },
          ],
          defaultValue: 'filled',
          label: 'Style',
        },
        hexColorField({ name: 'backgroundColor', label: 'Background color' }),
        hexColorField({ name: 'textColor', label: 'Text color' }),
        hexColorField({ name: 'borderColor', label: 'Border color' }),
      ],
    },
    {
      name: 'formTitle',
      type: 'text',
      required: true,
      label: 'Form Title',
      defaultValue: 'FREE TRIAL CLASS',
    },
    {
      name: 'formDescription',
      type: 'textarea',
      required: true,
      label: 'Form Description',
      defaultValue: 'Fill out the short form to try Jiu Jitsu for free',
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      hasMany: false,
      required: true,
      label: 'Hero Form',
    },
  ],
}
