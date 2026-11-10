# Hostname list and Direction

Status: ready-for-agent

This spec replaces [Tenant public hosts](../tenant-public-hosts/spec.md), [Tenant public hosts — admin and customer DNS](../tenant-public-hosts/spec-admin-dns.md), and [Tenant public hosts — migration](../tenant-public-hosts/spec-migration.md) as the source of which public host serves. The admin DNS spec remains the wording for the routing record, the status table, conditional TXT rows, and Apex Proxying rows. Glossary: `CONTEXT.md`.

## Problem Statement

A tenant names one custom domain, a separate alias list, and Redirect apex. That declaration cannot say that both `www` and the apex serve, or that a second registrable domain serves beside the canonical host and only redirects inside its own www/apex pair. Readers of those fields disagree about which host is indexed, which host redirects, which hostname mail sends from, and which hostnames are registered for Apple Pay.

Bru Grappling's stored custom domain is still `www.brugrappling.ie`. The apex should serve, and `www` should redirect to it.

## Solution

The tenant names an ordered hostname list and one Direction. The canonical host, the serving hosts, and the alias hosts are derived from that declaration when it is read. `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` leave. Every reader uses the derived roles.

With no custom hostname, the platform subdomain is the canonical host and the only serving host. Once any custom hostname is named, the platform subdomain redirects to the canonical host. A www/apex pair follows Direction. Any other named hostname serves, and names the canonical host as the indexed URL.

## User Stories

