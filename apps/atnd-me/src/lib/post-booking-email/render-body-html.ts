import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export function renderPostBookingEmailBodyHtml(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return ''
  }

  return convertLexicalToHTML({
    data: body as SerializedEditorState,
  })
}
