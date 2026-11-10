# Stripe payment method domains and Apple Pay hostnames

Retrieved 16 October 2026 from Stripe’s docs and API reference, the Stripe OpenAPI spec (`2026-09-30.endive`), and Apple’s Apple Pay guides. Stripe’s own pages are the source for what the payment method domains API requires. Apple’s pages are included only where they state the association-file rule that Stripe’s registration guide tells you not to follow.

## Question

A tenant may serve checkout on more than one hostname. `www.example.com` and `example.com` may both serve, and a further hostname such as `mysite.example.com` may serve beside them.

What does Stripe require, in the payment method domains API, for Apple Pay to be offered on each of those hostnames? Is the registered name the exact hostname the browser is on, the registrable apex, or both? Does a registration on one hostname cover another hostname that serves the same site?

Also:

- The `domain_name` value shape (bare hostname vs URL, `www` vs apex)
- Whether each hostname needs its own payment method domain and its own Apple Pay domain association file
- Where that association file must be hosted (which host, which path)
- Anything Stripe says about subdomains versus the apex

## Findings

### Each hostname that shows the button is its own payment method domain

For Elements or embedded Checkout, Stripe requires a payment method domain for every web domain that shows Apple Pay. Stripe’s examples of those domains are the apex and each subdomain, including `www`, as separate names.

