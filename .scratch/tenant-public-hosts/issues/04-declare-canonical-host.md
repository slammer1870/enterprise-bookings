# How does a tenant declare its canonical host and aliases?

Type: grilling
Status: resolved
Blocked by: 02

## Question

A tenant names one canonical hostname. Any other hostname they add is an alias that 301s to it. Today a tenant has a single `domain` field, plus `redirectApex` and a hidden `apexDomain`.

What should replace that: the fields, how uniqueness works across tenants, what is rejected (platform host, localhost, duplicates), and what happens to a tenant that already has `domain` and `redirectApex` stored? Leave the migration steps for existing rows to [How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md). This ticket is the shape of the declaration.

## Comments

### Round 1

The tenant names an optional canonical host and a list of alias hosts. Nothing is inferred from another hostname. `redirectApex` and the derived `apexDomain` are not part of the declaration. The platform subdomain stays assigned from the slug.

A declared hostname is a bare hostname: lowercase, at least two labels, letters, digits, and hyphens. A scheme, path, port, or trailing dot is refused. `localhost`, `*.localhost`, and IP addresses are refused. The platform host, the platform apex, and any subdomain of the platform apex are refused, including every platform subdomain.

A hostname belongs to at most one tenant. The check covers every canonical host, every alias host, and every platform subdomain. The same tenant cannot list a hostname twice, and cannot use their canonical host as an alias.

### Round 2

An alias host may be any hostname that passes the rules above. It need not share the canonical host's apex. The list has no fixed cap.

A stored `domain` is the canonical host. When `redirectApex` is on, the stored `apexDomain` is an alias host. That value is one label stripped off the serving hostname, not a recomputed registrable domain. When `redirectApex` is off, or `apexDomain` is empty, the tenant has no alias host. Changing which host serves, including Bru Grappling moving from `www` to the apex, is a change of declaration for [How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md).

Naming a canonical host makes it the canonical host immediately. The platform subdomain becomes an alias host at that moment. DNS and certificate status are not part of the declaration.

### Round 3

A custom domain is a canonical host or alias host the tenant names. The platform subdomain is not a custom domain.

### Round 4

Alias hosts are named only together with a canonical host. A tenant who has named none has one public host, the platform subdomain. Clearing the canonical host while an alias remains is refused.

Declaring a hostname claims its apex for that tenant. The apex is the registrable domain (`blog.shop.example.co.uk` claims `example.co.uk`). Only that tenant may name a hostname on it. The claim lasts while they still name a hostname on that apex. A claimed apex does not create public hosts for names the tenant has not typed.

## Answer

A tenant names an optional canonical host and a list of alias hosts. The platform subdomain is assigned from the slug: it is the canonical host when none is named, and an alias host once one is named. Alias hosts are named only together with a canonical host. Clearing the canonical host while an alias remains is refused.

A declared hostname is a bare hostname: lowercase, at least two labels, letters, digits, and hyphens. A scheme, path, port, or trailing dot is refused, as are `localhost`, `*.localhost`, IP addresses, the platform host, the platform apex, and any subdomain of the platform apex. A hostname belongs to at most one tenant, checked across every canonical host, alias host, and platform subdomain. The same tenant lists it once.

An alias may be on any apex, with no cap. Declaring a hostname claims that registrable apex for the tenant while they still name a hostname on it. A hostname is a public host only when the tenant has typed it. Naming a host makes it canonical or an alias immediately. Replacing the canonical host drops the previous hostname unless it stays on the alias list, and a dropped hostname is an unknown host.

A stored `domain` reads as the canonical host. When `redirectApex` is on and `apexDomain` is set, that stored parent is an alias. How existing rows move stays on [How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md).
