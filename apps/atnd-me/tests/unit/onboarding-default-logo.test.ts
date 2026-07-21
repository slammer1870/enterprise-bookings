import { describe, expect, it } from 'vitest'

import {
  monogramFromCompanyName,
  renderMonogramLogoPng,
} from '@/lib/onboarding/createDefaultTenantLogo'

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

describe('renderMonogramLogoPng', () => {
  it('draws letter pixels (not an empty colored square)', async () => {
    const { buffer, monogram } = await renderMonogramLogoPng('Claim Studio')
    expect(monogram).toBe('CS')
    expect(buffer.byteLength).toBeGreaterThan(2000)

    // PNG IHDR + IDAT should include more than a flat fill — glyph rects add entropy.
    const uniqueBytes = new Set(buffer)
    expect(uniqueBytes.size).toBeGreaterThan(16)
  })
})