1. As an org admin, I want to name an ordered list of hostnames in one field, separated by commas, so that one declaration is the source of which public host serves.
2. As an org admin, I want the platform subdomain left off that list, so that the hostname assigned from the slug is not something I type.
3. As an org admin, I want one Direction for the whole list, so that every www/apex pair follows the same rule.
4. As an org admin, I want Direction to default to Allow www and non-www, so that a new list serves both hostnames in a pair until I choose otherwise.
5. As an org admin, I want to choose Redirect to www, so that each named apex redirects to `www` of that apex.
6. As an org admin, I want to choose Redirect to non-www, so that each named `www` host redirects to its apex.
7. As an org admin, I want Redirect to www refused unless `www` of the first hostname's registrable domain is in the list, so that the platform does not invent that hostname.
8. As an org admin, I want Redirect to non-www refused unless that apex is in the list, so that the platform does not invent the apex.
9. As an org admin, I want both redirect choices to stay visible when they cannot be saved, so that I can see the rule I would be choosing.
10. As an org admin, I want both redirect choices unavailable when I have named no custom hostname, so that Direction has no pair to apply to.
11. As an org admin, I want a later incomplete pair to leave those choices as they are, so that `www.other.com` without `other.com` does not decide whether Redirect to www is allowed.
12. As an org admin, I want a missing pair partner left untyped, so that naming `www.other.com` does not create `other.com`.
13. As an org admin, I want a hostname that is neither `www` nor the apex of a pair to serve, so that `mysite.example.com` is a serving host under any Direction.
14. As an org admin, I want the canonical host chosen from the first hostname's registrable domain, so that order in the list decides which apex is indexed.
15. As an org admin, I want `www` of that domain to be the canonical host when Direction is Redirect to www and that `www` hostname is in the list, so that the indexed host is the one visitors are sent to.
16. As an org admin, I want that apex to be the canonical host when it is in the list and Direction is not Redirect to www, so that Allow www and non-www and Redirect to non-www both index the apex.
17. As an org admin, I want the first hostname to be the canonical host when neither that `www` host nor that apex is the chosen canonical host, so that `blog.example.co.uk` alone is canonical.
18. As an org admin, I want every other www/apex pair to follow the same Direction inside the pair, so that `www.other.com` redirects to `other.com` when Direction is Redirect to non-www.
19. As an org admin, I want the serving host of that other pair to name the canonical host as the indexed URL, so that `other.com` serves and is not a second indexed host.
20. As an org admin, I want `www.example.com, example.com` with Allow www and non-www to mark `example.com` canonical and `www.example.com` serving, so that both hostnames return pages.
21. As an org admin, I want that same list with Redirect to www to mark `www.example.com` canonical and `example.com` alias to `www.example.com`, so that the apex redirects to `www`.
22. As an org admin, I want that same list with Redirect to non-www to mark `example.com` canonical and `www.example.com` alias to `example.com`, so that `www` redirects to the apex.
23. As an org admin, I want `example.com` alone to make Redirect to www unavailable, and `www.example.com` alone to make Redirect to non-www unavailable, so that each choice requires the hostname it would redirect toward.
24. As an org admin, I want `blog.example.co.uk` alone, and `mysite.example.com` alone, to make both redirect choices unavailable, and to be the canonical host, so that a hostname with no pair partner still serves.
25. As an org admin, I want an empty hostname list to make the platform subdomain the canonical host and the only serving host, so that a tenant with no custom domain still has a public host.
26. As an org admin, I want the platform subdomain to redirect to the canonical host once any custom hostname is named, so that the assigned hostname does not compete with the host I named.
27. As an org admin, I want a declared hostname to stay a bare hostname, so that a scheme, path, port, or trailing dot is refused.
28. As an org admin, I want `localhost`, `*.localhost`, and IP addresses refused, so that a public host is a real hostname.
29. As an org admin, I want the platform host, the platform apex, and any subdomain of the platform apex refused, so that a tenant cannot claim the platform's own names.
30. As an org admin, I want a repeated hostname on my tenant refused, so that each public host is named once.
31. As an org admin, I want a hostname that another tenant has named, or that is another tenant's platform subdomain, refused, so that a public host belongs to one tenant.
32. As an org admin, I want declaring a hostname to claim its registrable apex, so that another tenant cannot name a hostname on `example.co.uk` after I have named `blog.shop.example.co.uk`.
33. As an org admin, I want the claim to last only while I still name a hostname on that apex, so that releasing the last name frees the apex.
34. As a visitor, I want a name I did not type on a claimed apex to be an unknown host, so that claiming an apex does not publish extra hosts.
35. As an org admin, I want a named host to take its derived role immediately, so that serving does not wait on DNS or a certificate.
36. As an org admin, I want removing a hostname from the list to make it an unknown host, so that a dropped name no longer resolves to my tenant.
37. As an org admin, I want no fixed cap on the hostname list, so that every hostname I still use can be named.
38. As a platform super-admin, I want the same declaration rules as an org admin, so that a hostname means the same thing whoever saves it.
39. As an org admin, I want the custom domain field, the alias list, and Redirect apex gone from the form, so that I cannot save the old declaration beside the new one.
40. As an org admin, I want Direction under the hostname field and above the public-host list, so that the control sits with the list it applies to.
41. As an org admin, I want the public-host list to show saved hostnames in the order I typed, then the platform subdomain, so that I can see the declaration I saved.
42. As a platform super-admin, I want that same public-host list, so that org admin and super-admin read one arrangement.
43. As an org admin, I want each typed hostname to show its role, a routing record, a DNS status, and a certificate status, so that a hostname that redirects is still a row I can publish.
44. As an org admin, I want the role to read canonical, serving, or alias to the host it redirects to, so that I can tell a serving host from an alias host.
45. As an org admin, I want the canonical host's row to read canonical, so that the indexed host is marked even though it is also a serving host.
46. As an org admin, I want the platform subdomain to show its role only, so that it has no routing record and no DNS or certificate status.
47. As an org admin, I want the platform subdomain's role to read canonical when I have named no custom hostname, and alias to the canonical host once I have, so that the assigned hostname's role matches public behavior.
48. As an org admin, I want saving to assign those roles immediately, so that the list matches the declaration without waiting for DNS status or certificate status.
49. As an org admin, I want DNS status and certificate status to be read when I open the tenant, so that a row may still say Pending or Unknown after the role is assigned.
50. As an org admin, I want the conditional TXT rows and the Apex Proxying rows to stay, so that publishing DNS is unchanged.
51. As an org admin, I want the email-domain panel to stay where it is, so that changing the declaration does not move that panel.
52. As an org admin, I want a Direction that no longer matches the list to stay selected, the save to be refused, and the stored Direction to stay, so that a bad edit does not replace the declaration.
53. As a visitor on the canonical host, I want `/` and a content path to return 200, so that `/kids` is that page.
54. As a visitor on a serving host that is not the canonical host, I want `/` and a content path to return 200, so that `www.example.com` and `mysite.example.com` serve when Direction allows them.
55. As a search crawler on any serving host, I want no `noindex` on that page, so that a second serving host is not hidden from indexing by a robots directive.
56. As a search crawler on any serving host, I want the canonical link and the Open Graph URL to be the indexed URL, so that I index `https://<canonical host><path>` and not the host I requested.
57. As a search crawler, I want the indexed URL to omit the query and the port, so that `/kids` and `/kids?ref=1` share one indexed URL.
58. As a search crawler, I want the path in the indexed URL to be the request path, so that the spec does not add a trailing-slash rule.
59. As a search crawler on a serving host that is not the canonical host, I want `/robots.txt` to return 200 with the same allow and disallow rules, so that the crawl rules apply to the host I requested.
60. As a search crawler, I want that `robots.txt` to allow `/`, disallow `/admin/` and `/api/`, and point its Sitemap line at `https://<canonical host>/sitemap.xml`, so that I crawl the public site and read the sitemap on the canonical host.
61. As a search crawler on a serving host that is not the canonical host, I want `/sitemap.xml` to 301 to `https://<canonical host>/sitemap.xml`, so that a second sitemap is not published.
62. As a search crawler on the canonical host, I want `/sitemap.xml` to list `/`, `/search`, `/posts`, each published page, and each published post as indexed URLs, so that I discover URLs on the host that is indexed.
63. As a search crawler, I want unpublished pages and posts left out of the sitemap, so that I do not index drafts.
64. As a search crawler on any serving host, I want `/pages-sitemap.xml` and `/posts-sitemap.xml` to return 404, so that a second sitemap cannot list the platform origin.
65. As a visitor on an alias host, I want a 301 to `https://<pair partner><path><query>` with no port, so that I land on the other hostname in that www/apex pair.
66. As a visitor on an alias host, I want that 301 for every path, including `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`, so that an alias does not publish its own files.
67. As a visitor on the platform subdomain once a custom hostname is named, I want a 301 to `https://<canonical host><path><query>` with no port, so that the assigned hostname redirects to the indexed host.
68. As a search crawler, I want `https://www.other.com/sitemap.xml` to 301 to `https://other.com/sitemap.xml`, and that host to 301 to the canonical host, so that an alias follows its pair and the sitemap still ends on the canonical host.
69. As a search crawler, I want `https://www.other.com/pages-sitemap.xml` to 301 to `https://other.com/pages-sitemap.xml`, and that host to return 404, so that the pair partner answers the sitemap route.
70. As a visitor, I want the origin to issue the 301, so that Cloudflare proxies the hostname and does not redirect it.
71. As a visitor on an alias host, I want no page of the tenant's site in the response, so that only a serving host returns the page.
72. As a visitor on the platform subdomain when no custom hostname is named, I want the site served there, so that a tenant with no custom domain still has a public host.
73. As a visitor on the platform apex, I want the platform's own redirect to the platform `www` host left as a platform concern, so that a tenant apex is not mixed up with the platform apex.
74. As a visitor on an unknown host, I want a 404 titled "Not found", with no icon and `noindex`, for the page, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`, so that an unknown host publishes none of those files.
75. As a visitor when the host lookup throws, I want a 503 titled "Unavailable", with no icon and `noindex`, for those same paths, so that a failed lookup does not publish a homepage sitemap.
76. As a visitor on a resolved tenant with no logo, I want the document title to stay the tenant's name and no icon to be emitted, so that a missing logo does not become the platform mark.
77. As a visitor on a page with no image of its own, I want no share image, so that the platform's default image is not used for the tenant.
78. As a visitor, I want the title, description, and site name to stay the tenant's, so that the page is identified as that business.
79. As a visitor on a platform host, I want the platform mark, so that the platform's own site keeps its icon and default share image.
80. As an org admin, I want the email sending domain to be the apex of the canonical host, so that `www.example.com`, `example.com`, and `mysite.example.com` send as `example.com`.
81. As an org admin, I want `blog.shop.example.co.uk` to send as `example.co.uk`, so that the email sending domain is the claimed apex even when that apex is not in the list.
82. As an org admin, I want another apex in the list to not be an email sending domain, so that `other.com` does not send mail when `example.com` is the canonical host.
83. As an org admin, I want Direction to leave the email sending domain unchanged, so that Redirect to www still sends as the apex.
84. As an org admin, I want the email sending domain to be the platform apex when I have named no custom hostname, so that mail follows the platform subdomain's apex.
85. As a visitor checking out on a serving host, I want that hostname registered as its own Apple Pay domain, so that Apple Pay can be offered on the host I am on.
86. As a visitor on an alias host, I want that hostname not registered for Apple Pay, so that a host that only redirects is not a payment method domain.
87. As a visitor, I want Allow www and non-www to register both hostnames in the pair, Redirect to www to register each `www` hostname that serves, and Redirect to non-www to register each apex that serves, so that registration matches the hosts that return pages.
88. As a visitor, I want a serving hostname outside the canonical pair, such as `mysite.example.com` or `other.com`, registered itself, so that one registration does not cover another hostname.
89. As a visitor on the platform subdomain when it is the only serving host, I want that subdomain to be the only Apple Pay domain, so that a tenant with no custom hostname can still offer Apple Pay there.
90. As a visitor, I want the platform subdomain not registered once a custom hostname is named, so that a redirecting assigned hostname is not an Apple Pay domain.
91. As a visitor, I want a missing `www` or apex left unregistered, so that Apple Pay does not invent a hostname.
92. As a visitor, I want DNS status to neither add nor remove an Apple Pay domain, so that Pending does not change registration.
93. As a visitor, I want the payment method domain to be the whole registration, so that a registered hostname does not host the association file.
94. As a platform operator, I want each stored custom domain to become the first hostname, and other stored aliases to follow in stored order, once, so that existing rows become one list.
95. As a platform operator, I want `www.example.com` with Redirect apex on and stored parent `example.com` to become `www.example.com, example.com` with Direction Redirect to www, so that `www` stays canonical and the apex redirects to it.
96. As a platform operator, I want an empty stored parent to stay off the list, so that Redirect apex on with no parent does not invent an apex.
97. As a platform operator, I want an apex whose `www` is already an alias to become that apex, then that `www` host, with Direction Redirect to non-www, so that the apex stays canonical.
98. As a platform operator, I want that pairing when Redirect apex is off, so that the alias list decides the pair and the flag does not.
99. As Bru Grappling's operator, I want the list to become `brugrappling.ie, www.brugrappling.ie` with Direction Redirect to non-www, even while the stored custom domain is `www.brugrappling.ie`, so that the apex is the canonical host.
100. As a platform operator, I want a row with no custom domain to store an empty list and Allow www and non-www, and to leave its alias hosts off the list, so that the platform subdomain stays the only serving host.
101. As a platform operator, I want a row with one hostname and no pair partner to store that hostname and Allow www and non-www, so that a lone `www` host, a lone apex, or `classes.example.com` stays canonical.
102. As a platform operator, I want the stored parent of `classes.example.com` to stay off the list, so that a hostname that is neither `www` nor the apex does not gain a pair it did not have.
103. As a platform operator, I want any other alias to stay after the custom domain and its pair partner, so that a hostname outside the pair is kept and follows Direction only inside its own pair.
104. As a platform operator, I want every row to store a Direction, so that no tenant is left without one.
105. As a platform operator, I want `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` removed, so that Redirect apex does not remain beside Direction.
106. As a platform operator, I want the row written without waiting on DNS, so that the declaration is ready before a customer fixes records.
107. As Bru Grappling's operator, I want the apex to CNAME to the SaaS target, and the Cloudflare rule that sends that apex to the `www` homepage removed, before `www` redirects to the apex, so that deep apex URLs serve instead of dropping to the homepage.
108. As a visitor to Bru Grappling, I want `https://brugrappling.ie/kids` to return 200, and its canonical link, Open Graph URL, and sitemap URL to be `https://brugrappling.ie/kids`, so that the apex is the host that is indexed.
109. As a visitor to `https://www.brugrappling.ie/kids?ref=1`, and to `https://brugrappling.atnd.me/kids?ref=1`, I want a 301 to `https://brugrappling.ie/kids?ref=1`, so that `www` and the platform subdomain keep the path and the query.
110. As a visitor to the allow-www-and-non-www fixture `www.example.com, example.com`, I want `https://www.example.com/kids?ref=1` to return 200 and name `https://example.com/kids`, so that `www` serves and the apex is indexed.
111. As a search crawler on that fixture, I want `https://www.example.com/sitemap.xml` to 301 to `https://example.com/sitemap.xml`, so that the sitemap is published on the canonical host.

