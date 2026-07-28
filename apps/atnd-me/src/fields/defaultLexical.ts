import type { TextFieldSingleValidation } from 'payload'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  LinkFeature,
  lexicalEditor,
  type LinkFields,
} from '@payloadcms/richtext-lexical'

import { Banner } from '@/blocks/Banner/config'
import { Code } from '@/blocks/Code/config'
import { EventCheckout } from '@/blocks/EventCheckout/config'
import { GiftVoucherCheckout } from '@/blocks/GiftVoucherCheckout/config'
import { Map } from '@/blocks/Map/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'

export { simpleLexical } from '@/fields/simpleLexical'

const linkFeature = LinkFeature({
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

/**
 * Single shared rich-text editor for atnd-me.
 * Includes Payload defaults (paragraphs, lists, bold/italic, align, …) plus
 * headings, Banner/Code/Media/EventCheckout/GiftVoucherCheckout/Map blocks, toolbars, and horizontal rules.
 *
 * Use as `editor: defaultLexical` on richText fields and as `payload.config.editor`.
 * For nested editors inside those blocks, use `simpleLexical` instead.
 */
export const defaultLexical = lexicalEditor({
  features: ({ defaultFeatures }) => {
    const withoutLink = defaultFeatures.filter((feature) => {
      const key = (feature as { key?: string } | null | undefined)?.key
      return key !== 'link'
    })

    return [
      ...withoutLink,
      linkFeature,
      HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
      BlocksFeature({
        blocks: [Banner, Code, MediaBlock, EventCheckout, GiftVoucherCheckout, Map],
      }),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
      HorizontalRuleFeature(),
    ]
  },
})
