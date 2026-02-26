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

/**
 * Discover tenant options from the admin tenant selector dropdown.
 * Call after login and after the tenant selector is visible. Opens the dropdown,
 * reads option values and labels, then closes it (Esc or click away).
 */
export async function discoverTenantOptionsFromPage(page: Page): Promise<TenantOption[]> {
  const wrap = getTenantSelectorLocator(page)
  await wrap.waitFor({ state: 'visible', timeout: 15_000 })
  const combobox = wrap.getByRole('combobox').or(wrap).first()
  await combobox.scrollIntoViewIfNeeded()
  // Open dropdown: try click first (when real combobox is clickable), then keyboard, then fallback to the indicator button.
  const optionTimeout = 10_000
  // Only options inside the listbox belong to the tenant combobox; page.getByRole('option') can match sidebar/other UI.
  const listboxOptions = () => page.getByRole('listbox').getByRole('option')
  const isListboxOpen = async () =>
    (await listboxOptions().first().isVisible().catch(() => false)) === true

  await combobox.click({ timeout: 2000 }).catch(() => null)
  await page.waitForTimeout(200)
  if (!(await isListboxOpen())) {
    await combobox.focus()
  }
  const openWithKey = async (key: string) => {
    await page.keyboard.press(key)
    await page.waitForTimeout(500)
    await listboxOptions().first().waitFor({ state: 'visible', timeout: optionTimeout }).catch(() => null)
  }
  await openWithKey('ArrowDown')
  let options = listboxOptions()
  let count = await options.count()
  if (count === 0) {
    await openWithKey(' ')
    options = listboxOptions()
    count = await options.count()
  }
  if (count === 0) {
    await openWithKey('Enter')
    options = listboxOptions()
    count = await options.count()
  }
  if (count === 0) {
    const indicatorButton = wrap.getByRole('button').last()
    await indicatorButton.click({ timeout: 2000 }).catch(() => null)
    await listboxOptions().first().waitFor({ state: 'visible', timeout: optionTimeout }).catch(() => null)
    options = listboxOptions()
    count = await options.count()
  }
  await page.waitForTimeout(300)

  const result: TenantOption[] = []
  for (let i = 0; i < count; i++) {
    const opt = options.nth(i)
    const name = (await opt.textContent())?.trim() ?? ''
    const value =
      (await opt.getAttribute('value')) ??
      (await opt.getAttribute('data-value')) ??
      (await opt.getAttribute('data-id')) ??
      (await opt.getAttribute('id')) ??
      ''
    if (name && !name.toLowerCase().includes('no tenant')) {
      result.push({ id: value || name, name })
    }
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  if (result.length === 0 && count > 0) {
    throw new Error(
      `discoverTenantOptionsFromPage: found ${count} option(s) in listbox but none had a name (or all matched "no tenant"). Check option markup.`,
    )
  }
  return result
}