## Implementation Decisions

### Declaration

- The tenant record stores the ordered hostname list and one Direction. The canonical host, the serving hosts, and the alias hosts, including each alias host's target, are derived when the declaration is read. Redirect targets are not stored. Changing Direction changes the derived roles without a stored role being rewritten.
- `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` leave the declaration. The hostname list and Direction are the only source of which host serves. Every reader that used those fields follows the derived roles. The platform subdomain stays assigned from the slug and is not an entry in the list.
- Direction is one value for the whole list: Allow www and non-www, Redirect to www, or Redirect to non-www. The default is Allow www and non-www. Every tenant stores a Direction, including a tenant with an empty list.
- The canonical host is chosen from the first hostname's registrable domain. When Direction is Redirect to www and `www` of that domain is in the list, that `www` host is the canonical host. Otherwise, when that apex is in the list, the apex is the canonical host. Otherwise the first hostname is the canonical host.
- A www/apex pair is two named hostnames, `www` of a registrable domain and that apex. Direction applies inside every such pair. Redirect to www makes the apex an alias host targeting `www`. Redirect to non-www makes `www` an alias host targeting the apex. Allow www and non-www makes both serving hosts. The pair that contains the canonical host uses that same rule, which is how the canonical host is chosen above.
- A named hostname that is not in a complete pair serves. Direction does not redirect it, and the missing partner is not invented. `www.other.com` without `other.com` serves. `other.com` without `www.other.com` serves. `mysite.example.com` serves. The serving host of a pair that is not the canonical pair also serves, and its indexed URL names the canonical host.
- With no custom hostname, the platform subdomain is the canonical host and the only serving host. Once any custom hostname is named, the platform subdomain is an alias host targeting the canonical host.
- Saving is refused when Direction is Redirect to www and `www` of the first hostname's registrable domain is not in the list, or when Direction is Redirect to non-www and that apex is not in the list. Availability follows the first hostname only. A later pair does not change it. A refused save leaves the stored hostname list and the stored Direction as they were.
- A declared hostname is a bare hostname: stored lowercase, at least two labels, letters, digits, and hyphens. A scheme, path, port, or trailing dot is refused. `localhost`, `*.localhost`, and IP addresses are refused. The platform host, the platform apex, and any subdomain of the platform apex are refused, including every platform subdomain. The same hostname is refused twice on one tenant. Uniqueness covers every named hostname and every platform subdomain. There is no cap.
- Declaring a hostname claims its registrable apex (`blog.shop.example.co.uk` claims `example.co.uk`) for that tenant until they no longer name a hostname on it. Names the tenant has not typed are not public hosts. A hostname removed from the list is an unknown host. Naming a host gives it the derived role on the next request. DNS status and certificate status do not change that role.
- The form is one comma-separated field. Each entry is one bare hostname. Direction is not part of that field.

