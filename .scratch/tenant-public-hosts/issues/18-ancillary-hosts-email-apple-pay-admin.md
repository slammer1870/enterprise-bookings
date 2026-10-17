# What is in scope for email, Apple Pay, and admin login hosts?

Type: grilling
Status: resolved

## Question

[spec.md](spec.md) lists email sending domains, Apple Pay domain registration, and admin login hosts as out of scope for the public-page spec.

For this follow-on map: do any of these get their own handoff spec, share one “ancillary hosts” spec, or stay deferred with an explicit boundary?

## Answer

Deferred. No companion spec, and not one shared ancillary-hosts spec.

**Email sending domain.** When the tenant has named a custom canonical host, the From-domain is that hostname with a leading `www` removed (`www.studio.ie` sends as `studio.ie`; `shop.studio.ie` stays `shop.studio.ie`). That is not the apex. When no custom canonical host is named, mail stays on the platform address.

**Apple Pay domain.** When a custom canonical host is named, the Apple Pay domain is the apex. This map does not specify registration.

**Admin login.** There is no separate admin host. An alias host 301s `/admin` with every other path. This map does not exempt that path and does not say where the admin session lives.
