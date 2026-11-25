/**
 * URL path segment for pages / posts / similar documents.
 * Lowercase letters, digits, and single hyphens only (no spaces, slashes, or punctuation).
 */
export const DOCUMENT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type DocumentSlugResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

/**
 * Normalize a raw title/slug into a URL-safe path segment.
 * Mirrors location slug formatting used elsewhere in atnd-me.
 */
export function formatDocumentSlug(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Format then validate a document slug for save.
 * Invalid characters are stripped; empty / unusable results are rejected.
 */
export function normalizeAndValidateDocumentSlug(raw: unknown): DocumentSlugResult {
  const slug = formatDocumentSlug(raw)

  if (!slug) {
    return {
      ok: false,
      error:
        'Slug must be a valid URL path: use lowercase letters, numbers, and hyphens (e.g. "about-us").',
    }
  }

  if (!DOCUMENT_SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        'Slug must be a valid URL path: use lowercase letters, numbers, and hyphens (e.g. "about-us").',
    }
  }

  return { ok: true, slug }
}
