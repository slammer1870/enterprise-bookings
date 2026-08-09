import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  replaceTemplateVars,
  type TemplateContext,
} from './replace-template-vars'

export function renderPostBookingEmailBodyHtml(
  body: unknown,
  templateContext?: TemplateContext | null,
): string {
  if (!body || typeof body !== 'object') {
    return ''
  }

  const html = convertLexicalToHTML({
    data: body as SerializedEditorState,
  })

  return replaceTemplateVars(html, templateContext, { escapeHtml: true })
}
