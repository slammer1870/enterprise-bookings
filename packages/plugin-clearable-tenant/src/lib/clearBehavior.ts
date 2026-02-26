/**
 * When the user clears the tenant selector (id is undefined/null/''),
 * the effective tenant id must always be undefined — never fall back to the first option.
 * Used by the tenant selection provider client.
 */
export function getEffectiveTenantIdWhenClearing(
  id: string | number | undefined | null,
  _options: { value: string | number }[],
): string | number | undefined {
  if (id === undefined || id === null || id === '') return undefined
  return id as string | number
}
