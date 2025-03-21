import { Block } from 'payload'

export const Testimonials: Block = {
  slug: 'testimonials',
  labels: {
    singular: 'Testimonials Section',
    plural: 'Testimonials Sections',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Section Title',
      defaultValue: 'Testimonials',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      label: 'Description',
      defaultValue: "Here's what some of our members have to say.",
    },
    {
      name: 'videos',
      type: 'array',
      label: 'Testimonial Videos',
      minRows: 1,
      maxRows: 2,
      fields: [
        {
          name: 'youtubeId',
          type: 'text',
          required: true,
          label: 'YouTube Video ID',
        },
      ],
    },
  ],
}
