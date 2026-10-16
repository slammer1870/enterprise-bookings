# Bru Grappling public-host cutover

Do this before the hostname-list migration runs. That migration writes `brugrappling.ie, www.brugrappling.ie` with Redirect to non-www for every row, including Bru Grappling, and it does not wait on DNS. Once that row is written, `www` redirects to the apex. The checklist is not part of the public-host request checks, and this command does not write the row.

## 1. Publish the apex CNAME

In the zone for `brugrappling.ie`, point the apex at the SaaS target (`cname.<platform host>`, for example `cname.atnd.me`). Remove any apex A record at the anycast addresses.

## 2. Remove the homepage rule

In Cloudflare, delete the rule that sends `https://brugrappling.ie/<path>` to the `www` homepage. The origin must see the path.

## 3. Confirm the checklist

From `apps/atnd-me`, after both steps:

```bash
pnpm exec tsx scripts/cutover-bru-public-host.ts --apex-cname-live --homepage-rule-removed
```

The command does not write the tenant. Apply the hostname-list migration only after this succeeds.

## 4. Spot-check

After the migration:

- `https://brugrappling.ie/kids` returns 200, and the indexed URL is on the apex.
- `https://www.brugrappling.ie/kids?ref=1` returns 301 to `https://brugrappling.ie/kids?ref=1`.
- `https://brugrappling.atnd.me/kids?ref=1` returns 301 to the same URL.
- `www` does not return 200 for a tenant page.
