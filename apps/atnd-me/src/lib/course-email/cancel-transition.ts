export function isCancelledEnrollmentTransition({
  doc,
  previousDoc,
  operation,
}: {
  doc: { status?: string }
  previousDoc?: { status?: string } | null
  operation: 'create' | 'update'
}): boolean {
  if (operation !== 'update') return false
  if (doc.status !== 'cancelled') return false
  return previousDoc?.status !== 'cancelled'
}
