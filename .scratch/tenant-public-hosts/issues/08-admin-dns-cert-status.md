# How does admin show DNS and certificate status for each declared host?

Type: grilling
Status: resolved
Blocked by: 07

## Question

A tenant names a canonical host and alias hosts. Naming a host makes it that role immediately. DNS and certificate status are not part of the declaration, and they do not change which host serves.

What does admin show for each declared hostname's DNS and certificate status? The platform subdomain is assigned, not named. Say whether its status is shown differently from a custom domain.

## Comments

### Round 1

Each custom domain, the canonical host and every alias, shows its own DNS status and its own certificate status. The two stay separate. The platform subdomain is listed as the assigned host and shows neither status.

### Round 2

DNS status is Cloudflare's status for that custom hostname. Certificate status is Cloudflare's SSL status for the same hostname. Admin does not derive DNS status from a live A-record lookup.

Each custom domain shows its default routing record together with those two statuses. A labeled hostname shows a CNAME to the SaaS target. An apex shows that CNAME, or the Apex Proxying A/AAAA records when the account has the add-on. The ownership TXT and `_acme-challenge` TXT stay off that default view.

### Round 3

Both columns use Active, Pending, Error, and Unknown. DNS Active is hostname `active` or `active_redeploying`. Certificate Active is `active` only; `staging_active` and `backup_issued` stay Pending. Hostname `blocked`, `moved`, and `deleted` are Error, and Cloudflare's verification errors show under the DNS status. Unknown means no custom hostname, the API could not be read, or an unmapped status. The routing record still shows.

The ownership TXT appears while DNS status is not Active and Cloudflare has issued it. Each `_acme-challenge` TXT appears while certificate status is not Active and Cloudflare has issued it. A zone already on Cloudflare shows neither. Delegated DCV stays off the panel.

The canonical host is listed first, then aliases in the order named, then the platform subdomain. Each custom domain is marked with its role and shows its routing record and two statuses. The platform subdomain is marked assigned and shows neither a record nor a status.

### Round 4

An apex always shows the CNAME to the SaaS target as its default routing record, with the two statuses on that record. When the account has Apex Proxying, the same apex also shows A and AAAA records to the account's allocated addresses. The host is `@` for an apex, and the labels in front of the claimed apex for any other hostname. The panel does not prescribe a TTL.

A platform super-admin and an org admin see the same list. It shows the role, the routing record, and the two statuses, with no instruction to ask a client.

### Round 5

The platform subdomain's mark is its role. With no custom domain named, it is the only row and is marked canonical. Once a custom canonical host exists, it is marked alias and listed last. It has no routing record, no DNS status, and no certificate status in either case.

## Proposed understanding

Confirmed.

Admin shows one list of the tenant's public hosts, the same list for a platform super-admin and an org admin. The canonical host is first. Alias hosts follow in the order named. Statuses are read when the tenant is opened. They are not saved, and they do not change which host serves. A hostname dropped from the declaration leaves the list. This list replaces the current domain panel and apex panel. The email-domain panel stays separate.

A custom domain, canonical or alias, shows its role, its routing record, and one DNS status and one certificate status on that record. The record is a CNAME to the SaaS target. The host is `@` when the hostname is an apex, and the labels in front of the claimed apex otherwise. The panel does not prescribe a TTL. An apex with Apex Proxying also shows A and AAAA rows to the account's allocated addresses, host `@`, with no second pair of statuses. Those rows are absent when the allocated addresses are not known. Admin never fills them with the SaaS target's anycast addresses.

DNS status is Cloudflare's hostname status. Certificate status is Cloudflare's SSL status.

- Active: hostname `active` or `active_redeploying`; certificate `active`.
- Pending: hostname `pending`; a certificate still in issuance, including `staging_active` and `backup_issued`.
- Error: hostname `blocked`, `moved`, or `deleted`. Cloudflare's verification errors show under the DNS status when present. A certificate status outside Active and Pending is Unknown.
- Unknown: no custom hostname, the API could not be read, or a status the panel does not map. The routing record still shows.

While DNS status is not Active and Cloudflare has issued an ownership value, the list adds that TXT. While certificate status is not Active and Cloudflare has issued `_acme-challenge` values, the list adds those TXT rows. The TXT name and value are the ones Cloudflare issued. A zone already on Cloudflare shows neither. Delegated DCV stays off the panel. Once a status is Active, its TXT rows go away and the routing record stays.

The platform subdomain has no routing record and neither status. It is marked canonical when it is the only host, and alias when a custom canonical host exists.

## Answer

Admin shows one list of the tenant's public hosts. A platform super-admin and an org admin see the same list. The canonical host is first, then alias hosts in the order named. Statuses are read when the tenant is opened. They are not saved, and they do not change which host serves. A dropped hostname leaves the list. This list replaces the domain panel and the apex panel. The email-domain panel stays separate.

Each custom domain shows its role, a CNAME to the SaaS target, and one DNS status and one certificate status on that record. The host is `@` for an apex and the labels in front of the claimed apex otherwise. The panel does not prescribe a TTL. An apex on an account with Apex Proxying also shows A and AAAA rows to the allocated addresses, host `@`, with no second pair of statuses. Those rows are absent when the addresses are not known. The SaaS target's anycast addresses are never used.

DNS status is Cloudflare's hostname status. Certificate status is Cloudflare's SSL status. Active is hostname `active` or `active_redeploying`, and certificate `active`. Pending is hostname `pending`, and a certificate still in issuance, including `staging_active` and `backup_issued`. Error is hostname `blocked`, `moved`, or `deleted`, with Cloudflare's verification errors under the DNS status when present. Any other certificate status is Unknown. Unknown is also no custom hostname, an API that could not be read, or a status the panel does not map. The routing record still shows.

While a status is not Active and Cloudflare has issued the value, the list adds that TXT: ownership for DNS, and each `_acme-challenge` row for the certificate, using the name and value Cloudflare issued. A zone already on Cloudflare shows neither. Delegated DCV stays off the panel. Once a status is Active, its TXT rows go away and the routing record stays.

The platform subdomain has no routing record and neither status. It is marked canonical when it is the only host, and alias when a custom canonical host exists.
