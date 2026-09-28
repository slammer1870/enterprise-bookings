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
      type: 'row',
      fields: [
        {
          name: 'cta1_text',
          type: 'text',
          label: 'CTA 1 Text',
          defaultValue: 'Kids',
        },
        {
          name: 'cta1_link',
          type: 'text',
          label: 'CTA 1 Link',
          defaultValue: '#kids',
        },
        {
          name: 'cta1_style',
          type: 'select',
          options: [
            { label: 'Filled', value: 'filled' },
            { label: 'Outline', value: 'outline' },
          ],
          label: 'CTA 1 Style',
        },
        hexColorField({ name: 'cta1_backgroundColor', label: 'CTA 1 background color' }),
        hexColorField({ name: 'cta1_textColor', label: 'CTA 1 text color' }),
        hexColorField({ name: 'cta1_borderColor', label: 'CTA 1 border color' }),
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cta2_text',
          type: 'text',
          label: 'CTA 2 Text',
          defaultValue: 'Adults',
        },
        {
          name: 'cta2_link',
          type: 'text',
          label: 'CTA 2 Link',
          defaultValue: '#adults',
        },
        {
          name: 'cta2_style',
          type: 'select',
          options: [
            { label: 'Filled', value: 'filled' },
            { label: 'Outline', value: 'outline' },
          ],
          label: 'CTA 2 Style',
        },
        hexColorField({ name: 'cta2_backgroundColor', label: 'CTA 2 background color' }),
        hexColorField({ name: 'cta2_textColor', label: 'CTA 2 text color' }),
        hexColorField({ name: 'cta2_borderColor', label: 'CTA 2 border color' }),
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
