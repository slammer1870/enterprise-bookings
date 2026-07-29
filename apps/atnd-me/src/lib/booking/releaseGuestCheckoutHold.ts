/**
 * Release a guest event checkout hold.
 *
 * On tab close / refresh, callers must pass `sync: true` so we use synchronous
 * XHR — async fetch/keepalive is often cancelled before the request leaves the browser.
 */
export type ReleaseGuestCheckoutHoldDeps = {
  XMLHttpRequestCtor?: typeof XMLHttpRequest
  sendBeacon?: (url: string, data?: BodyInit | null) => boolean
  fetchFn?: typeof fetch
  BlobCtor?: typeof Blob
}

export type ReleaseGuestCheckoutHoldResult = 'skipped' | 'xhr' | 'beacon' | 'fetch'

export function releaseGuestCheckoutHold(options: {
  timeslotId: number | string
  guestEmail: string
  /** Prefer sync XHR (required for pagehide / beforeunload). */
  sync?: boolean
  /** e.g. payment redirect in progress — do not release. */
  skip?: boolean
  url?: string
  deps?: ReleaseGuestCheckoutHoldDeps
}): ReleaseGuestCheckoutHoldResult {
  if (options.skip) return 'skipped'

  const url = options.url ?? '/api/events/guest-release-hold'
  const body = JSON.stringify({
    timeslotId: options.timeslotId,
    guestEmail: options.guestEmail,
  })

  const XMLHttpRequestCtor =
    options.deps?.XMLHttpRequestCtor ??
    (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : undefined)

  if (options.sync && XMLHttpRequestCtor) {
    try {
      const xhr = new XMLHttpRequestCtor()
      xhr.open('POST', url, false)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(body)
      return 'xhr'
    } catch {
      // fall through to beacon / keepalive fetch
    }
  }

  const sendBeacon =
    options.deps?.sendBeacon ??
    (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon.bind(navigator)
      : undefined)
  const BlobCtor = options.deps?.BlobCtor ?? (typeof Blob !== 'undefined' ? Blob : undefined)

  if (sendBeacon && BlobCtor) {
    try {
      const blob = new BlobCtor([body], { type: 'application/json' })
      if (sendBeacon(url, blob)) return 'beacon'
    } catch {
      // fall through
    }
  }

  const fetchFn = options.deps?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined)
  if (fetchFn) {
    void fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
    return 'fetch'
  }

  return 'skipped'
}
