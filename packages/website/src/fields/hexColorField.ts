import type { Field, TextField } from 'payload'

type HexColorFieldOptions = {
  name: string
  label?: string
  description?: string
  overrides?: Partial<TextField>
}

/** Payload text field with the shared HexColorField admin picker. */
export function hexColorField({
  name,
  label = 'Color',
  description,
  overrides = {},
}: HexColorFieldOptions): Field {
  return {
    name,
    type: 'text',
    label,
    admin: {
      description,
      components: {
        Field: '@repo/website/src/admin/HexColorField#HexColorField',
      },
    },
    ...overrides,
  } as Field
}
