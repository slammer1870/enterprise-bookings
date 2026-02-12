import { ClearableTenantSelectorClient } from './ClearableTenantSelectorClient'

type Props = {
  label?: string
  enabledSlugs?: string[]
}

/**
 * RSC wrapper for ClearableTenantSelectorClient. Replaces the plugin's
 * TenantSelector in beforeNavLinks so the tenant filter is clearable on
 * the dashboard (viewType is not passed here; we always show clear).
 */
export const ClearableTenantSelector: React.FC<Props> = ({ label }) => {
  return <ClearableTenantSelectorClient label={label} />
}

export default ClearableTenantSelector
