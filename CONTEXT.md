# Enterprise bookings

Shared language for the atnd-me platform, which hosts a site for each business.

## Language

### Public hosts

**Tenant**:
A business hosted on the platform, with its own site.
_Avoid_: account, org, customer

**Public host**:
A hostname assigned to a tenant's site, whether that host serves pages or redirects.
_Avoid_: domain, URL

**Custom domain**:
A canonical host or alias host the tenant names. The platform subdomain is not a custom domain.
_Avoid_: vanity domain

**Canonical host**:
The one public host that serves a tenant's pages, and the origin search engines should index. The tenant names it. When the tenant has named none, it is the platform subdomain.
_Avoid_: primary domain, main URL

**Indexed URL**:
The URL a served page tells search engines to index: `https://<canonical host><path>`, with no query and no port.
_Avoid_: canonical URL, permalink

**Alias host**:
A public host that redirects to the canonical host and preserves the path and query. The tenant names one only together with a canonical host, on any apex. When the tenant has named a canonical host, the platform subdomain is an alias host.
_Avoid_: secondary domain, redirect domain

**Platform subdomain**:
The hostname the platform assigns a tenant from its slug (`{slug}.{platform}`).
_Avoid_: tenant URL, subdomain

**Apex**:
A tenant's bare registrable domain, with no leading label (`brugrappling.ie`).
_Avoid_: root domain, naked domain

**Claimed apex**:
An apex on which a tenant has named a hostname. Only that tenant may name a hostname on it, and only while they still name one.
_Avoid_: owned domain, registered domain

**Platform apex**:
The platform's own bare domain. Traffic from it to the platform `www` host is a platform concern, separate from any tenant apex.
_Avoid_: apex redirect

**Platform host**:
A hostname of the platform itself, where the platform's marketing site is served.
_Avoid_: root, apex

**Platform mark**:
The platform's own icon and default share image. It is emitted only on a platform host.
_Avoid_: favicon, logo

**Share image**:
The image a served page offers when the page is shared. When the media URL is already absolute, the share image is that URL. It is not the indexed URL.
_Avoid_: og:image, Open Graph image

**Routing record**:
The DNS record that points a custom domain at the platform.
_Avoid_: A record, DNS setup

**DNS status**:
Whether a custom domain's routing is accepted: Active, Pending, Error, or Unknown. It is not part of the declaration, and it does not change which host serves.
_Avoid_: verification, hostname status

**Certificate status**:
Whether a custom domain's certificate is issued: Active, Pending, Error, or Unknown. It is not part of the declaration, and it does not change which host serves.
_Avoid_: SSL status

**Email sending domain**:
The apex of the canonical host. An apex named only by another hostname is not one.
_Avoid_: From-domain, email domain

**Apple Pay domain**:
A serving host. Each serving host is one, and an alias host is not one.
_Avoid_: merchant domain, payment domain