From [Apple Pay](https://docs.stripe.com/apple-pay?platform=web) (web variant):

> If you use Payment Links or hosted Checkout, Apple Pay works with no additional configuration. If you use Elements or embedded Checkout", you need to register your domain.

> To use Apple Pay with Elements or embedded Checkout, you must register all of your web domains that show an Apple Pay button. That includes top-level domains (for example, stripe.com) and subdomains (for example, www.stripe.com and shop.stripe.com), in production and testing.

> Register your domains on the Payment methods domains page in the Dashboard or by using the API with your live secret key as shown below. Don’t register your domain more than once per account.

The same rule is the opening of [Register domains for payment methods](https://docs.stripe.com/payments/payment-methods/pmd-registration?dashboard-or-api=api) (API variant). Apple Pay is marked required on that page:

> For certain payment methods, you must register every web domain that shows the payment method if your integration uses Elements or Checkout’s embeddable payment page. This includes registering top-level domains and subdomains. For example, if you have the domain example.com and subdomains like shop.example.com and www.example.com, this guide explains how to register them.

> Repeat for all domains that you need to register.

Stripe uses “top-level domain” for the bare name in those examples (`stripe.com`, `example.com`). It uses “subdomain” for `www.stripe.com`, `www.example.com`, and `shop.example.com` / `shop.stripe.com`. It does not say that registering the bare name also covers `www` or any other hostname.

Applied to a site that serves checkout on `example.com`, `www.example.com`, and `mysite.example.com`, those sentences require three payment method domains, one per hostname. A registration on one of them does not cover the others. “Don’t register your domain more than once per account” is a warning against a duplicate of the same name, not a statement that one name stands in for the rest of the site.

The registered name is the web domain that shows the button: the exact hostname, written as Stripe’s examples write it (`example.com`, `www.example.com`, `shop.example.com`). It is not the registrable apex standing in for every host on that site. Stripe does not say to register the apex in addition to a subdomain when only the subdomain shows the button. The requirement is “every web domain that shows the payment method.”

Payment Links and hosted Checkout are outside that requirement. The sentences above apply when the payment form is Elements or Checkout’s embeddable page on the tenant’s hostname.

### `domain_name` is a bare hostname in every published example

Create is `POST /v1/payment_method_domains` with a required `domain_name`. From [Create a payment method domain](https://docs.stripe.com/api/payment_method_domains/create):

> `domain_name` (string, required) The domain name that this payment method domain object represents.

The request and the response both use a bare hostname, with no scheme, path, or port:

```curl
curl https://api.stripe.com/v1/payment_method_domains \
  -u "<<YOUR_SECRET_KEY>>" \
  -d "domain_name=example.com"
```

The returned object echoes `"domain_name": "example.com"`. The same bare value is the example on the registration page and on [The PaymentMethodDomain object](https://docs.stripe.com/api/payment_method_domains/object).

`www` and the apex are different `domain_name` values. The registration guide names `example.com`, `www.example.com`, and `shop.example.com` as the domains you register. It does not show a URL (`https://example.com`) as `domain_name`.

The Stripe OpenAPI spec, version `2026-09-30.endive` ([`openapi/spec3.yaml` on stripe/openapi](https://github.com/stripe/openapi/blob/master/openapi/spec3.yaml)), types `domain_name` as a string with `maxLength: 5000` and the same description. It publishes no pattern, format, or enum that distinguishes a hostname from a URL. What the docs demonstrate is the bare hostname.

### Apple Pay is offered on that domain when the payment method domain is enabled and Apple Pay is active

From [The PaymentMethodDomain object](https://docs.stripe.com/api/payment_method_domains/object):

> `apple_pay` (object) The status of Apple Pay’s eligibility on the domain.

> `active` — The payment method is eligible for use on this domain.

> `inactive` — The payment method isn’t eligible for use on this domain.

> `enabled` (boolean) Whether this payment method domain is enabled. If the domain is not enabled, payment methods that require a payment method domain will not appear in Elements.

Disabling a domain removes the methods on that domain only. From the [API registration guide](https://docs.stripe.com/payments/payment-methods/pmd-registration?dashboard-or-api=api):

> Enable or disable a domain. If a domain is disabled, the payment methods no longer appear in Elements or Checkout’s embeddable payment form on that domain.

### The payment method domains steps do not include an association file

The registration step Stripe publishes for this API is the create call, repeated per domain. Stripe says it performs Apple’s merchant validation, and it tells you not to follow Apple’s own merchant-validation process.

From [Apple Pay](https://docs.stripe.com/apple-pay?platform=web):

> Stripe handles Apple merchant validation for you, including creating an Apple Merchant ID and Certificate Signing Request. Don’t follow the merchant validation process in the Apple Pay documentation.

From [Register domains for payment methods](https://docs.stripe.com/payments/payment-methods/pmd-registration?dashboard-or-api=api):

> The Apple Pay documentation describes their process of “merchant validation,” which Stripe handles for you behind the scenes. You don’t need to create an Apple Merchant ID or CSR. Instead, follow the steps in this guide.

Those steps are: create a payment method domain with `domain_name`, then repeat for every domain. Neither that guide nor the Apple Pay web page names `apple-developer-merchantid-domain-association` or tells you to host a file.

[Validate an existing payment method domain](https://docs.stripe.com/api/payment_method_domains/validate) leaves room for extra steps without naming a file:

> Some payment methods might require additional steps to register a domain. If the requirements weren’t satisfied when the domain was created, the payment method will be inactive on the domain. The payment method doesn’t appear in Elements or Embedded Checkout for this domain until it is active.

> To activate a payment method on an existing payment method domain, complete the required registration steps specific to the payment method, and then validate the payment method domain with this endpoint.

A search of docs.stripe.com for `apple-developer-merchantid-domain-association` hits one page, the Salesforce B2C Commerce implementation guide below. It does not hit the payment method domains guide or the Apple Pay web page.

Stripe’s support article [Enable Apple Pay on your Stripe account](https://support.stripe.com/questions/enable-apple-pay-on-your-stripe-account) opens with a sentence that mentions a file, then gives website steps that do not:

> To enable Apple Pay on your Stripe account, navigate to Apple Pay under Business Settings > Payment Methods in your Dashboard. The setup process will vary depending on whether you're implementing Apple Pay on an iOS app, a website, or both. Click on Configure under Apple Pay to initiate the setup process. For iOS apps, follow the steps to create and upload a certificate; for websites, add a new domain and upload a verification file.

The website procedure on that same page is:

> 1. From the Payment method domains page page, click Add new domain.
> 2. Enter the primary domain or subdomain where you will be implementing Apple Pay (e.g. yourdomain.com or shop.yourdomain.com).
> 3. Click Save.
> 4. Continue with integrating Apple Pay for the Web.

So the current payment method domains API flow, as written on the registration and Apple Pay pages, is one payment method domain per hostname and no association file for the integrator to host. The support article’s opening sentence still says “upload a verification file” for websites; the steps under it do not.

### Where Stripe does state the association-file host and path

[Stripe app for Salesforce B2C Commerce implementation guide](https://docs.stripe.com/use-stripe-apps/salesforce-commerce-cloud/implementation-guide), under “Set up Apple Pay”, is the Stripe page that states a host and a path. It is instructions for that cartridge, not the payment method domains API guide:

> 1. On the Payment method domains page, click Add a new domain.
> 2. Enter your domain name.
> 3. Click Save and continue.
> 4. Download the domain association file.
> 5. Host the file at `/.well-known/apple-developer-merchantid-domain-association`. For example, if you register `https://example.com`, make that file available at `https://example.com/.well-known/apple-developer-merchantid-domain-association`.
> 6. Click Verify.

On that page the file is hosted on the hostname you registered, at `/.well-known/apple-developer-merchantid-domain-association`. The example is one file URL per registered domain (`https://example.com/...`), which matches “repeat for all domains” rather than one file on the apex covering every hostname.

### Apple’s rule, which Stripe’s registration guide says not to follow

Apple still describes per-hostname verification and the association file for a merchant or platform that registers domains with Apple directly. Stripe’s Apple Pay page says not to follow that process.

[Apple Pay Merchant Integration Guide](https://developer.apple.com/apple-pay/Apple-Pay-Merchant-Integration-Guide.pdf) (24 March 2026), “Verify your domain(s)”:

> You must register and verify all top-level domains and subdomains where you display the Apple Pay button.

> Enter the fully qualified domain name, then click Save.

> Click Download, place the downloaded file in the specified location, then click Verify.

The same guide notes that a payment service provider may do this instead:

> if you are being onboarded by your Payment Service Provider or E Commerce platform, they may handle this on your behalf, and you should contact them to confirm wether you need to create your own credentials.

[Apple Pay Platform Integration Guide](https://developer.apple.com/download/files/Apple-Pay-Platform-Integration-Guide.pdf), “Prepare merchant domains”, states the path for each domain:

> Host your domain verification file at the following path for each domain being registered: https://[DOMAIN_NAME]/.well-known/apple-developer-merchantid-domain-association

`[DOMAIN_NAME]` there is each domain being registered, not one apex for the whole site. [Configure Apple Pay on the web](https://developer.apple.com/help/account/capabilities/configure-apple-pay-on-the-web/) says to enter “the fully qualified domain name” and to “place the downloaded file in the specified location.” It does not print the path; the platform guide does.

### Iframe origins are also full hostnames

If the payment form is inside an iframe, Stripe still talks about full hostnames, and a different parent host is a second registration. From [Apple Pay](https://docs.stripe.com/apple-pay?platform=web):

> When using an iframe with Elements, the iframe’s origin must match the top-level origin (except for Safari 17+ when specifying `allow="payment"` attribute). Two pages have the same origin if the protocol, host (full domain name), and port (if specified) are the same for both pages.

> If the top-level domain differs from the iframe domain, the top-level domain and the iframe’s source domain must both be registered payment method domains on the associated account.

From the [API registration guide](https://docs.stripe.com/payments/payment-methods/pmd-registration?dashboard-or-api=api):

> When using a cross-origin iframe in Safari 17+ you must specify the `allow="payment"` attribute. To enable Apple Pay, you must also register the source domain that the iframe loads.

## What this does not decide

This file reports Stripe’s requirement only. It does not choose which of our public hosts we register.
