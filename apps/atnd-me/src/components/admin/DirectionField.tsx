'use client'

import { FieldDescription, FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import type { SelectFieldClientComponent } from 'payload'
import React from 'react'
import {
  DIRECTION_CHOICES,
  directionRefusal,
  parseDirection,
  type Direction,
} from '@/utilities/hostnameDirection'

function siblingPath(path: string, sibling: string): string {
  const segments = path.split('.')
  segments[segments.length - 1] = sibling
  return segments.join('.')
}

function hostnamesInForm(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((hostname): hostname is string => typeof hostname === 'string' && hostname !== '')
}

export const DirectionField: SelectFieldClientComponent = ({ path, field, readOnly = false }) => {
  const { value, setValue } = useField<Direction | null>({ path })
  const hostnameValue = useFormFields(([fields]) => fields[siblingPath(path, 'hostnames')]?.value)
  const hostnames = hostnamesInForm(hostnameValue)
  const selected = parseDirection(value)

  return (
    <fieldset style={{ border: 0, margin: 0, padding: '12px 0' }}>
      <FieldLabel label={typeof field.label === 'string' ? field.label : 'Direction'} path={path} required={field.required} />
      <div role="radiogroup" aria-label="Direction">
        {DIRECTION_CHOICES.map((choice) => {
          const unavailable = directionRefusal(hostnames, choice.value) !== null
          return (
            <label key={choice.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="radio"
                name={path}
                value={choice.value}
                checked={selected === choice.value}
                disabled={readOnly || unavailable}
                onChange={() => {
                  if (unavailable) return
                  setValue(choice.value)
                }}
              />
              {choice.label}
            </label>
          )
        })}
      </div>
      {field.admin?.description ? <FieldDescription description={field.admin.description} path={path} /> : null}
    </fieldset>
  )
}
