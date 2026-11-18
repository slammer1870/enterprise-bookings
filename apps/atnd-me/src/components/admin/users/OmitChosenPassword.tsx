'use client'

import { useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import * as React from 'react'

import { relaxPasswordField, type PasswordFieldState } from './relaxPasswordField'
import { viewerChoosesUserPassword } from './viewerChoosesUserPassword'

/**
 * Payload 3.84 always mounts required password inputs on user create
 * (`requirePassword: !id`). Field access only hides the "Change password"
 * button. This drops the required check and hides the inputs for tenant
 * roles. The logged-in admin (`useAuth`) decides — not the user document,
 * which is empty on create.
 */
export const OmitChosenPassword: React.FC = () => {
  const { user } = useAuth()
  const choosesPassword = viewerChoosesUserPassword(user)
  const { id } = useDocumentInfo()
  const dispatchFields = useFormFields(([, dispatch]) => dispatch)
  const password = useFormFields(([fields]) => fields.password)
  const confirmPassword = useFormFields(([fields]) => fields['confirm-password'])

  React.useEffect(() => {
    if (choosesPassword) return
    relaxPasswordField(dispatchFields, 'password', password as PasswordFieldState | undefined)
    relaxPasswordField(
      dispatchFields,
      'confirm-password',
      confirmPassword as PasswordFieldState | undefined,
    )
  }, [choosesPassword, confirmPassword, dispatchFields, password])

  if (choosesPassword) return null

  const isCreate = id == null || id === ''

  return (
    <>
      <style>{`
        .collection-edit__auth .auth-fields__changing-password,
        #change-password {
          display: none !important;
        }
      `}</style>
      {isCreate ? (
        <p className="field-description">
          This person chooses their own password. Save the account, then email them a link from
          their user page.
        </p>
      ) : null}
    </>
  )
}

export default OmitChosenPassword
