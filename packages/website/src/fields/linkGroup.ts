import type { ArrayField, Field } from 'payload'
import { link, type LinkAppearances } from './link'

type LinkGroupType = (_options?: {
  appearances?: LinkAppearances[] | false
  colors?: boolean
  overrides?: Partial<ArrayField>
}) => Field

export const linkGroup: LinkGroupType = ({ appearances, colors, overrides = {} } = {}) => {
  const generatedLinkGroup: Field = {
    name: 'links',
    type: 'array',
    fields: [
      link({
        appearances,
        colors,
      }),
    ],
    admin: {
      initCollapsed: true,
    },
  }

  return { ...generatedLinkGroup, ...overrides } as Field
}
