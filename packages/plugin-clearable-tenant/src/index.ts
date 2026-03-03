import type { CollectionConfig, Config, Plugin } from 'payload'
import { createSyncTenantFromSelectorHook } from './server/hooks/syncTenantFromSelector'
import { createPopulateTenantOptionsHandler } from './server/endpoints/populate-tenant-options'
import { replaceInEntries } from './shared/replaceAdminComponents'

export { getEffectiveTenantIdWhenClearing } from './shared/clearBehavior'
export {
  getPayloadTenantCookieDomainDefault,
  setPayloadTenantCookie,
  deleteTenantCookie,
  getTenantCookie,
} from './shared/cookieHelpers'
export {
  createPathHelpers,
  isTenantRequiredCreatePath,
  isCreateRequireTenantForTenantAdminPath,
  getCollectionEditParams,
  isOptionalTenantCollectionRoute,
} from './shared/pathHelpers'
export type { PathHelpersOptions, OptionalTenantRouteOptions } from './shared/pathHelpers'

export type ClearableTenantPluginOptions = {
  rootDocCollections?: string[]
  collectionsRequireTenantOnCreate?: string[] | Set<string>
  collectionsCreateRequireTenantForTenantAdmin?: string[] | Set<string>
  /** Collection slugs that have an assigned tenant field; on edit, selector is synced from doc. */
  collectionsWithTenantField?: string[]
  /** Name of the tenant field on documents (default 'tenant'). */
  documentTenantFieldName?: string
  getCookieDomain?: () => string | undefined
  userHasAccessToAllTenants?: (user: unknown) => boolean | Promise<boolean>
  tenantsCollectionSlug?: string
}

const PLUGIN_TENANT_SELECTOR_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelector'
const PLUGIN_PROVIDER_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider'
const PLUGIN_GLOBAL_VIEW_REDIRECT_PATH = '@payloadcms/plugin-multi-tenant/rsc#GlobalViewRedirect'

const PACKAGE_SELECTOR_PATH = '@repo/plugin-clearable-tenant/rsc#ClearableTenantSelector'
const PACKAGE_PROVIDER_PATH = '@repo/plugin-clearable-tenant/rsc#TenantSelectionProviderRootAware'
const PACKAGE_GLOBAL_VIEW_REDIRECT_PATH =
  '@repo/plugin-clearable-tenant/rsc#GlobalViewRedirectRootAware'

type AdminEntry = { path?: string; serverProps?: Record<string, unknown> } | string

/**
 * Payload plugin: replaces multi-tenant's TenantSelector with a clearable one,
 * and TenantSelectionProvider / GlobalViewRedirect with root-aware versions.
 * Must run after multiTenantPlugin.
 */
