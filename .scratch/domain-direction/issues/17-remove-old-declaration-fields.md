# 17 — Remove the old declaration fields

**What to build:** The custom domain, the alias list, Redirect apex, and the stored parent leave the tenant record. The hostname list and Direction are the only source of which public host serves, which host redirects, which hostname mail sends from, and which hostnames are registered for Apple Pay.

**Blocked by:** 16 — Move existing tenants onto the hostname list

**Status:** done

- [x] `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` are gone from the tenant record
- [x] Saving a tenant no longer accepts those fields as the declaration
- [x] Public responses, admin, the email sending domain, Apple Pay, links, and allowlists read the hostname list and Direction
- [x] A tenant that was migrated still serves, redirects, sends mail, and registers Apple Pay from that declaration
- [x] Redirect apex does not remain beside Direction
