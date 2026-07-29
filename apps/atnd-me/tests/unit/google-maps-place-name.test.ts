import { describe, expect, it } from 'vitest'

import { extractGoogleMapsPlaceName } from '@/utilities/extractGoogleMapsPlaceName'
import { normalizeGoogleMapsEmbedUrl } from '@/utilities/normalizeGoogleMapsEmbedUrl'

describe('extractGoogleMapsPlaceName', () => {
  it('extracts the business name from a /maps/place/ URL', () => {
    const url =
      'https://www.google.com/maps/place/Croi+Lan+Sauna/@52.9801,-6.0442,17z/data=!3m1!4b1'
    expect(extractGoogleMapsPlaceName(url)).toBe('Croi Lan Sauna')
  })

  it('extracts from q= query when it is a place name', () => {
    expect(
      extractGoogleMapsPlaceName('https://maps.google.com/maps?q=Dark+Horse+Strength&output=embed'),
    ).toBe('Dark Horse Strength')
  })

  it('returns null for coordinate-only queries', () => {
    expect(extractGoogleMapsPlaceName('https://maps.google.com/maps?q=53.3,-6.2&output=embed')).toBe(
      null,
    )
  })

  it('extracts from iframe HTML', () => {
    const html =
      '<iframe src="https://www.google.com/maps/place/Some+Studio/@1,2,17z" width="600"></iframe>'
    expect(extractGoogleMapsPlaceName(html)).toBe('Some Studio')
  })
})

describe('normalizeGoogleMapsEmbedUrl place path', () => {
  it('embeds place URLs without coordinates by place name', () => {
    const src = normalizeGoogleMapsEmbedUrl(
      'https://www.google.com/maps/place/Some+Studio/data=!4m2!3m1',
    )
    expect(src).toContain('q=Some%20Studio')
    expect(src).toContain('output=embed')
  })

  it('prefers place name over @lat,lng so business identity is kept', () => {
    const src = normalizeGoogleMapsEmbedUrl(
      'https://www.google.com/maps/place/Br%C3%BA+Grappling+Studio/@53.293828,-6.2479142,555m/data=!3m2!1e3!4b1!4m6!3m5!1s0x486709f7523ae025:0x30d55d6cf273af8d',
    )
    expect(src).toBe(
      'https://maps.google.com/maps?q=Br%C3%BA%20Grappling%20Studio&output=embed',
    )
    expect(src).not.toContain('53.293828')
  })

  it('falls back to coordinates when there is no place name', () => {
    const src = normalizeGoogleMapsEmbedUrl(
      'https://www.google.com/maps/@53.293828,-6.2479142,15z',
    )
    expect(src).toBe('https://maps.google.com/maps?q=53.293828,-6.2479142&z=15&output=embed')
  })
})
