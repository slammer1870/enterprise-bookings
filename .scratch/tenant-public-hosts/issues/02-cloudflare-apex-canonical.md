# What does Cloudflare require for an apex canonical host?

Type: research
Status: resolved

## Question

The spec will let a tenant name one canonical host that serves pages, plus alias hosts that 301 to it. Bru Grappling's canonical host is the apex `brugrappling.ie`, so `www` becomes an alias. Today the app registers one custom hostname and, when `redirectApex` is on, a second hostname for the apex that the app 301s toward `www`.

What does Cloudflare for SaaS actually require so an apex can be the serving host and one or more alias hostnames can terminate TLS on the same origin? Include how this repo registers custom hostnames today, and whether an apex serving host is possible with the certificate and DNS records Cloudflare documents.

Primary sources: Cloudflare's own docs, and this repo's custom-hostname code.

## Answer

An apex can be the serving custom hostname, with `www` as a second custom hostname on the same fallback origin. The apex needs a CNAME to the SaaS CNAME target, or an Enterprise Apex Proxying A record aimed at the account's allocated static IPs rather than the zone's anycast addresses. Each alias needs its own custom hostname and certificate, plus a CNAME to that same target. This app registers the apex only as the redirect source and tells customers to A-record it at the anycast addresses of `cname.<platform>`.

Findings: branch `research/cloudflare-apex-canonical`, file `docs/research/cloudflare-apex-canonical.md`.
