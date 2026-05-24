'use client'

import React, { useMemo } from 'react'
import { useFormFields } from '@payloadcms/ui'

import {
  BOOKING_BUTTON_PREVIEW_LABELS,
  PLATFORM_BOOKING_THEME_COLORS,
} from '@/utilities/bookingThemePreview'
import {
  BOOKING_THEME_STATE_KEYS,
  type BookingThemeStateKey,
  type TenantBookingTheme,
} from '@/utilities/bookingThemeTypes'
import { resolveTailwindColorToken } from '@/utilities/tailwindColorTokens'

function PreviewButton({
  label,
  background,
  foreground,
  muted = false,
}: {
  label: string
  background: string
  foreground: string
  muted?: boolean
}) {
  return (
    <button
      type="button"
      disabled
      style={{
        minWidth: '120px',
        padding: '8px 12px',
        borderRadius: '6px',
        border: 'none',
        background,
        color: foreground,
        fontSize: '13px',
        fontWeight: 600,
        opacity: muted ? 0.55 : 1,
        cursor: 'default',
      }}
    >
      {label}
    </button>
  )
}

export const BookingThemePreviewField: React.FC = () => {
  const bookingTheme = useFormFields(
    ([fields]) => fields.bookingTheme?.value as TenantBookingTheme | undefined,
  )

  const previews = useMemo(() => {
    return BOOKING_THEME_STATE_KEYS.map((state) => {
      const colors = bookingTheme?.[state]
      const defaults = PLATFORM_BOOKING_THEME_COLORS[state as BookingThemeStateKey]

      const background =
        resolveTailwindColorToken(colors?.backgroundColor) ??
        resolveTailwindColorToken(defaults.backgroundColor) ??
        '#64748b'
      const foreground =
        resolveTailwindColorToken(colors?.foregroundColor) ??
        resolveTailwindColorToken(defaults.foregroundColor) ??
        '#ffffff'

      return {
        state,
        label: BOOKING_BUTTON_PREVIEW_LABELS[state as BookingThemeStateKey],
        background,
        foreground,
        usesDefault: !colors?.backgroundColor?.trim() && !colors?.foregroundColor?.trim(),
      }
    })
  }, [bookingTheme])

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--theme-elevation-150)',
        background: 'var(--theme-elevation-50)',
      }}
    >
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--theme-text)',
          marginBottom: '4px',
        }}
      >
        Live preview
      </div>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: '13px',
          color: 'var(--theme-elevation-600)',
        }}
      >
        How schedule booking buttons will look on your public site. Empty fields use platform defaults.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {previews.map((preview) => (
          <div key={preview.state} style={{ display: 'grid', gap: '4px', justifyItems: 'center' }}>
            <PreviewButton
              label={preview.label}
              background={preview.background}
              foreground={preview.foreground}
              muted={preview.usesDefault}
            />
            <span style={{ fontSize: '11px', color: 'var(--theme-elevation-500)' }}>
              {preview.usesDefault ? 'Default' : 'Custom'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BookingThemePreviewField
