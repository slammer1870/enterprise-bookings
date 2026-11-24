'use client'

import { useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import * as React from 'react'

import { relaxPasswordField, type PasswordFieldState } from './relaxPasswordField'
import { viewerChoosesUserPassword } from './viewerChoosesUserPassword'

/**
 * Payload 3.84 always mounts required password inputs on user create
 * (`requirePassword: !id`). Field create permission only gates the "Change
 * password" button — create still renders the inputs. This drops the required
 * check, hides the inputs, clears any value (password managers / force-fill),
 * and strips `name` so a chosen password cannot ride in the create POST.
 * The logged-in admin (`useAuth`) decides — not the user document, which is
 * empty on create.
 */
function neutralizeAuthPasswordInputs(root: ParentNode): void {
  const box = root.querySelector('.auth-fields__changing-password')
  if (!box) return
  box.querySelectorAll('input').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return
    if (input.value) input.value = ''
    input.disabled = true
    input.required = false
    input.removeAttribute('name')
    input.setAttribute('autocomplete', 'off')
  })
}

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
    // Drop any value password managers or scripts put into form state.
    if (password && typeof password === 'object' && 'value' in password && password.value) {
      dispatchFields({ type: 'UPDATE', path: 'password', value: '' } as never)
    }
    if (
      confirmPassword &&
      typeof confirmPassword === 'object' &&
      'value' in confirmPassword &&
      confirmPassword.value
    ) {
      dispatchFields({ type: 'UPDATE', path: 'confirm-password', value: '' } as never)
    }
  }, [choosesPassword, confirmPassword, dispatchFields, password])

  React.useEffect(() => {
    if (choosesPassword) return
    neutralizeAuthPasswordInputs(document)
    const observer = new MutationObserver(() => neutralizeAuthPasswordInputs(document))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [choosesPassword])

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
