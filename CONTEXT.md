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
A hostname the tenant names. It is either a serving host or an alias host. The platform subdomain is not a custom domain.
_Avoid_: vanity domain

**Hostname list**:
The ordered custom domains a tenant names.
_Avoid_: domain, alias list

**Serving host**:
A public host that serves a tenant's pages. The canonical host is one, and a tenant may have others.
_Avoid_: live domain

**Canonical host**:
The one serving host that the indexed URL names. When the tenant has named no custom hostname, it is the platform subdomain.
_Avoid_: primary domain, main URL

**Indexed URL**:
The URL the canonical link and the Open Graph URL name on every serving host: `https://<canonical host><path>`, with no query and no port.
_Avoid_: canonical URL, permalink, og:url

**Alias host**:
A public host that redirects to the other hostname in its www/apex pair. The platform subdomain is one once the tenant has named a custom hostname, and it redirects to the canonical host.
_Avoid_: secondary domain, redirect domain

**Direction**:
The tenant's rule for every www/apex pair they have named: both hostnames serve, the apex redirects to www, or www redirects to the apex.
_Avoid_: redirect apex, www redirect

**Declaration**:
A tenant's hostname list and Direction. It is the source of which public host serves and which redirects.
_Avoid_: domain settings, DNS setup

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
The apex of the canonical host, whether or not that apex is in the hostname list. With no custom hostname named, it is the platform apex.
_Avoid_: From-domain, email domain

**Apple Pay domain**:
A serving host. Each serving host is one, and an alias host is not one.
_Avoid_: merchant domain, payment domain
