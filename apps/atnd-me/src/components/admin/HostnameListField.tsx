'use client'

import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'
import type { JSONFieldClientComponent } from 'payload'
import React, { useEffect, useRef } from 'react'

/** What the admin typed, as stored hostnames. A trailing comma is not a hostname yet. */
export function parseHostnameListText(text: string): string[] {
  const hostnames: string[] = []
  for (const part of text.split(',')) {
    const hostname = part.trim().toLowerCase()
    if (hostname) hostnames.push(hostname)
  }
  return hostnames
}

export function formatHostnameList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((hostname): hostname is string => typeof hostname === 'string' && hostname !== '').join(', ')
}

export const HostnameListField: JSONFieldClientComponent = ({ path, field, readOnly = false }) => {
  const { value, setValue } = useField<unknown>({ path })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input || document.activeElement === input) return
    const next = formatHostnameList(value)
    if (input.value !== next) input.value = next
  }, [value])

  return (
    <div className="field-type text">
      <FieldLabel label={typeof field.label === 'string' ? field.label : 'Hostnames'} path={path} required={field.required} />
      <input
        ref={inputRef}
        id={`field-${path}`}
        aria-label="Hostnames"
        defaultValue={formatHostnameList(value)}
        readOnly={readOnly}
        onInput={(event) => {
          setValue(parseHostnameListText(event.currentTarget.value))
        }}
        onBlur={(event) => {
          if (!Array.isArray(value) && event.currentTarget.value.trim() === '') return
          const parsed = parseHostnameListText(event.currentTarget.value)
          setValue(parsed)
          event.currentTarget.value = parsed.join(', ')
        }}
        style={{
          width: '100%',
          minHeight: '40px',
          padding: '0 12px',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '4px',
          background: 'var(--theme-input-bg)',
          color: 'var(--theme-text)',
        }}
      />
      {field.admin?.description ? <FieldDescription description={field.admin.description} path={path} /> : null}
    </div>
  )
}
