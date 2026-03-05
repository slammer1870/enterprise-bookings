import type { Block } from 'payload'

export const BruTestimonials: Block = {
  slug: 'bruTestimonials',
  interfaceName: 'BruTestimonialsBlock',
  labels: {
    singular: 'Testimonials (Brú)',
    plural: 'Testimonials (Brú)',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: false,
      label: 'Section Title',
    },
    {
      name: 'testimonials',
      type: 'array',
      label: 'Testimonials',
      minRows: 1,
      maxRows: 12,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Profile Image',
        },
        {
          name: 'name',
          type: 'text',
          required: false,
          label: 'Name',
        },
        {
          name: 'role',
          type: 'text',
          required: false,
          label: 'Role/Occupation',
        },
        {
          name: 'testimonial',
          type: 'richText',
          required: false,
          label: 'Testimonial Text',
        },
      ],
    },
  ],
}

