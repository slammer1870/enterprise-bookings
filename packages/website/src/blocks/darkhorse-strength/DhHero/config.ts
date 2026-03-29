import type { Block } from 'payload'

export const DhHero: Block = {
  interfaceName: 'DhHeroBlock',
  slug: 'dhHero',
  labels: {
    singular: 'Hero (Dark Horse)',
    plural: 'Heroes (Dark Horse)',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'Dark Horse Strength and Performance',
    },
    {
      name: 'subheading',
      type: 'text',
      required: true,
      label: 'Subheading',
      defaultValue:
        'Small Group Personal Training in a Private Facility located in Bray, Co. Wicklow',
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Background Image',
    },
    {
      name: 'ctaLink',
      type: 'text',
      required: true,
      label: 'CTA Link',
      defaultValue: '/personal-training',
    },
    {
      name: 'ctaTitle',
      type: 'text',
      required: true,
      label: 'CTA Title',
      defaultValue: 'Personal Training',
    },
    {
      name: 'ctaDescription',
      type: 'textarea',
      required: true,
      label: 'CTA Description',
      defaultValue:
        "Do you want to become our next success story? Your own program, nutritional support and expert guidance. Achieve the fitness goals you've always dreamed of. Results guaranteed.",
    },
  ],
}
