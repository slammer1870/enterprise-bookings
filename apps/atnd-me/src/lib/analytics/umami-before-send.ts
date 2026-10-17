export const UMAMI_BEFORE_SEND_SCRIPT = `
(function () {
  var allowedQueryParams = new Set([
    'ref',
    'source',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term'
  ]);
  var queryFreePaths = new Set([
    '/complete-booking',
    '/join-waitlist',
    '/search',
    '/success'
  ]);
  var lastPageview = null;
  var lastPageviewAt = 0;

  window.umamiBeforeSend = function (type, payload) {
    if (!payload || typeof payload.url !== 'string') return payload;

    try {
      var url = new URL(payload.url, window.location.origin);
      url.hash = '';
      url.pathname = url.pathname.replace(
        /^\\/bookings\\/[^/]+(?=\\/|$)/,
        '/bookings/_ID_'
      );

      var queryFree =
        url.pathname === '/auth' ||
        url.pathname.indexOf('/auth/') === 0 ||
        queryFreePaths.has(url.pathname);

      Array.from(url.searchParams.keys()).forEach(function (key) {
        if (queryFree || !allowedQueryParams.has(key)) {
          url.searchParams.delete(key);
        }
      });

      var sanitizedUrl = url.pathname + url.search;
      if (type === 'event' && !payload.name) {
        var now = Date.now();
        if (lastPageview === sanitizedUrl && now - lastPageviewAt < 1000) {
          return false;
        }
        lastPageview = sanitizedUrl;
        lastPageviewAt = now;
      }

      return Object.assign({}, payload, { url: sanitizedUrl });
    } catch (_error) {
      return false;
    }
  };
})();
`
