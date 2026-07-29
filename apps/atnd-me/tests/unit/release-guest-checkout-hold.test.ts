/**
 * Regression: guest checkout hold release on page exit must use sync XHR
 * (async fetch is often cancelled by the browser on unload).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { releaseGuestCheckoutHold } from '@/lib/booking/releaseGuestCheckoutHold'

describe('releaseGuestCheckoutHold', () => {
  const open = vi.fn()
  const setRequestHeader = vi.fn()
  const send = vi.fn()
  const sendBeacon = vi.fn()
  const fetchFn = vi.fn().mockResolvedValue({ ok: true })

  class MockXHR {
    open = open
    setRequestHeader = setRequestHeader
    send = send
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sendBeacon.mockReturnValue(true)
  })

  it('uses synchronous XHR when sync=true (pagehide / beforeunload path)', () => {
    const result = releaseGuestCheckoutHold({
      timeslotId: 42,
      guestEmail: 'guest@example.com',
      sync: true,
      deps: {
        XMLHttpRequestCtor: MockXHR as unknown as typeof XMLHttpRequest,
        sendBeacon,
        fetchFn: fetchFn as unknown as typeof fetch,
      },
    })

    expect(result).toBe('xhr')
    expect(open).toHaveBeenCalledWith('POST', '/api/events/guest-release-hold', false)
    expect(setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({ timeslotId: 42, guestEmail: 'guest@example.com' }),
    )
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('falls back to sendBeacon when sync XHR throws', () => {
    open.mockImplementationOnce(() => {
      throw new Error('sync xhr blocked')
    })

    const result = releaseGuestCheckoutHold({
      timeslotId: 7,
      guestEmail: 'a@b.co',
      sync: true,
      deps: {
        XMLHttpRequestCtor: MockXHR as unknown as typeof XMLHttpRequest,
        sendBeacon,
        fetchFn: fetchFn as unknown as typeof fetch,
        BlobCtor: Blob,
      },
    })

    expect(result).toBe('beacon')
    expect(sendBeacon).toHaveBeenCalledWith(
      '/api/events/guest-release-hold',
      expect.any(Blob),
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('uses keepalive fetch for non-sync cleanup (in-app navigation)', () => {
    const result = releaseGuestCheckoutHold({
      timeslotId: 9,
      guestEmail: 'nav@example.com',
      sync: false,
      deps: {
        XMLHttpRequestCtor: MockXHR as unknown as typeof XMLHttpRequest,
        sendBeacon: undefined,
        fetchFn: fetchFn as unknown as typeof fetch,
      },
    })

    expect(result).toBe('fetch')
    expect(open).not.toHaveBeenCalled()
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/events/guest-release-hold',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ timeslotId: 9, guestEmail: 'nav@example.com' }),
      }),
    )
  })

  it('skips release when payment redirect is in progress', () => {
    const result = releaseGuestCheckoutHold({
      timeslotId: 1,
      guestEmail: 'pay@example.com',
      sync: true,
      skip: true,
      deps: {
        XMLHttpRequestCtor: MockXHR as unknown as typeof XMLHttpRequest,
        fetchFn: fetchFn as unknown as typeof fetch,
      },
    })

    expect(result).toBe('skipped')
    expect(open).not.toHaveBeenCalled()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
