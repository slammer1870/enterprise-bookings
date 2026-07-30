import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { pagesPostsLinkFeature } from '@/fields/lexicalLinkFeature'

/**
 * Nested / caption rich text — no BlocksFeature (avoids Banner → Banner recursion
 * and circular imports with defaultLexical).
 * Still gets lists, bold/italic, etc. from Payload defaultFeatures.
 * Replaces the default LinkFeature so internal links only target pages/posts.
 */
export const simpleLexical = lexicalEditor({
  features: ({ defaultFeatures }) => {
    const withoutLink = defaultFeatures.filter((feature) => {
      const key = (feature as { key?: string } | null | undefined)?.key
      return key !== 'link'
    })

    return [...withoutLink, pagesPostsLinkFeature, FixedToolbarFeature(), InlineToolbarFeature()]
  },
})
