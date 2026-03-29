import { describe, it, expect } from 'vitest'
import type { Config } from 'payload'
import { clearableTenantPlugin } from '../index'

function getConfig(config: Config): Config {
  return config
}

const PLUGIN_TENANT_SELECTOR_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelector'
const PLUGIN_PROVIDER_PATH = '@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider'
const PLUGIN_GLOBAL_VIEW_REDIRECT_PATH = '@payloadcms/plugin-multi-tenant/rsc#GlobalViewRedirect'

const PACKAGE_SELECTOR_PATH = '@repo/plugin-clearable-tenant/rsc#ClearableTenantSelector'
const PACKAGE_PROVIDER_PATH = '@repo/plugin-clearable-tenant/rsc#TenantSelectionProviderRootAware'
const PACKAGE_GLOBAL_VIEW_REDIRECT_PATH =
  '@repo/plugin-clearable-tenant/rsc#GlobalViewRedirectRootAware'

describe('clearableTenantPlugin', () => {
  it('replaces TenantSelector in beforeNavLinks with ClearableTenantSelector', () => {
    const baseConfig: Config = {
      admin: {
        components: {
          beforeNavLinks: [
            { path: PLUGIN_TENANT_SELECTOR_PATH, clientProps: { label: 'Tenant' } },
          ],
        },
      },
      collections: [],
      db: {} as Config['db'],
      secret: 'test',
      typescript: { outputFile: '' },
    }
    const result = getConfig(clearableTenantPlugin()(baseConfig) as Config)
    const beforeNavLinks = (result.admin?.components as any)?.beforeNavLinks
    expect(Array.isArray(beforeNavLinks)).toBe(true)
    const entry = beforeNavLinks.find(
      (e: any) =>
        e?.path === PACKAGE_SELECTOR_PATH || e === PACKAGE_SELECTOR_PATH,
    )
    expect(entry).toBeDefined()
    expect(entry?.path ?? entry).toBe(PACKAGE_SELECTOR_PATH)
    expect(entry?.clientProps).toEqual({ label: 'Tenant' })
  })

  it('replaces TenantSelector in beforeNav when present', () => {
    const baseConfig = {
      admin: {
        components: {
          beforeNav: [{ path: PLUGIN_TENANT_SELECTOR_PATH }],
        },
      },
      collections: [],
      db: {},
      secret: 'test',
      typescript: { outputFile: '' },
    } as unknown as Config
    const result = getConfig(clearableTenantPlugin()(baseConfig) as Config)
    const beforeNav = (result.admin?.components as any)?.beforeNav
    const entry = beforeNav?.find(
      (e: any) => e?.path === PACKAGE_SELECTOR_PATH || e === PACKAGE_SELECTOR_PATH,
    )
    expect(entry).toBeDefined()
  })

  it('replaces TenantSelectionProvider in providers with TenantSelectionProviderRootAware', () => {
    const baseConfig: Config = {
      admin: {
        components: {
          providers: [
            { path: PLUGIN_PROVIDER_PATH, serverProps: { tenantsCollectionSlug: 'tenants' } },
          ],
        },
      },
      collections: [],
      db: {} as Config['db'],
      secret: 'test',
      typescript: { outputFile: '' },
    }
    const result = getConfig(clearableTenantPlugin()(baseConfig) as Config)
    const providers = (result.admin?.components as any)?.providers
    expect(Array.isArray(providers)).toBe(true)
    const entry = providers.find(
      (e: any) =>
        e?.path === PACKAGE_PROVIDER_PATH || e === PACKAGE_PROVIDER_PATH,
    )
    expect(entry).toBeDefined()
    expect(entry?.serverProps?.tenantsCollectionSlug).toBe('tenants')
  })

  it('replaces GlobalViewRedirect in actions with GlobalViewRedirectRootAware', () => {
    const baseConfig: Config = {
      admin: {
        components: {
          actions: [
            {
              path: PLUGIN_GLOBAL_VIEW_REDIRECT_PATH,
              serverProps: {},
            },
          ],
        },
      },
      collections: [],
      db: {} as Config['db'],
      secret: 'test',
      typescript: { outputFile: '' },
    }
    const result = getConfig(clearableTenantPlugin()(baseConfig) as Config)
    const actions = (result.admin?.components as any)?.actions
    expect(Array.isArray(actions)).toBe(true)
    const entry = actions.find(
      (e: any) =>
        e?.path === PACKAGE_GLOBAL_VIEW_REDIRECT_PATH ||
        e === PACKAGE_GLOBAL_VIEW_REDIRECT_PATH,
    )
    expect(entry).toBeDefined()
  })

  it('leaves config unchanged when multi-tenant component paths are absent', () => {
    const baseConfig: Config = {
      admin: { components: { beforeNavLinks: [] } },
      collections: [],
      db: {} as Config['db'],
      secret: 'test',
      typescript: { outputFile: '' },
    }
    const result = getConfig(clearableTenantPlugin()(baseConfig) as Config)
    expect((result.admin?.components as any)?.beforeNavLinks).toEqual([])
  })
})
