import type { Field, GroupField } from 'payload'
import { hexColorField } from './hexColorField'

export type LinkAppearances = 'default' | 'outline' | 'secondary' | 'ghost' | 'link'

export const appearanceOptions: Record<LinkAppearances, { label: string; value: string }> = {
  default: {
    label: 'Default',
    value: 'default',
  },
  outline: {
    label: 'Outline',
    value: 'outline',
  },
  secondary: {
    label: 'Secondary',
    value: 'secondary',
  },
  ghost: {
    label: 'Ghost',
    value: 'ghost',
  },
  link: {
    label: 'Link',
    value: 'link',
  },
}

type LinkType = (_options?: {
  appearances?: LinkAppearances[] | false
  colors?: boolean
  disableLabel?: boolean
  /** Collections available for internal links. Defaults to pages + posts. */
  relationTo?: string[]
  overrides?: Partial<GroupField>
}) => Field

export const link: LinkType = ({
  appearances,
  colors = true,
  disableLabel = false,
  relationTo = ['pages', 'posts'],
  overrides = {},
} = {}) => {
  const linkResult: GroupField = {
    name: 'link',
    type: 'group',
    admin: {
      hideGutter: true,
    },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'type',
            type: 'radio',
            admin: {
              layout: 'horizontal',
              width: '50%',
            },
            defaultValue: 'reference',
            options: [
              {
                label: 'Internal link',
                value: 'reference',
              },
              {
                label: 'Custom URL',
                value: 'custom',
              },
            ],
          },
          {
            name: 'newTab',
            type: 'checkbox',
            admin: {
              style: {
                alignSelf: 'flex-end',
              },
              width: '50%',
            },
            label: 'Open in new tab',
          },
        ],
      },
    ],
  }

  const linkTypes: Field[] = [
    {
      name: 'reference',
      type: 'relationship',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'reference',
      },
      label: 'Document to link to',
      relationTo: relationTo as ('pages' | 'posts')[],
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'custom',
      },
      label: 'Custom URL',
      required: true,
    },
  ]

  if (!disableLabel) {
    linkResult.fields.push({
      type: 'row',
      fields: [
        ...linkTypes,
        {
          name: 'label',
          type: 'text',
          admin: {
            width: '50%',
          },
          label: 'Label',
          required: true,
        },
      ],
    })
  } else {
    linkResult.fields = [...linkResult.fields, ...linkTypes]
  }

  if (appearances !== false) {
    let appearanceOptionsToUse = [
      appearanceOptions.default,
      appearanceOptions.outline,
      appearanceOptions.secondary,
      appearanceOptions.ghost,
      appearanceOptions.link,
    ]

    if (appearances) {
      appearanceOptionsToUse = appearances.map((appearance) => appearanceOptions[appearance])
    }

    linkResult.fields.push({
      name: 'appearance',
      type: 'select',
      admin: {
        description: 'Choose how the link should be rendered.',
      },
      defaultValue: 'default',
      options: appearanceOptionsToUse,
    })
  }

  if (colors !== false && appearances !== false) {
    linkResult.fields.push({
      type: 'row',
      fields: [
        hexColorField({
          name: 'backgroundColor',
          label: 'Background color',
          description: 'Leave empty to use the theme default for this appearance.',
        }),
        hexColorField({
          name: 'foregroundColor',
          label: 'Text color',
          description: 'Leave empty to use the theme default for this appearance.',
        }),
      ],
    })
  }

  return { ...linkResult, ...overrides } as Field
}
