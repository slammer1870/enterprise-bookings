/**
 * Resolve href from a link field (reference or custom URL).
 * Used by marketing blocks that use linkGroup.
 */
export function getLinkHref(link: {
  type?: 'reference' | 'custom'
  url?: string
  reference?: {
    value: string | number | { slug?: string }
    relationTo: string
  }
} | undefined): string {
  if (!link) return '#'
  if (link.type === 'reference' && link.reference) {
    const ref = link.reference.value
    const slug = typeof ref === 'object' && ref?.slug != null ? ref.slug : String(ref)
    const relationTo = link.reference.relationTo
    return relationTo !== 'pages' ? `/${relationTo}/${slug}` : `/${slug}`
  }
  return link.url || '#'
}
