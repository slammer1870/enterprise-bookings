# Share image

Status: done

Glossary: `CONTEXT.md` (`share image`, `canonical host`, `indexed URL`, `platform mark`).

## Problem Statement

A page that has an image can publish a share image that does not load. The tenant origin is prefixed onto a media URL that is already absolute, so the tag points at `https://<canonical host>/https://…`. A media path should instead be served from the canonical host, which is the tenant's custom URL when they have named one.

## Solution

The share image on a served page is the media URL when that URL is already absolute. When the media URL is a path, the share image is `https://<canonical host><path>`, with no port. A page with no image emits no share image. The Open Graph page URL stays the indexed URL.

## User Stories

1. As a visitor sharing a page, I want a media path to become a share image on the canonical host, so that the image loads on the host that serves the page.
2. As a visitor sharing a page for a tenant who has named a custom canonical host, I want that share image to use the custom URL, so that the image is scoped to the tenant's own host.
3. As a visitor sharing a page for a tenant who has named no custom canonical host, I want that share image to use the platform subdomain, so that the image still loads on the host that serves.
4. As a visitor sharing a page, I want an already-absolute media URL left unchanged, so that a file on the public media host is not rewritten.
5. As a visitor sharing a page, I want the canonical host not prefixed onto an already-absolute media URL, so that the tag is not `https://<canonical host>/https://…`.
6. As a visitor sharing a page, I want an absolute media URL on a different host left on that host, so that a public media address is not forced onto the custom URL.
7. As a visitor sharing a page, I want an absolute media URL that already uses the canonical host left unchanged, so that a correct address is not rebuilt.
8. As a visitor sharing a page, I want the path join to use https and no port, so that the share image does not depend on how the request reached the origin.
9. As a visitor sharing a page, I want the media path preserved, so that `/api/media/file/photo.jpg` stays that path on the canonical host.
10. As a visitor sharing a page, I want a query on a media path preserved, so that a cache-busting query is still present.
11. As a visitor sharing a page, I want a query on an already-absolute media URL preserved, so that the stored address is not trimmed.
12. As a visitor sharing a page, I want the share-sized media URL used when one exists, so that the tag points at the image meant for sharing.
13. As a visitor sharing a page, I want the file URL used when no share-sized URL exists, so that the page still has a share image.
14. As a visitor sharing a page, I want a share-sized URL that is already absolute left unchanged, and a share-sized path scoped to the canonical host, so that both shapes follow the same rule.
15. As a visitor sharing a page with no image, I want no share image, so that an empty image is not invented.
16. As a visitor sharing a page with no image, I want the tenant logo not used as the share image, so that the icon and the share image stay separate.
17. As a visitor on a tenant page, I want the platform mark not used as the share image, so that the platform's default image is not standing in for the tenant.
18. As a visitor sharing a page, I want the Open Graph image and the Twitter image to be the same share image, so that each preview uses one address.
19. As a visitor sharing a page with no image, I want neither the Open Graph image nor the Twitter image emitted, so that both tags stay absent together.
20. As a search crawler, I want the Open Graph page URL to stay the indexed URL, so that fixing the share image does not change which page URL is shared.
21. As a search crawler, I want the canonical link to stay the indexed URL, so that the share-image join does not change which host is indexed.
22. As a visitor on a post, I want the same share-image rules as on a page, so that a post image is scoped the same way.
23. As a visitor on the homepage, I want the same share-image rules, so that the home page does not use a different join.
24. As a visitor whose request carries a port, I want the path-based share image to omit that port, so that the public image address is stable.
25. As a visitor on the canonical host, I want the share image resolved from the canonical host and not from the request host, so that an alias is not the image origin.

## Implementation Decisions

- The share image is taken from the page's media the same way as today. A share-sized URL is preferred when present. Otherwise the file URL is used. This spec does not change which file is chosen, and it does not add a new image size.
- A media URL with a scheme is already absolute. The share image is that URL, including its host, path, and query. The canonical host is not prefixed onto it, and the host is not replaced with the canonical host.
- A media URL without a scheme is a path. The share image is `https://<canonical host><path>`, with no port. A query on the path is kept. The canonical host is the custom host the tenant named, or the platform subdomain when they have named none. The request host is not used.
- The Open Graph image and the Twitter image are that same share image. When the page has no image, neither tag is emitted. The tenant logo remains the icon. It is not the share image. The platform mark is not emitted as the share image on a tenant page.
- The Open Graph page URL and the canonical link stay the indexed URL. This spec does not change host resolution, alias redirects, or the sitemap.
- The value in the document is absolute. A later join must not treat an already-absolute media URL as a path.

## Testing Decisions

- One seam: a Playwright request against the running atnd-me app, the same shape as the public-host end-to-end tests. The test creates a tenant, gives a page an image, and requests the canonical host.
- A good test asserts the share image on the response: the Open Graph image and the Twitter image. It does not assert which function built the URL.
- An already-absolute media URL is that exact URL. A media path is `https://<canonical host><path>` with no port. A page with no image has neither tag. On the page that has an image, the Open Graph page URL is still the indexed URL.
- Cover a tenant with a custom canonical host and a tenant whose canonical host is the platform subdomain. Cover a share-sized URL and a file URL only so far as both shapes, path and absolute, follow the rule.
- Prior art is the public-host end-to-end tests, which already read the canonical link and the Open Graph page URL, and the unknown-host test, which expects no Open Graph image. URL-helper unit tests are below this seam.

## Out of Scope

- Which host serves, alias redirects, the sitemap, and `robots.txt`.
- Admin DNS, certificate status, routing records, and moving existing tenants onto a canonical host.
- The document icon. An absolute logo URL is already left alone there.
- Email images.
- Rewriting a public media host onto the canonical host.
- Choosing or generating a new image size.
- The platform mark on a platform host.
- A trailing-slash policy.

## Further Notes

- Glossary: `CONTEXT.md`. Share image, canonical host, indexed URL, and platform mark are defined there.
- This repair was left out of [tenant public hosts](../tenant-public-hosts/spec.md) and out of that follow-on map. The decision is [How do we repair the Open Graph absolute URL bug?](../tenant-public-hosts/issues/20-og-image-absolute-url-repair.md).
- Today a path is joined to the tenant origin by forcing a leading slash first, so an already-absolute media URL becomes a path on that origin.
