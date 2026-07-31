import type { Field, GroupField } from 'payload'
import {
  link as baseLink,
  appearanceOptions as baseAppearanceOptions,
  type LinkAppearances as BaseLinkAppearances,
} from '@repo/website'

import deepMerge from '@/utilities/deepMerge'

export type LinkAppearances = BaseLinkAppearances

export const appearanceOptions = baseAppearanceOptions

type LinkType = (options?: {
  appearances?: LinkAppearances[] | false
  colors?: boolean
  disableLabel?: boolean
  publishedOnly?: boolean
  overrides?: Partial<GroupField>
}) => Field

export const link: LinkType = ({
  appearances,
  colors,
  disableLabel = false,
  publishedOnly = false,
  overrides = {},
} = {}) => {
  const field = baseLink({
    appearances,
    colors,
    disableLabel,
  }) as GroupField

  if (publishedOnly) {
    const referenceField = findReferenceField(field)
    if (referenceField && referenceField.type === 'relationship') {
      referenceField.filterOptions = ({ relationTo }: { relationTo?: string }) => {
        if (relationTo === 'pages' || relationTo === 'posts') {
          return {
            _status: { equals: 'published' },
            slug: { exists: true },
          }
        }
        return true
      }
    }
  }

  return deepMerge(field, overrides)
}

function findReferenceField(group: GroupField): Field | undefined {
  for (const field of group.fields) {
    if ('name' in field && field.name === 'reference') return field
    if (field.type === 'row' && 'fields' in field) {
      const nested = field.fields.find((f) => 'name' in f && f.name === 'reference')
      if (nested) return nested
    }
  }
  return undefined
}
