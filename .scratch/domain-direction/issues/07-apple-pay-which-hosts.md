# Which public hosts are registered for Apple Pay?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: none

## Question

The glossary says the Apple Pay domain is the apex of the custom canonical host, when one is named. The tenant form today registers that apex when Redirect apex is on, and registers the custom domain as well.

[What hostnames does Stripe require for Apple Pay on a site served from more than one hostname?](01-stripe-apple-pay-hostnames.md) found that each hostname which shows Apple Pay needs its own payment method domain, and that Stripe's registration guide does not tell you to host an association file. Apple's guide and one Stripe cartridge guide still put that file on each registered hostname.

Which public hosts are registered? Include allow www and non-www, redirect to www, redirect to non-www, a serving hostname that is not part of the canonical pair, and a tenant with no custom hostname. Say whether a registered hostname also hosts `/.well-known/apple-developer-merchantid-domain-association`, or whether the payment method domain is the whole registration.

## Comments

Every serving host is an Apple Pay domain. An alias host is not one. Checkout uses the Payment Element, so a hostname that serves can show Apple Pay, and that hostname is its own payment method domain. A hostname that redirects never shows the button.

- Allow www and non-www, with `www.example.com` and `example.com` named: both serve, so both are Apple Pay domains.
- Redirect to www: `www.example.com` is an Apple Pay domain. `example.com` redirects and is not one.
- Redirect to non-www: `example.com` is an Apple Pay domain. `www.example.com` redirects and is not one.
- A serving hostname outside the canonical pair, such as `mysite.example.com`, or `other.com` while `www.other.com` redirects to it: that serving hostname is an Apple Pay domain. Its pair partner is one only when that partner also serves.
- No custom hostname: the platform subdomain is the only serving host, so it is the only Apple Pay domain. Once any custom hostname is named, the platform subdomain redirects and is not an Apple Pay domain.

A missing www or apex is not invented. DNS status does not add or remove an Apple Pay domain. This replaces the earlier rule that the Apple Pay domain is the apex of the custom canonical host.

The payment method domain is the whole registration. A registered hostname does not host `/.well-known/apple-developer-merchantid-domain-association`.

## Answer

Every serving host is an Apple Pay domain, and an alias host is not one.

Allow www and non-www registers both hostnames in the pair. Redirect to www registers each `www` hostname that serves, and does not register an apex that redirects. Redirect to non-www registers each apex that serves, and does not register a `www` hostname that redirects. A serving hostname outside the canonical pair is registered itself. With no custom hostname, the platform subdomain is the only Apple Pay domain. Once a custom hostname is named, that platform subdomain redirects and is not registered.

The payment method domain is the whole registration. A registered hostname does not host `/.well-known/apple-developer-merchantid-domain-association`.
