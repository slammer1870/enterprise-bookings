# How do existing tenants move to a canonical host?

Type: grilling
Status: resolved
Blocked by: 01, 04, 06, 07

## Question

Existing tenants store one serving hostname on `domain` (often `www`) and may 301 the apex toward it. The new model has one canonical host the tenant names, and aliases that 301 toward it. Bru Grappling's canonical host must be `brugrappling.ie`.

The live apex does not preserve paths: `https://brugrappling.ie/<path>` 301s to the `www` homepage. See [What do Bru Grappling's live hosts return?](01-bru-live-hosts.md).

An A record at the anycast addresses of the SaaS target is outside the spec, including apexes already published that way. See [Which DNS setups can an apex canonical host use?](07-apex-dns-setups.md).

What is the migration rule for a tenant that already has `domain` and `redirectApex`? How do those apex DNS records move onto an allowed setup? For Bru Grappling, how do indexed URLs on the current serving host, and deep URLs on the apex, keep their equity when the serving host flips to the apex?

## Comments

### Round 1

A stored `domain` stays the canonical host. The apex is an alias only when `redirectApex` is on. Bru Grappling is the exception: the canonical host becomes `brugrappling.ie` and `www.brugrappling.ie` is an alias.

Indexed `www` URLs and the platform subdomain 301 to the same path on the apex. The apex serves that path. `www` does not keep returning 200.

The Cloudflare apex-to-homepage rule is removed and the apex CNAME is published before `www` becomes an alias. Other apexes on an anycast A record make the same DNS move so the origin issues the 301.

### Round 2

Bru's flip is one cutover. The Cloudflare rule is gone and the apex CNAME is in place when `www` starts 301ing to the apex. Other tenants' rows migrate without waiting on their apex DNS. That DNS move stays required and gates only Bru's direction flip.

### Proposed understanding

Confirmed.

## Answer

A stored `domain` stays the canonical host. The apex is an alias only when `redirectApex` is on. A tenant with no `domain` keeps the platform subdomain as the canonical host. Where a custom canonical host exists, the platform subdomain is an alias and 301s to it.

Bru Grappling is the one declaration the migration changes. The canonical host becomes `brugrappling.ie`. `www.brugrappling.ie` stays an alias. The platform subdomain 301s to the apex. `https://www.brugrappling.ie/kids` and `https://brugrappling.atnd.me/kids` 301 to `https://brugrappling.ie/kids`, which returns 200, is the canonical URL, and is the sitemap URL. `www` does not keep returning 200. Deep apex URLs serve that path. Signals those URLs already passed to the `www` homepage stay on the homepage.

The flip is one cutover. The zone owner publishes the apex CNAME to the SaaS target, and the Cloudflare rule that sends the apex to the `www` homepage is gone, when `www` starts 301ing to the apex.

Every other row migrates without waiting on DNS. An apex still on an anycast A record must move to an allowed setup so the origin issues the path-preserving 301. That move does not block the row.
