# How do we repair the Open Graph absolute URL bug?

Type: grilling
Status: resolved

## Question

[spec.md](spec.md) excludes repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL. [What do Bru Grappling's live hosts return?](01-bru-live-hosts.md) recorded the defect on Bru's pages.

Should this map produce a small handoff spec for the fix, or defer it outside tenant public hosts entirely?

## Answer

Deferred outside tenant public hosts. Not a companion spec of this map. Specified on its own: [Share image](../../share-image/spec.md).

The broken value is the share image, not the Open Graph page URL. That page URL is already the indexed URL. When the media URL is already absolute, the share image is that URL. The repair is a media-URL join, not a decision about which host serves, so it does not sit with the admin DNS or migration specs.
