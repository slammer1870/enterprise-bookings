'use client'

import { Button, toast, useAuth, useConfig, useDocumentInfo } from '@payloadcms/ui'
import * as React from 'react'

import { shouldShowSetPasswordEmailButton } from './shouldShowSetPasswordEmailButton'

export const SendSetPasswordEmailButton: React.FC = () => {
  const { user } = useAuth()
  const { id, docPermissions } = useDocumentInfo()
  const { config } = useConfig()
  const [pending, setPending] = React.useState(false)

  const docId = typeof id === 'string' || typeof id === 'number' ? String(id) : ''
  if (
    !shouldShowSetPasswordEmailButton({
      user,
      docId,
      updatePermission: docPermissions?.update,
    })
  ) {
    return null
  }

  const send = async () => {
    setPending(true)
    try {
      const api = config?.routes?.api || '/api'
      const res = await fetch(`${api}/users/${encodeURIComponent(docId)}/send-set-password-email`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        errors?: Array<{ message?: string }>
      }
      if (!res.ok) {
        throw new Error(
          data.errors?.[0]?.message || data.message || 'Could not send the set-password email.',
        )
      }
      toast.success('Sent a link so they can set their password.')
    } catch (error) {
      toast.error((error as Error).message || 'Could not send the set-password email.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="field-type">
      <p className="field-label">Password</p>
      <Button
        buttonStyle="secondary"
        disabled={pending}
        onClick={() => void send()}
        size="medium"
        type="button"
      >
        {pending ? 'Sending…' : 'Send set password email'}
      </Button>
      <p className="field-description">
        Emails a link so this person can choose their own password.
      </p>
    </div>
  )
}

export default SendSetPasswordEmailButton
