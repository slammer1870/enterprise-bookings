import { APIError } from 'payload'
import type { CollectionAfterErrorHook } from 'payload'

export const USER_ATTACHED_TO_ORGANIZATION = 'userAttachedToOrganization'

export type UserAttachedToOrganizationData = {
  code: typeof USER_ATTACHED_TO_ORGANIZATION
  userId: number | string
}

/**
 * Thrown after a cross-tenant email is attached, so the create does not insert
 * a second user. The admin REST handler rewrites this into a successful create
 * response (see `attachedUserCreateResponse`) and the edit view redirects to
 * that user's page. Local API callers still receive the error.
 */
export class UserAttachedToOrganizationError extends APIError<UserAttachedToOrganizationData> {
  constructor(userId: number | string) {
    super(
      'This person already has an account and has been added to your organization.',
      400,
      { code: USER_ATTACHED_TO_ORGANIZATION, userId },
      true,
    )
  }
}

export function isUserAttachedToOrganizationError(
  error: unknown,
): error is UserAttachedToOrganizationError {
  if (!error || typeof error !== 'object') return false
  const data = (error as { data?: { code?: unknown; userId?: unknown } }).data
  return (
    data?.code === USER_ATTACHED_TO_ORGANIZATION &&
    (typeof data.userId === 'number' || (typeof data.userId === 'string' && data.userId.length > 0))
  )
}

const ADDED_MESSAGE = 'This person has been added to your organization.'

/**
 * Admin create posts to the users REST endpoint and redirects when the
 * response is HTTP < 400 and includes `doc.id`. Rewrite this attach into that
 * shape so the tenant admin lands on the existing user's edit page.
 */
export const attachedUserCreateResponse: CollectionAfterErrorHook = ({ error }) => {
  if (!isUserAttachedToOrganizationError(error)) return
  return {
    status: 200,
    response: {
      message: ADDED_MESSAGE,
      doc: { id: error.data.userId },
    },
  }
}
