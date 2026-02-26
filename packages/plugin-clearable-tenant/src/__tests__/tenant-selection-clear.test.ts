import { describe, it, expect } from 'vitest'
import { getEffectiveTenantIdWhenClearing } from '../shared/clearBehavior'

/**
 * Regression: When the root admin clears the tenant selector, the selection must be
 * cleared (no tenant), not set to the first tenant. This test encodes the intended
 * behavior of the provider's setTenant when id is undefined.
 */
describe('tenant selection clear behavior', () => {
  it('when clearing (id undefined), effective id is always undefined with two tenants', () => {
    const options = [{ value: 1 }, { value: 2 }]
    expect(getEffectiveTenantIdWhenClearing(undefined, options)).toBeUndefined()
  })

  it('when clearing (id undefined), effective id is always undefined with one tenant', () => {
    const options = [{ value: 1 }]
    expect(getEffectiveTenantIdWhenClearing(undefined, options)).toBeUndefined()
  })

  it('when clearing (id null or empty string), effective id is always undefined', () => {
    const options = [{ value: 1 }]
    expect(getEffectiveTenantIdWhenClearing(null, options)).toBeUndefined()
    expect(getEffectiveTenantIdWhenClearing('', options)).toBeUndefined()
  })

  it('when selecting an id, effective id is that id', () => {
    const options = [{ value: 1 }, { value: 2 }]
    expect(getEffectiveTenantIdWhenClearing(2, options)).toBe(2)
  })
})
