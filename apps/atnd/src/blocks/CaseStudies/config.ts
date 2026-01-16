import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const CaseStudies: Block = {
  slug: 'caseStudies',
  interfaceName: 'CaseStudiesBlock',
  labels: {
    singular: 'Case Studies',
    plural: 'Case Studies',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Section Heading',
    },
    {
      name: 'description',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: 'Section Description',
    },
    {
      name: 'caseStudies',
      type: 'array',
      label: 'Case Studies',
      minRows: 1,
      fields: [
        {
          name: 'companyName',
          type: 'text',
          required: true,
          label: 'Company Name',
        },
        {
          name: 'companyLogo',
          type: 'upload',
          relationTo: 'media',
          label: 'Company Logo',
          admin: {
            description: 'Logo of the company/client',
          },
        },
        {
          name: 'quote',
          type: 'textarea',
          required: true,
          label: 'Quote/Testimonial',
        },
        {
          name: 'author',
          type: 'group',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Author Name',
            },
            {
              name: 'title',
              type: 'text',
              label: 'Job Title',
            },
            {
              name: 'avatar',
              type: 'upload',
              relationTo: 'media',
              label: 'Author Avatar',
            },
          ],
          label: 'Author',
        },
        {
          name: 'results',
          type: 'array',
          label: 'Key Results',
          fields: [
            {
              name: 'metric',
              type: 'text',
              required: true,
              label: 'Metric (e.g., "200% increase")',
            },
            {
              name: 'description',
              type: 'text',
              required: true,
              label: 'Description (e.g., "in conversion rate")',
            },
          ],
        },
        {
          name: 'link',
          type: 'group',
          fields: [
            {
              name: 'type',
              type: 'radio',
              defaultValue: 'custom',
              options: [
                { label: 'Internal link', value: 'reference' },
                { label: 'Custom URL', value: 'custom' },
              ],
            },
            {
              name: 'reference',
              type: 'relationship',
              relationTo: ['pages', 'posts'],
              admin: {
                condition: (_, siblingData) => siblingData?.type === 'reference',
              },
            },
            {
              name: 'url',
              type: 'text',
              admin: {
                condition: (_, siblingData) => siblingData?.type === 'custom',
              },
            },
            {
              name: 'label',
              type: 'text',
              label: 'Link Label',
              defaultValue: 'Read full case study',
            },
            {
              name: 'newTab',
              type: 'checkbox',
              label: 'Open in new tab',
            },
          ],
        },
      ],
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'grid',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Carousel', value: 'carousel' },
      ],
      label: 'Layout',
    },
    {
      name: 'backgroundColor',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Subtle', value: 'subtle' },
        { label: 'Muted', value: 'muted' },
      ],
      label: 'Background Color',
    },
  ],
}

