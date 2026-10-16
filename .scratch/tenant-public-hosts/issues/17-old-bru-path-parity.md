# Do we preserve old Bru Grappling URL paths?

Type: grilling
Status: resolved

## Question

[spec.md](spec.md) excludes redirects that preserve old URL paths from the previous Bru Grappling app; the path in the public hosts spec is the path the visitor requested.

Is path parity from the old app in scope for any companion spec in this map, a separate effort, or permanently out of scope?

## Answer

Permanently out of scope for this map. It is not a companion spec, and it is not a slice of [Tenant public hosts — migration](../spec-migration.md).

The public-page spec already keeps the path the visitor requested. Migration does not add rewrites from the previous Bru Grappling app, and equity that already consolidated on the `www` homepage stays on the homepage. No list of old paths that still receive traffic and do not match current paths is in scope here.
