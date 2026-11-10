# 15 — Point links and allowlists at the derived hosts

**What to build:** Onboarding, tenant context, and other site links that still read the single custom domain use the canonical host. A form posted from a named hostname is allowed for every hostname in the list.

**Blocked by:** 09 — Store the hostname list and Direction

**Status:** done

**Verified by:** `apps/atnd-me/tests/unit/tenant-seo-url.test.ts`, `apps/atnd-me/tests/unit/getTenantContext.test.ts`, `apps/atnd-me/tests/unit/tenant-email-branding.test.ts`. Form origins: `apps/atnd-me/tests/int/form-origin-allowlist.int.spec.ts`. Trusted hosts: `apps/atnd-me/tests/unit/auth-trusted-origins.test.ts`, `apps/atnd-me/tests/unit/admin-forgot-password-url.test.ts`.

- [x] A site link that today uses the custom domain uses the canonical host derived from the hostname list and Direction
- [x] With no custom hostname, that link uses the platform subdomain
- [x] A form posted from a hostname in the list is allowed, including a serving host that is not the canonical host and an alias host
- [x] A form posted from a hostname the tenant has not named is still refused
- [x] A row that only has the custom domain, the alias list, and Redirect apex still allows the hosts it allows today
