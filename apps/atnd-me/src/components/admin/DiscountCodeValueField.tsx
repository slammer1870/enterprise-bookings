'use client'

import React from 'react'
import { FieldDescription, FieldLabel, useField, useFormFields } from '@payloadcms/ui'

type DiscountCodeValueFieldProps = {
  path: string
  field: {
    label?: string
    required?: boolean
    admin?: {
      description?: string
      step?: number
    }
  }
  readOnly?: boolean
}

function getSiblingPath(path: string, sibling: string): string {
  const segments = path.split('.')
  segments[segments.length - 1] = sibling
  return segments.join('.')
}

function getCurrencySymbol(currency: unknown): string {
  switch (currency) {
    case 'eur':
      return 'EUR'
    case 'gbp':
      return 'GBP'
    case 'usd':
      return 'USD'
    default:
      return ''
  }
}

export const DiscountCodeValueField: React.FC<DiscountCodeValueFieldProps> = ({
  path,
  field,
  readOnly = false,
}) => {
  const { value, setValue } = useField<number | null>({ path })

  const typePath = getSiblingPath(path, 'type')
  const currencyPath = getSiblingPath(path, 'currency')

  const typeField = useFormFields(([fields]) => fields[typePath])
  const currencyField = useFormFields(([fields]) => fields[currencyPath])

  const discountType = typeField?.value
  const currency = currencyField?.value
  const suffix = discountType === 'percentage_off' ? '%' : getCurrencySymbol(currency)
  const step = discountType === 'amount_off' ? 0.01 : 1

  return (
    <div className="field-type number">
      <FieldLabel
        label={field.label ?? 'Value'}
        path={path}
        required={field.required}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <input
          id={`field-${path}`}
          type="number"
          inputMode="decimal"
          step={step}
          value={typeof value === 'number' ? value : ''}
          readOnly={readOnly}
          onChange={(event) => {
            const nextValue = event.target.value
            setValue(nextValue === '' ? null : Number(nextValue))
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
        {suffix ? (
          <span
            aria-hidden="true"
            style={{
              minWidth: '3ch',
              color: 'var(--theme-elevation-600)',
              fontWeight: 600,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {field.admin?.description ? (
        <FieldDescription description={field.admin.description} path={path} />
      ) : null}
    </div>
  )
}

export default DiscountCodeValueField
