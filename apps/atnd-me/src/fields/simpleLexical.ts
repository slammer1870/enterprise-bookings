import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * Nested / caption rich text — no BlocksFeature (avoids Banner → Banner recursion
 * and circular imports with defaultLexical).
 * Still gets lists, bold/italic, links, etc. from Payload defaultFeatures.
 */
export const simpleLexical = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
})
