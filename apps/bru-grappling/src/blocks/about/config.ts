import type { Block } from 'payload'

export const About: Block = {
  slug: 'about',
  fields: [
    {
      name: 'sections',
      type: 'array',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'content',
          type: 'array',
          fields: [
            {
              name: 'text',
              type: 'text',
            },
            {
              name: 'link',
              type: 'group',
              fields: [
                {
                  name: 'url',
                  type: 'text',
                },
                {
                  name: 'text',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'imagePosition',
          type: 'select',
          options: [
            {
              label: 'Left',
              value: 'left',
            },
            {
              label: 'Right',
              value: 'right',
            },
          ],
          defaultValue: 'right',
        },
      ],
    },
  ],
}
