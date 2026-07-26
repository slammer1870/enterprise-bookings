import type { Block } from 'payload'

import {
  AlignFeature,
  BlockquoteFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  LinkFeature,
  OrderedListFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

const caseStudyRichTextEditor = lexicalEditor({
  features: ({ rootFeatures }) => {
    return [
      ...rootFeatures,
      AlignFeature(),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
      LinkFeature(),
      UnorderedListFeature(),
      OrderedListFeature(),
      BlockquoteFeature(),
      HorizontalRuleFeature(),
    ]
  },
})

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
      editor: caseStudyRichTextEditor,
      label: 'Section Description',
    },
    {
      name: 'caseStudies',
      type: 'array',
      label: 'Case Studies',
      minRows: 1,
      maxRows: 3,
      labels: {
        singular: 'Case Study',
        plural: 'Case Studies',
      },
      fields: [
        {
          name: 'companyName',
          type: 'text',
          required: true,
          label: 'Company Name',
        },
        {
          name: 'screenshot',
          type: 'upload',
          relationTo: 'media',
          label: 'Screenshot',
          admin: {
            description: 'Website screenshot shown on the card and in the modal',
          },
        },
        {
          name: 'briefDescription',
          type: 'richText',
          required: true,
          label: 'Brief Description',
          editor: caseStudyRichTextEditor,
          admin: {
            description: 'Short summary shown on the card',
          },
        },
        {
          name: 'detailedDescription',
          type: 'richText',
          required: true,
          label: 'Detailed Description',
          editor: caseStudyRichTextEditor,
          admin: {
            description: 'Longer copy shown in the modal',
          },
        },
        {
          name: 'websiteUrl',
          type: 'text',
          required: true,
          label: 'Website URL',
          admin: {
            description: 'Full website link opened in a new tab from the modal',
          },
        },
        {
          name: 'websiteLabel',
          type: 'text',
          label: 'Website Button Label',
          defaultValue: 'Visit website',
        },
      ],
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
