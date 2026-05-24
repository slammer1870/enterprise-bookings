'use client'

import React, { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'

import {
  BOOKING_COLOR_PRESETS,
  normalizeHexForColorInput,
  resolveTailwindColorToken,
} from '@/utilities/tailwindColorTokens'

import './BookingThemeColorField.css'

type BookingThemeColorFieldProps = {
  path: string
  field: {
    label?: string
    required?: boolean
    admin?: {
      description?: string
    }
  }
  readOnly?: boolean
}

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>
}

function supportsEyeDropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window
}

function EyedropperIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 22 1-1h3l9-9" />
      <path d="M15 6l3 3" />
      <path d="m18 3 3 3a2.1 2.1 0 0 1 0 3l-8.8 8.8a2 2 0 0 1-2.8 0L6.7 12.3a2 2 0 0 1 0-2.8L15.5 1" />
    </svg>
  )
}

export const BookingThemeColorField: React.FC<BookingThemeColorFieldProps> = ({
  path,
  field,
  readOnly = false,
}) => {
  const { value, setValue } = useField<string | null>({ path })
  const [open, setOpen] = useState(false)
  const [pickerHex, setPickerHex] = useState('#22c55e')
  const rootRef = useRef<HTMLDivElement>(null)

  const storedValue = typeof value === 'string' ? value.trim() : ''
  const resolvedHex = resolveTailwindColorToken(storedValue)
  const displayHex = resolvedHex ?? null
  const canUseEyeDropper = supportsEyeDropper()

  useEffect(() => {
    if (!open) return

    setPickerHex(normalizeHexForColorInput(resolvedHex ?? '#22c55e'))

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, resolvedHex])

  const applyColor = (next: string | null) => {
    if (readOnly) return
    setValue(next)
    if (next) {
      const hex = resolveTailwindColorToken(next)
      if (hex) setPickerHex(normalizeHexForColorInput(hex))
    }
  }

  const applyHex = (hex: string) => {
    const normalized = normalizeHexForColorInput(hex)
    setPickerHex(normalized)
    applyColor(normalized)
  }

  const onHexInputChange = (raw: string) => {
    const next = raw.startsWith('#') ? raw : `#${raw}`
    setPickerHex(next)

    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(next)) {
      applyColor(normalizeHexForColorInput(next))
    }
  }

  const pickFromScreen = async () => {
    if (readOnly || !canUseEyeDropper) return

    try {
      const EyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper
      if (!EyeDropper) return

      const dropper = new EyeDropper()
      const result = await dropper.open()
      applyHex(result.sRGBHex)
    } catch {
      // User cancelled the eyedropper.
    }
  }

  const triggerLabel = displayHex ?? 'Platform default'

  return (
    <div className="field-type text booking-theme-color-field" ref={rootRef} style={{ position: 'relative' }}>
      <FieldLabel label={field.label ?? 'Color'} path={path} required={field.required} />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setOpen((current) => !current)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '220px',
            minHeight: '40px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid var(--theme-elevation-150)',
            background: displayHex ?? 'var(--theme-input-bg)',
            color: storedValue ? 'var(--theme-text)' : 'var(--theme-elevation-500)',
            cursor: readOnly ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              border: '1px solid var(--theme-elevation-150)',
              background:
                displayHex ??
                'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px',
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {triggerLabel}
          </span>
        </button>

        {storedValue ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => applyColor(null)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--theme-elevation-600)',
              cursor: readOnly ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label={`Pick ${field.label ?? 'color'}`}
          className="booking-theme-color-field__dialog"
        >
          <div className="booking-theme-color-picker">
            <HexColorPicker color={pickerHex} onChange={applyHex} />
          </div>

          <div className="booking-theme-color-field__controls">
            <input
              type="text"
              value={pickerHex}
              disabled={readOnly}
              onChange={(event) => onHexInputChange(event.target.value)}
              aria-label="Hex color value"
              spellCheck={false}
              className="booking-theme-color-field__hex-input"
            />

            {canUseEyeDropper ? (
              <button
                type="button"
                disabled={readOnly}
                onClick={pickFromScreen}
                title="Pick color from screen"
                aria-label="Pick color from screen"
                className="booking-theme-color-field__eyedropper"
              >
                <EyedropperIcon />
              </button>
            ) : null}
          </div>

          <div className="booking-theme-color-field__presets">
            {BOOKING_COLOR_PRESETS.map((option) => (
              <button
                key={option.token}
                type="button"
                title={`${option.token} (${option.hex})`}
                aria-label={`${option.token} (${option.hex})`}
                disabled={readOnly}
                onClick={() => applyColor(option.token)}
                className="booking-theme-color-field__preset"
                style={{ backgroundColor: option.hex }}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              applyColor(null)
              setOpen(false)
            }}
            className="booking-theme-color-field__default"
          >
            Use platform default
          </button>
        </div>
      ) : null}

      {field.admin?.description ? (
        <FieldDescription description={field.admin.description} path={path} />
      ) : null}
    </div>
  )
}

export default BookingThemeColorField
