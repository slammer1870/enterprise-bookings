# What is the email sending domain?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: none

## Question

The glossary says the email sending domain is the custom canonical host with a leading `www` removed, and the platform's own domain when no custom canonical host is named. It is not a public host, and it is not the apex.

The canonical host is now chosen from the hostname list and Direction, and other hostnames may serve beside it. `www.example.com` can be canonical. `shop.example.com` can be canonical. Several registrable domains can appear in one list.

What is the email sending domain in those cases? Does the glossary sentence still hold, or does mail follow a different hostname from the declaration?

## Comments

The glossary sentence does not hold. The email sending domain is the apex of the canonical host, the registrable domain that hostname claims. `www.example.com`, `example.com`, and `mysite.example.com` all send as `example.com`. `blog.shop.example.co.uk` sends as `example.co.uk`. That apex need not be in the hostname list. Direction does not change it.

A list that also names another apex has one email sending domain. For `www.example.com, example.com, www.other.com, other.com`, the canonical host is `example.com`, and the email sending domain is `example.com`. `other.com` is not one.

With no custom hostname named, the canonical host is the platform subdomain, so the email sending domain is the platform apex.

## Answer

The email sending domain is the apex of the canonical host. Hostnames on that apex share it, whether or not the apex is in the hostname list. Another apex in the list is not an email sending domain. With no custom hostname named, the email sending domain is the platform apex.
