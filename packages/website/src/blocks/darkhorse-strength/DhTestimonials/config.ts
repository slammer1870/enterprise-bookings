import type { Block } from 'payload'

export const DhTestimonials: Block = {
  interfaceName: 'DhTestimonialsBlock',
  slug: 'dhTestimonials',
  labels: {
    singular: 'Testimonials (Dark Horse)',
    plural: 'Testimonials (Dark Horse)',
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
