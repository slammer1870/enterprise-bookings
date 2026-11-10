# 12 — Edit the hostname list and Direction in admin

**What to build:** An org admin and a platform super-admin edit one comma-separated hostname field and one Direction. The public-host list shows each saved hostname's role. A Direction the list cannot support stays selected, the save is refused, and the stored Direction stays. The routing record, the status table, the TXT rows, the Apex Proxying rows, and the email-domain panel stay where they are.

**Blocked by:** 09 — Store the hostname list and Direction

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/public-host-list.e2e.spec.ts`. Direction availability: `apps/atnd-me/tests/unit/hostname-direction-form.test.ts`. Rendered roles, TXT rows, and Apex Proxying rows: `apps/atnd-me/tests/unit/public-host-list.test.ts`.

- [x] The custom domain field, the alias list, and Redirect apex are gone from the form
- [x] Hostnames are one comma-separated field. Direction sits under that field and above the public-host list
- [x] The choices are Allow www and non-www, Redirect to www, and Redirect to non-www. The default is Allow www and non-www
- [x] Both redirect choices stay visible. Redirect to www can be selected only when `www` of the first hostname's registrable domain is in the list. Redirect to non-www can be selected only when that apex is in the list
- [x] With no custom hostname, both redirect choices are unavailable. A later pair does not change that
- [x] When the selected Direction needs a hostname the list no longer has, the choice stays selected, saving is refused, and the stored Direction stays
- [x] The public-host list shows saved hostnames in typed order, then the platform subdomain. An org admin and a platform super-admin see the same list
- [x] Each typed hostname shows its role, a routing record, a DNS status, and a certificate status. The role reads canonical, serving, or alias to the host it redirects to
- [x] For `www.example.com, example.com`, Allow www and non-www marks `www.example.com` serving and `example.com` canonical. Redirect to www marks `www.example.com` canonical and `example.com` alias to `www.example.com`. Redirect to non-www marks `www.example.com` alias to `example.com` and `example.com` canonical
- [x] `example.com` alone makes Redirect to www unavailable. `www.example.com` alone makes Redirect to non-www unavailable. `blog.example.co.uk` alone, and `mysite.example.com` alone, make both unavailable, and that hostname is canonical
- [x] `www.other.com` without `other.com` shows as serving
- [x] The platform subdomain is role only: canonical when no custom hostname is named, and alias to the canonical host once one is
- [x] Saving assigns those roles immediately. DNS status and certificate status are read when the tenant is opened and may still be Pending or Unknown
- [x] The conditional TXT rows and the Apex Proxying rows stay. The email-domain panel stays where it is
