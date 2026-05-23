import { describe, expect, it } from 'vitest'

import { buildTenantBookingThemeCss } from '../../src/utilities/buildTenantBookingThemeCss'
import { resolveTailwindColorToken } from '../../src/utilities/tailwindColorTokens'

describe('resolveTailwindColorToken', () => {
  it('resolves Tailwind palette tokens to hex', () => {
    expect(resolveTailwindColorToken('green-500')).toBe('#22c55e')
    expect(resolveTailwindColorToken('amber-400')).toBe('#fbbf24')
    expect(resolveTailwindColorToken('white')).toBe('#ffffff')
    expect(resolveTailwindColorToken('black')).toBe('#000000')
  })

  it('passes through valid CSS colors', () => {
    expect(resolveTailwindColorToken('#ff0000')).toBe('#ff0000')
    expect(resolveTailwindColorToken('hsl(142 76% 36%)')).toBe('hsl(142 76% 36%)')
  })

  it('returns null for empty or unknown values', () => {
    expect(resolveTailwindColorToken('')).toBeNull()
    expect(resolveTailwindColorToken(null)).toBeNull()
    expect(resolveTailwindColorToken('not-a-color')).toBeNull()
  })
})

describe('buildTenantBookingThemeCss', () => {
  it('returns null when booking theme is empty', () => {
    expect(buildTenantBookingThemeCss(null)).toBeNull()
    expect(buildTenantBookingThemeCss({})).toBeNull()
    expect(
      buildTenantBookingThemeCss({
        checkin: { backgroundColor: '', foregroundColor: '' },
      }),
    ).toBeNull()
  })

  it('emits CSS variables for configured colors only', () => {
    const css = buildTenantBookingThemeCss({
      checkin: { backgroundColor: 'green-500', foregroundColor: 'white' },
      cancel: { backgroundColor: 'red-500' },
    })

    expect(css).toContain(':root,')
    expect(css).toContain(".dark,")
    expect(css).toContain("[data-theme='dark']")
    expect(css).toContain('--checkin: #22c55e;')
    expect(css).toContain('--checkin-foreground: #ffffff;')
    expect(css).toContain('--cancel: #ef4444;')
    expect(css).not.toContain('--waitlist:')
  })
})