### Public responses

- A serving host, including the canonical host and any other serving host, returns 200 for `/` and for a content path. The page has no `noindex`. The canonical link and the Open Graph URL are the indexed URL.
- The indexed URL is `https://<canonical host><path>` with no query and no port. The path is the request path. There is no new trailing-slash rule. Sitemap entries on the canonical host use the indexed URL. They are not taken from the request host.
- `/robots.txt` on a serving host returns 200. It allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`.
- `/sitemap.xml` on the canonical host lists `/`, `/search`, `/posts`, each published page, and each published post. Unpublished pages and posts are left out. A failed lookup does not substitute a homepage sitemap. `/sitemap.xml` on a serving host that is not the canonical host returns 301 to `https://<canonical host>/sitemap.xml`, preserving the query and using https with no port.
- `/pages-sitemap.xml` and `/posts-sitemap.xml` on a serving host return 404.
- An alias host returns 301 to its pair partner for every path, including `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. The target is `https://<pair partner><path><query>` with no port. `www.other.com/sitemap.xml` redirects to `other.com/sitemap.xml`, which redirects to the canonical host. `www.other.com/pages-sitemap.xml` redirects to `other.com/pages-sitemap.xml`, which returns 404. The response is the redirect, not a page of the site.
- The platform subdomain, once a custom hostname is named, uses that same redirect shape with the canonical host as the target. When no custom hostname is named, the platform subdomain serves as the canonical host.
- The origin issues the 301. Cloudflare proxies the hostname and does not redirect it.
- An unknown host is a 404 titled "Not found", with no icon and `noindex`, for the page and for `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. A failed lookup is a 503 titled "Unavailable", with no icon and `noindex`, for those same paths. A thrown lookup is a failed lookup, not an unknown host and not the platform site.
- A resolved tenant keeps its name as the document title when it has no separate page title, and keeps its description and site name. No logo means no icon. No page image means no share image. The platform mark is emitted only on a platform host.
- The platform apex redirecting to the platform `www` host stays a platform concern.

### Admin

- The custom domain field, the alias list, and Redirect apex leave the form. One comma-separated hostname field has Direction under it and above the public-host list. The choices are Allow www and non-www, Redirect to www, and Redirect to non-www. The default is Allow www and non-www.
- Redirect to www can be selected only when `www` of the first hostname's registrable domain is in the list. Redirect to non-www can be selected only when that apex is in the list. Both choices stay visible. With no custom hostname, both are unavailable. A later pair does not change that. `www.other.com` without `other.com` is shown as a serving host after save, and the missing hostname is left untyped.
- If the selected Direction needs a hostname the list no longer has, the choice stays selected, saving is refused, and the stored Direction stays.
- The public-host list shows saved hostnames in typed order, then the platform subdomain. A platform super-admin and an org admin see the same list. Each typed hostname, including one that redirects, shows its role, a routing record, a DNS status, and a certificate status. The role reads canonical, serving, or alias to the host it redirects to. The canonical host's row reads canonical. The platform subdomain is role only: canonical when no custom hostname is named, and alias to the canonical host once one is.
- Saving gives each hostname its derived role immediately. DNS status and certificate status are read when the tenant is opened and may still be Pending or Unknown. They do not change which host serves.
- The routing record, the status table, conditional TXT rows, and Apex Proxying rows stay as specified in the admin DNS spec. This spec does not restate that table.
- The email-domain panel stays where it is. Its shape is unchanged. The domain it shows is the email sending domain below.

### Email sending domain

- The email sending domain is the apex of the canonical host. `www.example.com`, `example.com`, and `mysite.example.com` share `example.com`. `blog.shop.example.co.uk` sends as `example.co.uk`. That apex need not be in the hostname list. Direction does not change it.
- Another apex in the list is not an email sending domain. For `www.example.com, example.com, www.other.com, other.com` with the canonical host `example.com`, the email sending domain is `example.com`.
- With no custom hostname, the canonical host is the platform subdomain, so the email sending domain is the platform apex.

### Apple Pay

- Every serving host is an Apple Pay domain. An alias host is not one. The registered name is the bare hostname. One registration does not cover another hostname.
- Allow www and non-www registers both hostnames in each complete pair, and registers every other serving host. Redirect to www registers each `www` hostname that serves and does not register an apex that redirects. Redirect to non-www registers each apex that serves and does not register a `www` hostname that redirects. A serving hostname outside the canonical pair is registered itself.
- With no custom hostname, the platform subdomain is the only Apple Pay domain. Once a custom hostname is named, the platform subdomain redirects and is not registered. A missing `www` or apex is not invented. DNS status does not add or remove an Apple Pay domain.
- The payment method domain is the whole registration. A registered hostname does not host `/.well-known/apple-developer-merchantid-domain-association`. This replaces the earlier rule that the Apple Pay domain is the apex of the custom canonical host.

### Migration

- The migration reads each tenant once and writes the hostname list and one Direction. It does not wait on DNS or certificate status. After the row is written, public behavior follows Public responses, except for the Bru Grappling cutover gate below.
- The custom domain is the first hostname. Other stored alias hosts follow in stored order. Each hostname is listed once. The pair partner, when the mapping adds one, is the second hostname, and a later copy of that hostname is omitted.
- When Redirect apex is on, the stored parent is set, and the custom domain is `www` of that parent, the list is `www.example.com, example.com` and Direction is Redirect to www. An empty stored parent stays off the list. That row is then the lone-hostname case.
- When the custom domain is the apex and `www` of that apex is already an alias, the list is the apex, then that `www` host, and Direction is Redirect to non-www. This holds when Redirect apex is off.
- Bru Grappling is that apex-first result while its stored custom domain is still `www.brugrappling.ie`. The list is `brugrappling.ie, www.brugrappling.ie`. Direction is Redirect to non-www. Any other stored alias follows those two, once.
- When the row names no custom domain, the list is empty and Direction is Allow www and non-www. Alias hosts on that row stay off the list.
- When the row names one hostname and no pair partner, the list is that hostname and Direction is Allow www and non-www. That is a lone `www` host, a lone apex with no `www` alias, Redirect apex on with an empty stored parent, or a custom domain that is neither `www` nor the apex. The stored parent of `classes.example.com` stays off the list.
- Any other alias host stays on the list after the custom domain and its pair partner. It serves, or follows Direction inside its own pair, and names the canonical host as the indexed URL.
- Every row stores a Direction. The refactor removes `domain`, `aliasHosts`, `redirectApex`, and `apexDomain`. Redirect apex does not remain beside Direction.
- Bru Grappling's apex has to CNAME to the SaaS target, and the Cloudflare rule that sends that apex to the `www` homepage has to be removed, before `www` redirects to the apex. That gate is operational. It is not a second declaration, and it is not part of the public-host request checks. Other rows are not held for that gate.

### Acceptance

- Bru Grappling, after the cutover gate: `https://brugrappling.ie/kids` returns 200, and its canonical link, Open Graph URL, and sitemap URL are `https://brugrappling.ie/kids`. `https://www.brugrappling.ie/kids?ref=1` and `https://brugrappling.atnd.me/kids?ref=1` return 301 to `https://brugrappling.ie/kids?ref=1`.
- The allow-www-and-non-www fixture is the hostname list `www.example.com, example.com` with Direction Allow www and non-www. `https://www.example.com/kids?ref=1` returns 200 and names `https://example.com/kids`. `https://www.example.com/sitemap.xml` returns 301 to `https://example.com/sitemap.xml`.
- Redirect to www has no third acceptance fixture. The same public-host checks cover it when that Direction is arranged.

