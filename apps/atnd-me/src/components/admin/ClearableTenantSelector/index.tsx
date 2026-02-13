import { ClearableTenantSelectorClient } from './ClearableTenantSelectorClient'
import type { ViewTypes } from 'payload'

type Props = {
  /** Allow disabling selector (matches plugin prop surface). */
  disabled?: boolean
  label?: unknown
  enabledSlugs?: string[]
  /** Provided by Payload when rendering admin components. */
  viewType?: ViewTypes
}

/**
 * RSC wrapper for ClearableTenantSelectorClient. Replaces the plugin's
 * TenantSelector so the clear (X) is also available on the custom dashboard
 * at /admin (Payload may pass an undefined viewType for custom views).
 */
export const ClearableTenantSelector: React.FC<Props> = ({ disabled, label, viewType }) => {
  return <ClearableTenantSelectorClient disabled={disabled} label={label} viewType={viewType} />
}

export default ClearableTenantSelector
