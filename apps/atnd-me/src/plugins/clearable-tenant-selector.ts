import type { Config, Plugin } from 'payload'

const PLUGIN_TENANT_SELECTOR_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelector'
const APP_CLEARABLE_SELECTOR_PATH = '@/components/admin/ClearableTenantSelector'

const PLUGIN_GLOBAL_VIEW_REDIRECT_PATH = '@payloadcms/plugin-multi-tenant/rsc#GlobalViewRedirect'
const APP_GLOBAL_VIEW_REDIRECT_ROOT_AWARE_PATH =
  '@/components/admin/GlobalViewRedirectRootAware#GlobalViewRedirectRootAware'

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
 *
 * Also replaces the plugin's GlobalViewRedirect with GlobalViewRedirectRootAware so that
 * when editing the root footer/navbar (no tenant), saving does not redirect to the first
 * tenant's doc (which would show an empty form).
 */
export const clearableTenantSelectorPlugin: Plugin = (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const replaceTenantSelectorIn = (entries: any) => {
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

  // Replace GlobalViewRedirect action with our root-aware version (footer/navbar with no tenant).
  const actions = (config.admin.components as any).actions
  if (Array.isArray(actions)) {
    const idx = actions.findIndex(
      (entry: any) =>
        (typeof entry === 'object' && entry?.path === PLUGIN_GLOBAL_VIEW_REDIRECT_PATH) ||
        entry === PLUGIN_GLOBAL_VIEW_REDIRECT_PATH,
    )
    if (idx !== -1) {
      const entry = actions[idx]
      const serverProps =
        typeof entry === 'object' && entry && 'serverProps' in entry ? entry.serverProps : undefined
      const newEntry =
        serverProps != null
          ? { path: APP_GLOBAL_VIEW_REDIRECT_ROOT_AWARE_PATH, serverProps }
          : APP_GLOBAL_VIEW_REDIRECT_ROOT_AWARE_PATH
      ;(config.admin.components as any).actions = actions.map((e: any, i: number) =>
        i === idx ? newEntry : e,
      )
    }
  }

  // Upstream plugin wires TenantSelector into `beforeNav` (not `beforeNavLinks`) in its config.
  // Patch both so we reliably replace it regardless of Payload/admin slot.
  // Payload config type differs by version; treat these as arrays when present.
  ;(config.admin.components as any).beforeNav = replaceTenantSelectorIn(
    (config.admin.components as any).beforeNav,
  )
  config.admin.components.beforeNavLinks = replaceTenantSelectorIn(
    config.admin.components.beforeNavLinks,
  )
  return config
}
