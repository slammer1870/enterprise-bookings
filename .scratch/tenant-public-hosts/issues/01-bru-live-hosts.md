# What do Bru Grappling's live hosts return?

Type: research
Status: resolved

## Question

For `brugrappling.ie`, `www.brugrappling.ie`, and Bru Grappling's platform subdomain, what does each host return today: status, redirect target, canonical link, document title, icons, `robots.txt`, and sitemap URLs?

Are the search symptom (Google pointed at the wrong host, or equity dropped by the redirect) and the brand symptom (platform title and favicon on a tenant host) the same failure or two?

Use the live responses as the source. Use this repo only to explain the behavior those responses show.

## Answer

Apex `brugrappling.ie` 301s at Cloudflare to the `www` homepage and drops the path, including `/robots.txt` and `/sitemap.xml`. `www.brugrappling.ie` and `brugrappling.atnd.me` both return 200 with Bru's title and logo, canonical `https://www.brugrappling.ie`, and sitemap URLs on `www`. The host/redirect mismatch and the platform title/favicon fallback are two failures; the brand fallback is not what these hosts return.

Findings: branch `research/bru-live-hosts`, file `docs/research/bru-live-hosts.md`.
