# Where does an alias 301 run?

Type: grilling
Status: resolved

## Question

Alias hosts 301 to the canonical host and preserve the path and query. On Bru Grappling, `https://brugrappling.ie/<path>` returns 301 at Cloudflare to `https://www.brugrappling.ie/` and drops the path, including `/robots.txt` and `/sitemap.xml`. That response is not this app. Middleware would preserve the path, and it does not run for `/robots.txt` or paths starting with `/sitemap`. Cloudflare for SaaS does not provide an alias-redirect object: both hostnames are proxied to the origin, and the origin sees the original Host.

Where does the spec say the alias 301 is issued? Does `/robots.txt` and `/sitemap.xml` on an alias host 301 to the same path on the canonical host?

## Comments

### Round 1

The origin issues the 301 for every alias host, including the platform subdomain once a custom canonical host exists. The alias host is proxied to the origin with its original Host. Cloudflare does not redirect it. The target is the canonical host with the same path and query.

`/robots.txt` and every path under `/sitemap` on an alias host 301 to the same path and query on the canonical host. An alias host does not publish its own robots file or sitemap.

### Round 2

Every request to an alias host 301s to the same path and query on the canonical host. The target is `https://<canonical host><path><query>` with no port. An alias host does not serve a response of its own.

## Answer

The origin issues the 301. Cloudflare proxies the alias host and does not redirect it. Every request to an alias host, including the platform subdomain once a custom canonical host exists, 301s to `https://<canonical host><path><query>` with no port. `/robots.txt` and `/sitemap` are included. An alias host does not serve a response of its own. The canonical host serves its own robots file and sitemap. With no custom canonical host named, the platform subdomain serves and there is no alias redirect. The platform apex-to-`www` redirect stays a platform concern.
