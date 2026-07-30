import type { TextFieldSingleValidation } from 'payload'
import { LinkFeature, type LinkFields } from '@payloadcms/richtext-lexical'

/** Internal doc links limited to pages/posts (not bookings collections like timeslots). */
export const pagesPostsLinkFeature = LinkFeature({
  enabledCollections: ['pages', 'posts'],
  fields: ({ defaultFields }) => {
    const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
      if ('name' in field && field.name === 'url') return false
      return true
    })

    return [
      ...defaultFieldsWithoutUrl,
      {
        name: 'url',
        type: 'text',
        admin: {
          condition: (_data, siblingData) => siblingData?.linkType !== 'internal',
        },
        label: ({ t }) => t('fields:enterURL'),
        required: true,
        validate: ((value, options) => {
          if ((options?.siblingData as LinkFields)?.linkType === 'internal') {
            return true
          }
          return value ? true : 'URL is required'
        }) as TextFieldSingleValidation,
      },
    ]
  },
})
