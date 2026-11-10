# How do existing tenants move to a hostname list and Direction?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: none

## Question

A stored row has `domain`, `aliasHosts`, `redirectApex`, and sometimes `apexDomain`. [How do existing tenants move to a canonical host?](../../tenant-public-hosts/issues/05-migrate-existing-tenants.md) mapped a stored `domain` to the canonical host and, when Redirect apex was on, the stored parent to an alias.

What ordered hostname list and Direction does each of those shapes become? Include a tenant whose custom domain is `www` with Redirect apex on, a tenant whose custom domain is the apex with `www` already an alias, and Bru Grappling, whose canonical host is `brugrappling.ie` and whose `www` host redirects to it. Say whether any row is left without a Direction.

## Comments

The custom domain is the first hostname. Other stored aliases follow in stored order, once.

`www.example.com` with Redirect apex on and stored parent `example.com` (`apexDomain`) becomes `www.example.com, example.com` with Direction redirect to www. An apex whose `www` is already an alias becomes the apex, then that `www` host, with Direction redirect to non-www. That pairing does not depend on Redirect apex being on. Bru Grappling is that result even while its stored custom domain is still `www.brugrappling.ie`: `brugrappling.ie, www.brugrappling.ie`.

A row with no pair partner gets Direction allow www and non-www. That is no custom domain, one named hostname, or Redirect apex on with an empty `apexDomain`. Alias hosts on a row with no custom domain stay off the list. A custom domain that is neither `www` nor the apex, such as `classes.example.com`, is that one hostname, and its stored parent stays off the list. Any other alias stays after the custom domain and its pair partner.

Every row stores a Direction. The refactor removes `domain`, `aliasHosts`, `redirectApex`, and `apexDomain`. Redirect apex does not remain beside Direction.

## Answer

The custom domain is the first hostname. Other stored alias hosts follow in stored order. Each hostname is listed once.

When Redirect apex is on, `apexDomain` is set, and the custom domain is `www` of that parent, the list is `www.example.com, example.com`. Direction is redirect to www. `www.example.com` stays canonical and `example.com` redirects to it. An empty `apexDomain` stays off the list.

When the custom domain is the apex and `www` of that apex is already an alias, the list is `example.com, www.example.com`. Direction is redirect to non-www. `example.com` stays canonical and `www.example.com` redirects to it. This holds when Redirect apex is off.

Bru Grappling is that same result while its stored custom domain is still `www.brugrappling.ie`. The list is `brugrappling.ie, www.brugrappling.ie`. Direction is redirect to non-www.

When the row names no custom domain, the list is empty and Direction is allow www and non-www. Alias hosts on that row stay off the list.

When the row names one hostname and no pair partner, the list is that hostname and Direction is allow www and non-www. That is a lone `www` host, a lone apex with no `www` alias, Redirect apex on with an empty `apexDomain`, or a custom domain that is neither `www` nor the apex. The stored parent of `classes.example.com` stays off the list, so `classes.example.com` stays canonical.

Any other alias host stays on the list after the custom domain and its pair partner. It serves, or follows Direction inside its own pair, and names the canonical host as the indexed URL.

Every row stores a Direction. The refactor removes `domain`, `aliasHosts`, `redirectApex`, and `apexDomain`. Redirect apex does not remain beside Direction.
