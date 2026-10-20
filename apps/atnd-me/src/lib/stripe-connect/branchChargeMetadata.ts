export type BranchLocation = {
  name: string
  slug: string
}

function isKnownBranch(
  location: BranchLocation | null | undefined,
): location is BranchLocation {
  return location != null && location.name !== '' && location.slug !== ''
}

/**
 * Stripe metadata when every location is the same known branch.
 * An unknown location, a missing name or slug, or more than one slug leaves the charge unlabeled.
 */
/** Drop client-supplied branch keys so only a server-resolved location can label the charge. */
export function omitClientBranchMetadata(
  metadata: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!metadata) return {}
  const { branchName: _branchName, branchSlug: _branchSlug, ...rest } = metadata
  return rest
}

export function branchChargeMetadata(
  locations: Array<BranchLocation | null | undefined>,
): { branchName: string; branchSlug: string } | Record<string, never> {
  const first = locations[0]
  if (!isKnownBranch(first) || !locations.every(isKnownBranch)) return {}
  if (!locations.every((location) => location.slug === first.slug)) return {}
  return { branchName: first.name, branchSlug: first.slug }
}
