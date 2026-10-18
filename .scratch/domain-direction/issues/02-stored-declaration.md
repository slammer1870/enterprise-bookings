# What does the tenant record store for hostnames and Direction?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: none

## Question

The tenant declares an ordered list of hostnames and one Direction. Roles are derived from that list: which host is canonical, which hosts serve, and which hosts redirect, including redirects that stay inside a www/apex pair and do not target the canonical host.

What does the tenant record store? The ordered list and Direction, with roles derived on read? Or the derived roles, written at save time? Say what is removed from the declaration (`domain` as the single custom domain, `aliasHosts`, `redirectApex`, `apexDomain`) and what remains the source of which host serves.

## Comments

The tenant record stores the hostname list and one Direction. Canonical host, serving hosts, and alias hosts are derived on read. For Bru Grappling, the list names `brugrappling.ie` and `www.brugrappling.ie` and Direction is redirect to non-www. A reader derives that `brugrappling.ie` is the canonical host and that `www.brugrappling.ie` redirects to it. Changing Direction changes that result without rewriting a stored role.

`domain`, `aliasHosts`, `redirectApex`, and `apexDomain` are removed from the declaration. The hostname list and Direction are the only source of which host serves.

## Answer

The tenant record stores the ordered hostname list and one Direction. Which host is canonical, which hosts serve, and which hosts redirect are derived from that list and Direction on read. Redirect targets are not stored.

`domain`, `aliasHosts`, `redirectApex`, and `apexDomain` leave the declaration. The hostname list and Direction are the source of which host serves.
