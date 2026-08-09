export type TemplateContext = Record<string, unknown>

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function resolvePath(context: TemplateContext, path: string): unknown {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)

  let current: unknown = context
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }

    const record = current as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(record, part)) {
      current = record[part]
      continue
    }

    const matchedKey = Object.keys(record).find((key) => key.toLowerCase() === part.toLowerCase())
    if (!matchedKey) {
      return undefined
    }
    current = record[matchedKey]
  }

  return current
}

function valueToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/**
 * Replace `{{path.to.value}}` placeholders using a nested context object.
 * Path segments are matched case-insensitively against object keys.
 */
export function replaceTemplateVars(
  input: string,
  context: TemplateContext | null | undefined,
  options?: { escapeHtml?: boolean },
): string {
  if (!input || !context) return input

  const shouldEscape = options?.escapeHtml === true

  return input.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, rawPath: string) => {
    const resolved = valueToString(resolvePath(context, rawPath))
    return shouldEscape ? escapeHtml(resolved) : resolved
  })
}
