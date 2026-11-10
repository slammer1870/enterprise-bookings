# 14 — Register each serving host for Apple Pay

**What to build:** Every serving host is registered as its own Apple Pay domain. An alias host is not. The payment method domain is the whole registration, and a registered hostname does not host the association file.

**Blocked by:** 09 — Store the hostname list and Direction

**Status:** ready-for-agent

- [ ] Allow www and non-www on `www.example.com, example.com` registers both bare hostnames
- [ ] Redirect to www registers `www.example.com` and does not register `example.com`
- [ ] Redirect to non-www registers `example.com` and does not register `www.example.com`
- [ ] A serving hostname outside the canonical pair, such as `mysite.example.com` or `other.com`, is registered itself. Its pair partner is registered only when that partner also serves
- [ ] One registration does not cover another hostname
- [ ] With no custom hostname, the platform subdomain is the only Apple Pay domain
- [ ] Once a custom hostname is named, the platform subdomain is not registered
- [ ] A missing `www` or apex is not registered
- [ ] DNS status does not add or remove an Apple Pay domain
- [ ] A registered hostname does not host `/.well-known/apple-developer-merchantid-domain-association`
