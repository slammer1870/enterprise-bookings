import { Block } from 'payload'

export const Hero: Block = {
  slug: 'hero',
  labels: {
    singular: 'Hero',
    plural: 'Heroes',
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
    {
      type: 'row',
      fields: [
        {
          name: 'cta1_text',
          type: 'text',
          required: true,
          label: 'CTA 1 Text',
          defaultValue: 'Kids',
        },
        {
          name: 'cta1_link',
          type: 'text',
          required: true,
          label: 'CTA 1 Link',
          defaultValue: '#kids',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cta2_text',
          type: 'text',
          required: true,
          label: 'CTA 2 Text',
          defaultValue: 'Adults',
        },
        {
          name: 'cta2_link',
          type: 'text',
          required: true,
          label: 'CTA 2 Link',
          defaultValue: '#adults',
        },
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
