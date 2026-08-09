import type { Field } from 'payload'
import {
  EMAIL_FROM_ADMIN_DESCRIPTION,
  validateEmailFromField,
} from '@/lib/resend/validateEmailFromField'

/** Attach tenant-domain validate + admin help to an emailFrom text field. */
export function withEmailFromValidation<T extends Field>(field: T): T {
  if (!('name' in field) || field.name !== 'emailFrom' || field.type !== 'text') {
    return field
  }

  return {
    ...field,
    validate: validateEmailFromField,
    admin: {
      ...field.admin,
      description: EMAIL_FROM_ADMIN_DESCRIPTION,
    },
  }
}

/** Recursively patch emailFrom fields inside rows/arrays (e.g. form-builder emails). */
export function withEmailFromValidationInFields(fields: Field[]): Field[] {
  return fields.map((field) => {
    if (field.type === 'row' || field.type === 'array' || field.type === 'group') {
      if (!('fields' in field) || !Array.isArray(field.fields)) return field
      return {
        ...field,
        fields: withEmailFromValidationInFields(field.fields),
      }
    }

    if ('name' in field && field.name === 'emailFrom' && field.type === 'text') {
      return withEmailFromValidation(field)
    }

    return field
  })
}
