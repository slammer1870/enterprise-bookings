/** Drizzle `execute` returns either a row array or `{ rows }`. */
export function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) {
    return result.rows as Array<Record<string, unknown>>
  }
  return []
}
