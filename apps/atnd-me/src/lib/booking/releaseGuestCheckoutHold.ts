/**
 * Release a guest event checkout hold.
 *
 * On tab close / refresh, callers must pass `sync: true`. We fire sendBeacon and
 * sync XHR together — browsers often cancel async fetch during unload, and sync
 * XHR alone is deprecated / unreliable in some private-browsing modes.
 */
export type ReleaseGuestCheckoutHoldDeps = {
  XMLHttpRequestCtor?: typeof XMLHttpRequest
  sendBeacon?: (url: string, data?: BodyInit | null) => boolean
  fetchFn?: typeof fetch
  BlobCtor?: typeof Blob
}

export type ReleaseGuestCheckoutHoldResult =
  | 'skipped'
  | 'xhr'
  | 'beacon'
  | 'fetch'
  | 'xhr+beacon'

export function releaseGuestCheckoutHold(options: {
  timeslotId: number | string
  guestEmail: string
  /** Prefer unload-safe transport (required for pagehide / beforeunload). */
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
  const sendBeacon =
    options.deps?.sendBeacon ??
    (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon.bind(navigator)
      : undefined)
  const BlobCtor = options.deps?.BlobCtor ?? (typeof Blob !== 'undefined' ? Blob : undefined)
  const fetchFn = options.deps?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined)

  if (options.sync) {
    let beaconOk = false
    let xhrOk = false

    if (sendBeacon && BlobCtor) {
      try {
        const blob = new BlobCtor([body], { type: 'application/json' })
        beaconOk = Boolean(sendBeacon(url, blob))
      } catch {
        // continue
      }
    }

    if (XMLHttpRequestCtor) {
      try {
        const xhr = new XMLHttpRequestCtor()
        xhr.open('POST', url, false)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.send(body)
        xhrOk = true
      } catch {
        // continue
      }
    }

    if (beaconOk && xhrOk) return 'xhr+beacon'
    if (xhrOk) return 'xhr'
    if (beaconOk) return 'beacon'

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

  if (sendBeacon && BlobCtor) {
    try {
      const blob = new BlobCtor([body], { type: 'application/json' })
      if (sendBeacon(url, blob)) return 'beacon'
    } catch {
      // fall through
    }
  }

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