## Testing Decisions

- A good test asserts behavior a visitor, a crawler, an admin, or a tenant write can observe. It does not assert which function derived the role.
- Public-host checks are one seam: a request against the running app, the same shape as the existing alias-host redirect end-to-end test and the sitemap and robots end-to-end test. The test arranges a declaration, then requests the canonical host, another serving host, an alias host, the platform subdomain, and an unknown host. The request observes the 301 itself. Status, `Location`, the canonical link, the Open Graph URL, `robots.txt`, and `sitemap.xml` are the assertions. The redirect target is `https://<host><path><query>` with no port. The indexed URL omits the query and the port.
- A failed lookup is that same request with resolution forced to throw. The response is 503 for the page, `robots.txt`, and the sitemap paths, and the body is not a homepage sitemap.
- Hostname refusals, a claimed apex, and a Direction the list cannot support are assertions on the tenant write the declaration tests already use. A refused save leaves the stored list and the stored Direction unchanged. They are not a second suite.
- Admin checks open the tenant, as an org admin and as a platform super-admin, and read the rendered public-host list: typed order, then the platform subdomain, and the role text. They also read that a Direction the list cannot support stays selected while the save is refused. The routing record, the status table, TXT rows, and Apex Proxying rows stay covered as the admin DNS spec already words them. This spec does not add a second status-table suite.
- The email sending domain is asserted where sending-domain resolution already runs. The assertion is the apex of the canonical host, or the platform apex when the list is empty. The panel's shape is not asserted.
- Apple Pay is asserted as the set of bare hostnames registered when the declaration is saved, with the payment provider mocked, in the same way the existing registration test already mocks that provider. An alias host is absent. The association file is not requested.
- Migration is the existing one-shot migration integration test, extended to fixture rows. Given the legacy fields, assert the hostname list order and Direction, including the Bru Grappling row. The cutover gate stays an operational checklist. Post-cutover smoke uses the Bru acceptance requests.
- Host-resolution unit tests sit below the public-request seam. A test that only calls the derivation function does not replace a request, a tenant write, the rendered list, the migration fixture, the sending-domain resolution, or the registration set.

