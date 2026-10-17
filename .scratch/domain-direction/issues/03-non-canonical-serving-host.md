# How does a serving host that is not the canonical host respond?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: none

## Question

For `www.example.com, example.com, mysite.example.com` with Direction allow www and non-www, `example.com` is the canonical host. `www.example.com` and `mysite.example.com` serve, and both name `example.com` as the indexed URL.

For `www.example.com, example.com, www.other.com, other.com` with Direction redirect to non-www, `example.com` is the canonical host. `www.example.com` redirects to `example.com`. `www.other.com` redirects to `other.com`. `other.com` serves and names `example.com` as the indexed URL.

What does each of those hosts return for `/`, a content path, `/robots.txt`, and `/sitemap.xml`? Include the canonical link and the Open Graph URL on a served page. A redirect preserves the path and query and uses https with no port; this ticket does not reopen that.

## Comments

A non-canonical serving host returns the page. The canonical link and the Open Graph URL are the indexed URL. `robots.txt` is served on that host, with the same allow and disallow rules as the canonical host, so the crawl rules apply to the host that was requested and a crawler can read the canonical link. Its Sitemap line is `https://<canonical host>/sitemap.xml`.

`/sitemap.xml` on that host redirects to the same path on the canonical host. A sitemap served there would list either the request host or another host's URLs. `/pages-sitemap.xml` and `/posts-sitemap.xml` return 404, as they do on the canonical host.

For `www.example.com, example.com, mysite.example.com` with Direction allow www and non-www, `example.com` is canonical. `https://www.example.com/kids?ref=1` and `https://mysite.example.com/kids?ref=1` return 200 and name `https://example.com/kids`. Each host's `/sitemap.xml` redirects to `https://example.com/sitemap.xml`.

For `www.example.com, example.com, www.other.com, other.com` with Direction redirect to non-www, `www.example.com` redirects to `example.com`. `other.com` serves and names `example.com` in the canonical link and the Open Graph URL. `www.other.com` redirects to `other.com`. `https://www.other.com/sitemap.xml` redirects to `https://other.com/sitemap.xml`, which redirects to `https://example.com/sitemap.xml`. `https://www.other.com/pages-sitemap.xml` redirects to `https://other.com/pages-sitemap.xml`, which returns 404.

## Answer

A non-canonical serving host returns 200 for `/` and for a content path. The canonical link and the Open Graph URL are the indexed URL, `https://<canonical host><path>`, with no query and no port. The page has no `noindex`.

`/robots.txt` on that host returns 200. It allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`.

`/sitemap.xml` on that host returns 301 to `https://<canonical host>/sitemap.xml`, preserving the query and using https with no port.

`/pages-sitemap.xml` and `/posts-sitemap.xml` on that host return 404.

An alias host returns 301 to its pair partner for every path, preserving the path and query. The canonical host is unchanged.
