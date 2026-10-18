# 16 — Move existing tenants onto the hostname list

**What to build:** Each stored row becomes an ordered hostname list and one Direction. Bru Grappling's list is the apex, then `www`, with Redirect to non-www. The row write does not wait on DNS. The custom domain, the alias list, Redirect apex, and the stored parent remain until the old fields are removed. Bru's apex cutover stays an operator checklist.

**Blocked by:** 11 — Redirect each alias host to its pair partner, 12 — Edit the hostname list and Direction in admin, 13 — Send mail from the apex of the canonical host, 14 — Register each serving host for Apple Pay, 15 — Point links and allowlists at the derived hosts

**Status:** ready-for-agent

- [ ] The custom domain is the first hostname. Other stored alias hosts follow in stored order. Each hostname is listed once
- [ ] `www.example.com` with Redirect apex on and stored parent `example.com` becomes `www.example.com, example.com` with Redirect to www
- [ ] An empty stored parent stays off the list
- [ ] An apex whose `www` is already an alias becomes that apex, then that `www` host, with Redirect to non-www. This holds when Redirect apex is off
- [ ] Bru Grappling becomes `brugrappling.ie, www.brugrappling.ie` with Redirect to non-www while its stored custom domain is still `www.brugrappling.ie`. Any other stored alias follows those two, once
- [ ] A row with no custom domain stores an empty list and Allow www and non-www. Its alias hosts stay off the list
- [ ] A lone `www` host, a lone apex with no `www` alias, Redirect apex on with an empty stored parent, or `classes.example.com` stores that one hostname and Allow www and non-www. The stored parent of `classes.example.com` stays off the list
- [ ] Any other alias stays after the custom domain and its pair partner
- [ ] Every row stores a Direction
- [ ] The row write does not wait on DNS or a certificate
- [ ] The custom domain, the alias list, Redirect apex, and the stored parent are still present after the write
- [ ] After the write, public behavior for that row follows the hostname list and Direction
- [ ] Bru's apex CNAME to the SaaS target, and removal of the Cloudflare rule that sends that apex to the `www` homepage, stay an operator checklist before `www` redirects to the apex. That checklist is not part of the public-host request checks
