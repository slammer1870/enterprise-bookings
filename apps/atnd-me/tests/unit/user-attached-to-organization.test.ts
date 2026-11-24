import { describe, expect, it } from 'vitest'
import { ValidationError } from 'payload'

import { fixBetterAuthAfterReadHooks } from '../../src/plugins/fix-better-auth-after-read-hooks'
import {
  attachedUserCreateResponse,
  UserAttachedToOrganizationError,
} from '../../src/collections/Users/userAttachedToOrganization'

describe('attachedUserCreateResponse', () => {
  it('rewrites a successful attach into a create response the admin form redirects from', () => {
    const result = attachedUserCreateResponse({
      error: new UserAttachedToOrganizationError(9),
    } as never)

    expect(result).toEqual({
      status: 200,
      response: {
        message: 'This person has been added to your organization.',
        doc: { id: 9 },
      },
    })
  })

  it('leaves already-a-member validation errors unchanged', () => {
    const error = new ValidationError({
      errors: [
        {
          path: 'email',
          message:
            'This email already belongs to someone in your organization. Open the users list to find them.',
        },
      ],
    })

    expect(attachedUserCreateResponse({ error } as never)).toBeUndefined()
  })

  it('is re-attached once after Better Auth drops Users afterError', () => {
    const config = fixBetterAuthAfterReadHooks()({
      collections: [
        {
          slug: 'users',
          fields: [],
          hooks: { beforeChange: [] },
        },
      ],
    } as never)

    const users = config.collections?.find((collection) => collection.slug === 'users')
    const afterError = users?.hooks?.afterError ?? []
    expect(afterError.filter((hook) => hook === attachedUserCreateResponse)).toHaveLength(1)
  })
})
