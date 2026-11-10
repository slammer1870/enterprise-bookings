# Which DNS setups can an apex canonical host use?

Type: grilling
Status: resolved

## Question

Bru Grappling's canonical host is the apex `brugrappling.ie`. Cloudflare for SaaS can serve that apex as its own custom hostname on the same fallback origin as `www`. An A record to the zone's anycast addresses is not a supported setup unless the account has Apex Proxying, and those addresses are a static prefix allocated to the account, not the A records of `cname.<platform>`. A CNAME at the apex is the documented default when the customer's DNS allows it. This app's apex panel tells the customer to A-record the anycast addresses.

Which of those setups does the spec allow for an apex canonical host?

## Comments

### Round 1

The spec allows two setups for an apex public host. A CNAME to the SaaS target is the default, including a DNS provider that flattens that CNAME. An A or AAAA record to the Apex Proxying allocated addresses is allowed when the platform account has that add-on. The spec does not require buying the add-on. An A record at the anycast addresses of the SaaS target is outside the spec.

Those setups apply to every apex public host, canonical or alias. A hostname with a label stays a CNAME to the SaaS target.

### Round 2

Existing anycast A records stay outside the spec, including hosts already published that way. Changing those records stays on [How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md).

The default setup is the routing record alone: a CNAME to the SaaS target, or Apex Proxying A/AAAA records. The ownership TXT and `_acme-challenge` TXT are the optional before-cutover path for a zone that is not already on Cloudflare. On a zone already on Cloudflare, hostname and certificate checks complete from the routing record.

### Proposed understanding

Confirmed by continuing this ticket. The www-to-apex direction is not part of this ticket. Equity for indexed URLs when Bru's serving host flips stays on [How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md).

## Answer

An apex public host, canonical or alias, uses one of two setups. The default is a CNAME to the SaaS target, including a DNS provider that flattens that CNAME. When the platform account has the Apex Proxying add-on, an A or AAAA record to that account's allocated addresses is also allowed. The spec does not require buying the add-on. Those addresses are the allocated prefix. An A record at the anycast addresses of the SaaS target is outside the spec, including for apexes already published that way. Changing those records stays on [How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md).

A hostname with a label stays a CNAME to the same SaaS target. The customer's default DNS is that routing record alone. On a zone already on Cloudflare, hostname and certificate checks complete from it. For a zone that is not already on Cloudflare, an ownership TXT and an `_acme-challenge` TXT are the optional before-cutover path, and they are not part of the default.

Naming the host still makes it canonical or an alias immediately. Which host is canonical is the tenant's declaration, not this DNS choice.
