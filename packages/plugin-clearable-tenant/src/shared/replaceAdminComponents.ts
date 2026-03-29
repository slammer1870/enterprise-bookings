type Entry = string | { path: string; clientProps?: unknown; serverProps?: unknown }

/**
 * Replaces the first entry in `entries` whose path equals `fromPath` with a new entry
 * with `toPath`, preserving clientProps or serverProps when `preserveProps` is 'client' or 'server'.
 */
export function replaceInEntries(
  entries: unknown,
  fromPath: string,
  toPath: string,
  preserveProps: 'client' | 'server' | 'none' = 'none',
): unknown {
  if (!Array.isArray(entries)) return entries
  const index = entries.findIndex((entry: unknown) => {
    if (typeof entry === 'string') return entry === fromPath
    const obj = entry as { path?: string }
    return typeof entry === 'object' && entry != null && obj.path === fromPath
  })
  if (index === -1) return entries
  const entry = entries[index] as Entry
  const clientProps =
    preserveProps === 'client' && typeof entry === 'object' && entry && 'clientProps' in entry
      ? (entry as { clientProps?: unknown }).clientProps
      : undefined
  const serverProps =
    preserveProps === 'server' && typeof entry === 'object' && entry && 'serverProps' in entry
      ? (entry as { serverProps?: unknown }).serverProps
      : undefined
  const newEntry =
    clientProps != null
      ? { path: toPath, clientProps }
      : serverProps != null
        ? { path: toPath, serverProps }
        : toPath
  return entries.map((e: unknown, i: number) => (i === index ? newEntry : e))
}

