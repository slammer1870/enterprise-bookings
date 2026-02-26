import React from 'react'
import type { ViewTypes } from 'payload'
import { ClearableTenantSelectorClient } from './ClearableTenantSelectorClient'

type Props = {
  disabled?: boolean
  label?: unknown
  viewType?: ViewTypes
}

export function ClearableTenantSelector({ disabled, label, viewType }: Props) {
  return (
    <ClearableTenantSelectorClient
      disabled={disabled}
      label={label}
      viewType={viewType}
    />
  )
}

export default ClearableTenantSelector
