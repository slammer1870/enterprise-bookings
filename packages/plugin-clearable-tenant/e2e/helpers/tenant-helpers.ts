import type { Page } from '@playwright/test'

export type TenantOption = { id: string; name: string }

/**
 * Fetch tenant options from the same endpoint the admin tenant selector uses.
 * This avoids relying on dropdown DOM internals (which can vary by Payload/UI version).
 */
export async function fetchTenantOptionsFromAPI(page: Page): Promise<TenantOption[]> {
  const res = await page.request.get('/api/tenants/populate-tenant-options')
  if (!res.ok()) throw new Error(`fetchTenantOptionsFromAPI: ${res.status()}`)
  const json = (await res.json().catch(() => null)) as
    | { tenantOptions?: { label?: string; value?: string | number }[] }
    | null
  const opts = Array.isArray(json?.tenantOptions) ? json!.tenantOptions! : []
  return opts
    .map((o) => ({ id: String(o.value ?? ''), name: String(o.label ?? '') }))
    .filter((o) => o.id && o.name)
}

/**
 * Locate the tenant selector.
 *
 * Use the explicit test id only. The admin header contains other comboboxes
 * (e.g. dashboard layout) that can cause false positives.
 */
export function getTenantSelectorLocator(page: Page) {
  return page.getByTestId('tenant-selector')
}
