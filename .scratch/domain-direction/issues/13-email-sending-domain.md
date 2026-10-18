# 13 — Send mail from the apex of the canonical host

**What to build:** The email sending domain is the apex of the canonical host. Direction does not change it. Another apex in the hostname list is not an email sending domain. With no custom hostname, mail uses the platform apex. The email-domain panel stays where it is and shows that domain.

**Blocked by:** 09 — Store the hostname list and Direction

**Status:** ready-for-agent

- [ ] `www.example.com`, `example.com`, and `mysite.example.com` send as `example.com`
- [ ] `blog.shop.example.co.uk` sends as `example.co.uk` when that apex is not in the list
- [ ] For a list whose canonical host is `example.com` and which also names `other.com`, the email sending domain is `example.com`
- [ ] Redirect to www on `www.example.com, example.com` still sends as `example.com`
- [ ] With no custom hostname, the email sending domain is the platform apex
- [ ] The email-domain panel stays where it is, keeps its shape, and shows this email sending domain
