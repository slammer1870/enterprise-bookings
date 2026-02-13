import { ClearableTenantSelectorClient } from './ClearableTenantSelectorClient'
import type { ViewTypes } from 'payload'

type Props = {
  /** Allow disabling selector (matches plugin prop surface). */
  disabled?: boolean
  label?: string
  enabledSlugs?: string[]
  /** Provided by Payload when rendering admin components. */
  viewType?: ViewTypes
}

/**
 * RSC wrapper for ClearableTenantSelectorClient. Replaces the plugin's
 * TenantSelector so the "No tenant" (clear) option is always available,
 * including on the custom dashboard at /admin. The plugin only shows clear
 * when viewType is 'dashboard' or 'list', and custom views may not get that.
 */
export const ClearableTenantSelector: React.FC<Props> = ({ disabled, label, viewType }) => {
  return <ClearableTenantSelectorClient disabled={disabled} label={label} viewType={viewType} />
}

export default ClearableTenantSelector
