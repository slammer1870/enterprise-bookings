# Bru Grappling public-host cutover

The one-shot migration writes every other tenant's canonical host and alias hosts. It leaves Bru Grappling on its stored serving hostname. `www` starts 301ing to the apex only after this cutover.

Do these in order. The script will not write unless both flags are present.

## 1. Publish the apex CNAME

In the zone for `brugrappling.ie`, point the apex at the SaaS target (`cname.<platform host>`, for example `cname.atnd.me`). Remove any apex A record at the anycast addresses.

## 2. Remove the homepage rule

In Cloudflare, delete the rule that sends `https://brugrappling.ie/<path>` to the `www` homepage. The origin must see the path.

## 3. Write the declaration

From `apps/atnd-me`, with `DATABASE_URI` set:

```bash
pnpm exec tsx scripts/cutover-bru-public-host.ts --apex-cname-live --homepage-rule-removed
```

This sets the canonical host to `brugrappling.ie` and the alias host to `www.brugrappling.ie`. The platform subdomain `bru-grappling.atnd.me` becomes an alias because a custom canonical host exists. It does not provision email, Apple Pay, or a new Cloudflare custom hostname.

Rolling back the data migration does not undo this write. To reverse it, set the canonical host back to `www.brugrappling.ie` and the alias host to `brugrappling.ie`.

## 4. Spot-check

- `https://brugrappling.ie/kids` returns 200, and the indexed URL is on the apex.
- `https://www.brugrappling.ie/kids?ref=1` returns 301 to `https://brugrappling.ie/kids?ref=1`.
- `https://brugrappling.atnd.me/kids?ref=1` returns 301 to the same URL.
- `www` does not return 200 for a tenant page.