## Out of Scope

- Location subdomains and organisation sub-subdomains.
- Repairing old URL paths.
- Repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL.
- A per-host search-engine indexing toggle. One indexed host is the rule.
- Adding hostnames one at a time. The declaration is one list.
- The email DNS panel's shape. The panel stays where it is, and the email sending domain is specified above.
- Admin login hosts.
- The platform apex redirecting to the platform `www` host.
- A trailing-slash policy. The path in an indexed URL is the request path.
- Restating the routing record, the DNS and certificate status table, conditional TXT rows, or Apex Proxying rows. Those stay in the admin DNS spec.
- Provisioning or deleting Cloudflare custom hostnames beyond what existing hooks already do when a host is saved.

## Further Notes

- Glossary: `CONTEXT.md`. Hostname list, Direction, declaration, canonical host, serving host, alias host, indexed URL, platform subdomain, claimed apex, email sending domain, and Apple Pay domain are defined there.
- The decisions behind this spec are the resolved tickets under `.scratch/domain-direction/`. The map is `map.md`.
- Today a stored custom domain, an alias list, and Redirect apex are the declaration. Alias hosts redirect to that custom domain, including a hostname on another apex. This spec replaces that. A hostname outside a www/apex pair serves, and an alias host redirects to its pair partner.
- Bru Grappling is one acceptance fixture. The allow-www-and-non-www list is the other. Redirect to www is covered by the public-host checks and is not a third acceptance fixture.
