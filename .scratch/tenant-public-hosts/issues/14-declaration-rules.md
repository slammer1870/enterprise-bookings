# 14 — Enforce the declaration rules

**What to build:** Saving a canonical host or an alias host is refused when the hostname is not allowed. A hostname belongs to one tenant, and naming one claims its apex. Dropping a hostname makes it an unknown host. An alias on another apex redirects. The claim ends when the tenant no longer names a hostname on that apex.

**Blocked by:** 11 — Redirect alias hosts to the canonical host; 13 — Answer unknown hosts and failed lookups without the platform mark

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/tenant-public-host-declaration.e2e.spec.ts`, `apps/atnd-me/tests/int/tenant-public-host-declaration.int.spec.ts`, `apps/atnd-me/tests/unit/tenant-public-host-declaration.test.ts`, `apps/atnd-me/tests/unit/validateCustomDomain.test.ts`, `apps/atnd-me/src/utilities/tenantPublicHostDeclaration.ts`

- [x] A scheme, path, port, trailing dot, `localhost`, `*.localhost`, or IP address is refused
- [x] The platform host, the platform apex, and any subdomain of the platform apex are refused
- [x] A hostname that is already a canonical host, an alias host, or a platform subdomain of any tenant is refused, including a repeat on the same tenant and the canonical host listed as its own alias
- [x] An alias is refused when no canonical host is named, and clearing the canonical host while an alias remains is refused
- [x] Naming `blog.shop.example.co.uk` claims `example.co.uk`; another tenant naming a hostname on that apex is refused, and a name the first tenant did not type is an unknown host
- [x] Removing the last hostname on an apex lets another tenant name one there
- [x] Replacing the canonical host makes the previous hostname an unknown host, unless it stays on the alias list, in which case it 301s
- [x] An alias on a different apex can be saved, and a request to it 301s to the canonical host
- [x] There is no fixed cap on alias hosts
- [x] A newly named host takes its role on the next request, with no DNS or certificate check
- [x] An org admin and a platform super-admin hit the same rules
- [x] The public checks use the same Playwright request seam as the earlier tickets
