import type { Config, Plugin } from 'payload'

const PLUGIN_TENANT_SELECTOR_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelector'
const APP_CLEARABLE_SELECTOR_PATH = '@/components/admin/ClearableTenantSelector'

/**
 * Replaces the multi-tenant plugin's TenantSelector in beforeNavLinks with our
 * ClearableTenantSelector so the "Filter by Tenant" control shows the clear (X)
 * button on the dashboard as well as on collection list pages.
 *
 * Must run after multiTenantPlugin.
 */
export const clearableTenantSelectorPlugin: Plugin = (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const beforeNavLinks = config.admin?.components?.beforeNavLinks
  if (!Array.isArray(beforeNavLinks)) return config

  const index = beforeNavLinks.findIndex(
    (entry) =>
      (typeof entry === 'object' && entry?.path === PLUGIN_TENANT_SELECTOR_PATH) ||
      entry === PLUGIN_TENANT_SELECTOR_PATH,
  )
  if (index === -1) return config

  const entry = beforeNavLinks[index]
  const clientProps = typeof entry === 'object' && entry && 'clientProps' in entry ? entry.clientProps : undefined

  const newEntry =
    clientProps != null
      ? { path: APP_CLEARABLE_SELECTOR_PATH, clientProps }
      : APP_CLEARABLE_SELECTOR_PATH

  config.admin = config.admin ?? {}
  config.admin.components = config.admin.components ?? {}
  config.admin.components.beforeNavLinks = beforeNavLinks.map((e, i) => (i === index ? newEntry : e))
  return config
}
