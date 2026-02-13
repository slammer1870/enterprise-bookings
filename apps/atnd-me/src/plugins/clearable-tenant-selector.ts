import type { Config, Plugin } from 'payload'

const PLUGIN_TENANT_SELECTOR_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelector'
const APP_CLEARABLE_SELECTOR_PATH = '@/components/admin/ClearableTenantSelector'

/**
 * Replaces the multi-tenant plugin's TenantSelector in beforeNavLinks with our
 * ClearableTenantSelector.
 *
 * The plugin's selector only enables the clear option when viewType is 'dashboard' or 'list'.
 * On the custom dashboard at /admin, viewType may not be set that way, so the clear option
 * was effectively only available on collection list views. We want "clear tenant and load
 * data for all tenants in aggregate" to be available on the dashboard too, so we swap in
 * a component that always shows a "No tenant" option.
 *
 * Must run after multiTenantPlugin.
 */
export const clearableTenantSelectorPlugin: Plugin = (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const replaceIn = (entries: any) => {
    if (!Array.isArray(entries)) return entries

    const index = entries.findIndex(
      (entry) =>
        (typeof entry === 'object' && entry?.path === PLUGIN_TENANT_SELECTOR_PATH) ||
        entry === PLUGIN_TENANT_SELECTOR_PATH,
    )
    if (index === -1) return entries

    const entry = entries[index]
    const clientProps =
      typeof entry === 'object' && entry && 'clientProps' in entry ? entry.clientProps : undefined

    const newEntry =
      clientProps != null ? { path: APP_CLEARABLE_SELECTOR_PATH, clientProps } : APP_CLEARABLE_SELECTOR_PATH

    return entries.map((e, i) => (i === index ? newEntry : e))
  }

  config.admin = config.admin ?? {}
  config.admin.components = config.admin.components ?? {}

  // Upstream plugin wires TenantSelector into `beforeNav` (not `beforeNavLinks`) in its config.
  // Patch both so we reliably replace it regardless of Payload/admin slot.
  // Payload config type differs by version; treat these as arrays when present.
  ;(config.admin.components as any).beforeNav = replaceIn((config.admin.components as any).beforeNav)
  config.admin.components.beforeNavLinks = replaceIn(config.admin.components.beforeNavLinks)
  return config
}
