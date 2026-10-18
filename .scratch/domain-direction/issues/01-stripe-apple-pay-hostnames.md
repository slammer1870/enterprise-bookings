# What hostnames does Stripe require for Apple Pay on a site served from more than one hostname?

Labels: wayfinder:research
Type: research
Status: resolved
Blocked by: none

## Question

A tenant may serve checkout on more than one hostname. `www.example.com` and `example.com` may both serve, and a further hostname such as `mysite.example.com` may serve beside them.

What does Stripe require, in the payment method domains API, for Apple Pay to be offered on each of those hostnames? Is the registered name the exact hostname the browser is on, the registrable apex, or both? Does a registration on one hostname cover another hostname that serves the same site?

## Findings

[research/stripe-apple-pay-hostnames.md](../research/stripe-apple-pay-hostnames.md)

## Answer

For Elements or embedded Checkout, Stripe requires one payment method domain for each hostname that shows Apple Pay. `example.com`, `www.example.com`, and `mysite.example.com` are three registrations. One does not cover another. `domain_name` is the bare hostname.

Stripe's payment method domains guide says Stripe handles merchant validation, and it does not tell you to host an association file. The Salesforce B2C guide and Apple's platform guide still place that file on each registered hostname at `/.well-known/apple-developer-merchantid-domain-association`. Hosted Checkout and Payment Links need no domain registration.
