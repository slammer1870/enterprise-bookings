import { describe, expect, it } from 'vitest'

import { monogramFromCompanyName } from '@/lib/onboarding/createDefaultTenantLogo'

describe('monogramFromCompanyName', () => {
  it('uses the first letter for a single-word name', () => {
    expect(monogramFromCompanyName('Yoga')).toBe('Y')
    expect(monogramFromCompanyName('  bru  ')).toBe('B')
  })

  it('uses two initials for multi-word names', () => {
    expect(monogramFromCompanyName('Mindful Yard')).toBe('MY')
    expect(monogramFromCompanyName('dark-horse strength')).toBe('DH')
  })

  it('strips punctuation and falls back safely', () => {
    expect(monogramFromCompanyName('!!!')).toBe('?')
    expect(monogramFromCompanyName('42 Studio')).toBe('4S')
  })
})
