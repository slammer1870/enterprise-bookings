# What should a tenant page emit when branding is missing?

Type: grilling
Status: resolved

## Question

A page on the canonical host must carry the tenant's name and a canonical URL on that host. Today, if tenant lookup throws, or the tenant has no logo, the root metadata falls back to the title "ATND ME" and `/favicon.svg`.

Live Bru hosts do not hit the fallback: `www.brugrappling.ie` and `brugrappling.atnd.me` return the tenant title and logo. An unknown host such as `bru-grappling.atnd.me` does return "ATND ME" and `/favicon.svg`.

When the tenant resolves but has no logo, which icon should the page emit? When the hostname matches no tenant, what should the response be?

## Answer

A resolved tenant with no logo keeps the tenant name as the document title and emits no icon. If that page also has no image of its own, it emits no share image. Title, description, and site name stay the tenant's. The platform mark is not used.

An unknown host is a 404 titled "Not found", with no icon and `noindex`. It is not the platform marketing site.

A lookup that throws is a 503 titled "Unavailable", with no icon and `noindex`. It is not a 404.

The platform mark and the platform marketing site are served only on a platform host.
