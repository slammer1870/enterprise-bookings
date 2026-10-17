# What does admin show for the hostname list and Direction?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: none

## Question

The tenant types hostnames in one field, separated by commas. Direction sits under the config for those hostnames. Today the form has a single custom domain, an alias list, and Redirect apex, plus a public-host list that shows a routing record, a DNS status, and a certificate status for each custom domain.

What does the form show for each typed hostname, including one that will redirect? Where does Direction sit, what are its three choices called, and when is redirect to www or redirect to non-www unavailable? Say whether a hostname takes its role on save, without waiting on DNS or a certificate.

## Comments

The custom domain field, the alias list, and Redirect apex leave the form. The tenant names hostnames in one comma-separated field. Direction is one control directly under that field and above the public-host list. The choices are Allow www and non-www, Redirect to www, and Redirect to non-www. The default is Allow www and non-www.

Redirect to www stays in the control and can be selected only when `www` of the first hostname's registrable domain is in the list. Redirect to non-www stays in the control and can be selected only when that apex is in the list. With no custom hostname, both are unavailable. A later pair does not change that. `www.other.com` without `other.com` is a serving host, and the missing hostname is left untyped. If the selected Direction needs a hostname the list no longer has, the choice stays selected, saving is refused, and the stored Direction is unchanged.

The public-host list shows the saved hostnames in typed order, then the platform subdomain. A platform super-admin and an org admin see the same list. Each typed hostname, including one that redirects, shows its role, a routing record, a DNS status, and a certificate status. The Role column reads canonical, serving, or alias to the host it redirects to. The platform subdomain is role only: canonical when no custom hostname is named, and alias to the canonical host once one is. The conditional TXT rows and Apex Proxying rows stay as they are. The email-domain panel stays where it is.

Saving the hostname list and Direction gives each hostname its derived role immediately. DNS status and certificate status are read when the tenant is opened and may still be Pending or Unknown. The glossary term Serving host is unchanged: the canonical host is still a serving host, and the form marks that row canonical.

For `www.example.com, example.com`:

- Allow www and non-www — `www.example.com` is serving, `example.com` is canonical.
- Redirect to www — `www.example.com` is canonical, `example.com` is alias to `www.example.com`.
- Redirect to non-www — `www.example.com` is alias to `example.com`, `example.com` is canonical.

`example.com` alone makes Redirect to www unavailable. `www.example.com` alone makes Redirect to non-www unavailable. `blog.example.co.uk` alone makes both unavailable, because that needs `www.example.co.uk` or `example.co.uk` in the list, and `blog.example.co.uk` is canonical. `mysite.example.com` alone is canonical, and both redirect choices are unavailable.

## Answer

The custom domain field, the alias list, and Redirect apex leave the form. Hostnames are one comma-separated field. Direction is one control under that field and above the public-host list. Its choices are Allow www and non-www, Redirect to www, and Redirect to non-www. The default is Allow www and non-www.

Redirect to www can be selected only when `www` of the first hostname's registrable domain is in the list. Redirect to non-www can be selected only when that apex is in the list. Both choices stay visible. With no custom hostname, both are unavailable. A later pair does not change availability. `www.other.com` without `other.com` is a serving host, and the missing hostname is left untyped. If the selected Direction needs a hostname the list no longer has, the choice stays selected, saving is refused, and the stored Direction is unchanged.

The public-host list shows the saved hostnames in typed order, then the platform subdomain. A platform super-admin and an org admin see the same list. Each typed hostname, including one that redirects, shows its role, a routing record, a DNS status, and a certificate status. The Role column reads canonical, serving, or alias to the host it redirects to. The platform subdomain is role only: canonical when no custom hostname is named, and alias to the canonical host once one is. The conditional TXT rows and Apex Proxying rows stay as they are. The email-domain panel stays where it is. The glossary term Serving host is unchanged. The canonical host is still a serving host, and the form marks that row canonical.

Saving the hostname list and Direction gives each hostname its derived role immediately. DNS status and certificate status are read when the tenant is opened and may still be Pending or Unknown.

For `www.example.com, example.com`, Allow www and non-www marks `www.example.com` serving and `example.com` canonical. Redirect to www marks `www.example.com` canonical and `example.com` alias to `www.example.com`. Redirect to non-www marks `www.example.com` alias to `example.com` and `example.com` canonical. `example.com` alone makes Redirect to www unavailable. `www.example.com` alone makes Redirect to non-www unavailable. `blog.example.co.uk` alone makes both unavailable, because that needs `www.example.co.uk` or `example.co.uk` in the list, and `blog.example.co.uk` is canonical. `mysite.example.com` alone is canonical, and both redirect choices are unavailable.
