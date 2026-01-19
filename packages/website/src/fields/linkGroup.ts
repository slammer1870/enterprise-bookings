import type { ArrayField, Field } from 'payload'
import { link } from './link'

type LinkGroupType = (options?: {
  appearances?: import('./link').LinkAppearances[] | false
  overrides?: Partial<ArrayField>
}) => Field

export const linkGroup: LinkGroupType = ({ appearances, overrides = {} } = {}) => {
  const generatedLinkGroup: Field = {
    name: 'links',
    type: 'array',
    fields: [
      link({
        appearances,
      }),
    ],
    admin: {
      initCollapsed: true,
    },
  }

  return { ...generatedLinkGroup, ...overrides } as Field
}
