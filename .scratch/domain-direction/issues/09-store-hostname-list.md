# 09 — Store the hostname list and Direction

**What to build:** Saving a tenant stores an ordered hostname list and one Direction. Reading that declaration derives the canonical host, the serving hosts, and each alias host's target. A refused save leaves the stored declaration as it was. A row that still has only the custom domain, the alias list, and Redirect apex resolves as it does today.

**Blocked by:** None — can start immediately.

**Status:** done

**Verified by:** `apps/atnd-me/tests/int/tenant-public-host-declaration.int.spec.ts`. A later www/apex pair's derived roles: `apps/atnd-me/tests/unit/tenant-public-host-declaration.test.ts`.

- [x] Saving an ordered hostname list and one Direction stores that list and that Direction
- [x] Reading the declaration derives the canonical host, the serving hosts, and each alias host's target. Those roles are not stored
- [x] `www.example.com, example.com` with Allow www and non-www derives `example.com` as the canonical host and `www.example.com` as a serving host
- [x] That list with Redirect to www derives `www.example.com` as the canonical host and `example.com` as an alias to `www.example.com`
- [x] That list with Redirect to non-www derives `example.com` as the canonical host and `www.example.com` as an alias to `example.com`
- [x] The canonical host is chosen from the first hostname's registrable domain: `www` of that domain when Direction is Redirect to www and that `www` hostname is in the list, otherwise that apex when it is in the list, otherwise the first hostname
- [x] A named hostname that is not in a complete www/apex pair serves, and the missing partner is not invented
- [x] Every other www/apex pair follows the same Direction. Its serving host is not a second canonical host
- [x] An empty list stores Allow www and non-www. The platform subdomain is the canonical host and the only serving host
- [x] Once any custom hostname is named, the platform subdomain is an alias to the canonical host
- [x] The default Direction is Allow www and non-www
- [x] Redirect to www is refused unless `www` of the first hostname's registrable domain is in the list. Redirect to non-www is refused unless that apex is in the list. A later pair does not change that
- [x] A refused save leaves the stored hostname list and the stored Direction unchanged
- [x] A scheme, path, port, trailing dot, `localhost`, `*.localhost`, or IP address is refused
- [x] The platform host, the platform apex, and any subdomain of the platform apex are refused
- [x] A repeated hostname is refused. A hostname another tenant has named, or another tenant's platform subdomain, is refused
- [x] Naming a hostname claims its registrable apex. Another tenant naming a hostname on that apex is refused. A name that was not typed is not a public host. Removing the last hostname on an apex frees it
- [x] A row that only has the custom domain, the alias list, and Redirect apex still resolves as it does today
