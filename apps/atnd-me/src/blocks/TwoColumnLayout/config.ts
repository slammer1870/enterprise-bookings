import type { Block, Field } from 'payload'

// Helper to create conditional fields based on blockType
const createBlockFields = (blockTypeFieldName: string = 'blockType'): Field[] => {
  return [
    // About block fields
    {
      name: 'aboutTitle',
      type: 'text',
      defaultValue: 'About Us',
      admin: {
        condition: (data, siblingData) => {
          const parentBlockType = siblingData?.[blockTypeFieldName]
          return parentBlockType === 'about'
        },
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'about',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'about',
      },
    },
    // Location fields
    {
      name: 'locationTitle',
      type: 'text',
      defaultValue: 'Location',
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'location',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'location',
      },
    },
    {
      name: 'address',
      type: 'text',
      required: true,
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'location',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'location',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'location',
      },
    },
    {
      name: 'mapEmbedUrl',
      type: 'text',
      admin: {
        description: 'Google Maps embed URL or iframe src',
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'location',
      },
    },
    // FAQs fields
    {
      name: 'faqs',
      type: 'array',
      required: true,
      admin: {
        condition: (data, siblingData) => siblingData?.[blockTypeFieldName] === 'faqs',
      },
      fields: [
        {
          name: 'question',
          type: 'text',
          required: true,
        },
        {
          name: 'answer',
          type: 'text',
          required: true,
        },
      ],
    },
  ]
}

export const TwoColumnLayout: Block = {
  slug: 'twoColumnLayout',
  interfaceName: 'TwoColumnLayoutBlock',
  labels: {
    singular: 'Two Column Layout',
    plural: 'Two Column Layouts',
  },
  fields: [
    {
      name: 'leftColumn',
      type: 'group',
      label: 'Left Column',
      fields: [
        {
          name: 'blockType',
          type: 'select',
          required: true,
          options: [
            { label: 'About', value: 'about' },
            { label: 'Schedule', value: 'schedule' },
            { label: 'Location', value: 'location' },
            { label: 'FAQs', value: 'faqs' },
          ],
        },
        ...createBlockFields('blockType'),
      ],
    },
    {
      name: 'rightColumn',
      type: 'array',
      label: 'Right Column Blocks',
      fields: [
        {
          name: 'blockType',
          type: 'select',
          required: true,
          options: [
            { label: 'About', value: 'about' },
            { label: 'Schedule', value: 'schedule' },
            { label: 'Location', value: 'location' },
            { label: 'FAQs', value: 'faqs' },
          ],
        },
        ...createBlockFields('blockType'),
      ],
    },
    {
      name: 'fullWidth',
      type: 'group',
      label: 'Full Width Block (Below Columns)',
      fields: [
        {
          name: 'blockType',
          type: 'select',
          required: true,
          options: [
            { label: 'About', value: 'about' },
            { label: 'Schedule', value: 'schedule' },
            { label: 'Location', value: 'location' },
            { label: 'FAQs', value: 'faqs' },
          ],
        },
        ...createBlockFields('blockType'),
      ],
    },
  ],
}