export const clearableTenantPlugin =
  (_options: ClearableTenantPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    config.admin = config.admin ?? {}
    config.admin.components = config.admin.components ?? {}
    const comp = config.admin.components as Record<string, unknown>

    comp.beforeNav = replaceInEntries(
      comp.beforeNav,
      PLUGIN_TENANT_SELECTOR_PATH,
      PACKAGE_SELECTOR_PATH,
      'client',
    )
    comp.beforeNavLinks = replaceInEntries(
      comp.beforeNavLinks,
      PLUGIN_TENANT_SELECTOR_PATH,
      PACKAGE_SELECTOR_PATH,
      'client',
    )
    // Merge plugin options into provider serverProps so the root-aware provider receives them
    const providersArr = Array.isArray(comp.providers) ? comp.providers : []
    const providerIdx = providersArr.findIndex(
      (e: AdminEntry) =>
        (typeof e === 'object' && e?.path === PLUGIN_PROVIDER_PATH) || e === PLUGIN_PROVIDER_PATH,
    )
    if (providerIdx !== -1) {
      const entry = providersArr[providerIdx] as { path?: string; serverProps?: Record<string, unknown> }
      const existing = typeof entry === 'object' && entry?.serverProps ? entry.serverProps : {}
      const merged = {
        ...existing,
        rootDocCollections: _options.rootDocCollections ?? ['navbar', 'footer'],
        collectionsRequireTenantOnCreate:
          _options.collectionsRequireTenantOnCreate != null
            ? Array.from(
                _options.collectionsRequireTenantOnCreate instanceof Set
                  ? _options.collectionsRequireTenantOnCreate
                  : _options.collectionsRequireTenantOnCreate,
              )
            : [],
        collectionsCreateRequireTenantForTenantAdmin:
          _options.collectionsCreateRequireTenantForTenantAdmin != null
            ? Array.from(
                _options.collectionsCreateRequireTenantForTenantAdmin instanceof Set
                  ? _options.collectionsCreateRequireTenantForTenantAdmin
                  : _options.collectionsCreateRequireTenantForTenantAdmin,
              )
            : ['pages', 'navbar', 'footer'],
        collectionsWithTenantField: _options.collectionsWithTenantField ?? [],
        documentTenantFieldName: _options.documentTenantFieldName ?? 'tenant',
        getCookieDomain: _options.getCookieDomain,
        userHasAccessToAllTenants: _options.userHasAccessToAllTenants,
      }
      comp.providers = providersArr.map((e: AdminEntry, i: number) =>
        i === providerIdx ? { path: PACKAGE_PROVIDER_PATH, serverProps: merged } : e,
      )
    } else {
      comp.providers = replaceInEntries(
        comp.providers,
        PLUGIN_PROVIDER_PATH,
        PACKAGE_PROVIDER_PATH,
        'server',
      )
    }
    // Merge rootDocCollections into GlobalViewRedirect serverProps
    const actionsArr = Array.isArray(comp.actions) ? comp.actions : []
    const actionIdx = actionsArr.findIndex(
      (e: AdminEntry) =>
        (typeof e === 'object' && e?.path === PLUGIN_GLOBAL_VIEW_REDIRECT_PATH) ||
        e === PLUGIN_GLOBAL_VIEW_REDIRECT_PATH,
    )
    if (actionIdx !== -1) {
      const entry = actionsArr[actionIdx] as { path?: string; serverProps?: Record<string, unknown> }
      const existing = typeof entry === 'object' && entry?.serverProps ? entry.serverProps : {}
      comp.actions = actionsArr.map((e: AdminEntry, i: number) =>
        i === actionIdx
          ? {
              path: PACKAGE_GLOBAL_VIEW_REDIRECT_PATH,
              serverProps: {
                ...existing,
                rootDocCollections: _options.rootDocCollections ?? ['navbar', 'footer'],
              },
            }
          : e,
      )
    } else {
      comp.actions = replaceInEntries(
        comp.actions,
        PLUGIN_GLOBAL_VIEW_REDIRECT_PATH,
        PACKAGE_GLOBAL_VIEW_REDIRECT_PATH,
        'server',
      )
    }

    const tenantsSlug = _options.tenantsCollectionSlug ?? 'tenants'
    const collectionsWithTenantFieldSet = new Set(_options.collectionsWithTenantField ?? [])
    const documentTenantFieldName = _options.documentTenantFieldName ?? 'tenant'
    const syncTenantHook = createSyncTenantFromSelectorHook({
      documentTenantFieldName,
      userHasAccessToAllTenants: _options.userHasAccessToAllTenants,
    })

    const collections = Array.isArray(config.collections) ? config.collections : []
    config.collections = collections.map((col: CollectionConfig) => {
      if (collectionsWithTenantFieldSet.has(col.slug)) {
        const existingBeforeChange = Array.isArray(col.hooks?.beforeChange) ? col.hooks.beforeChange : []
        return {
          ...col,
          hooks: {
            ...col.hooks,
            beforeChange: [...existingBeforeChange, syncTenantHook],
          },
        } as CollectionConfig
      }
      if (col.slug !== tenantsSlug) return col
      if (col.endpoints === false) return col
      const existingEndpoints = Array.isArray(col.endpoints) ? col.endpoints : []
      const handler = createPopulateTenantOptionsHandler({
        tenantsCollectionSlug: tenantsSlug,
        userHasAccessToAllTenants: _options.userHasAccessToAllTenants,
      })
      const hasAlready =
        existingEndpoints.some(
          (e: { path?: string; method?: string }) =>
            typeof e === 'object' && e?.path === '/populate-tenant-options' && e?.method === 'get',
        )
      if (hasAlready) return col
      return {
        ...col,
        endpoints: [
          ...existingEndpoints,
          { path: '/populate-tenant-options', method: 'get' as const, handler },
        ],
      } as CollectionConfig
    })

    return config
  }
