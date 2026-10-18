import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectionField } from '@/components/admin/DirectionField'
import { HostnameListField } from '@/components/admin/HostnameListField'

const formState = vi.hoisted(() => ({
  direction: 'allow-www-and-non-www' as string | null,
  hostnames: [] as unknown,
}))

vi.mock('@payloadcms/ui', () => ({
  FieldLabel: ({ label }: { label?: string }) => React.createElement('span', null, label),
  FieldDescription: ({ description }: { description?: string }) => React.createElement('p', null, description),
  useField: ({ path }: { path: string }) => ({
    value: path === 'hostnames' ? formState.hostnames : formState.direction,
    setValue: (next: unknown) => {
      if (path === 'hostnames') formState.hostnames = next
      else formState.direction = typeof next === 'string' ? next : null
    },
  }),
  useFormFields: (selector: (state: [{ [key: string]: { value: unknown } }]) => unknown) =>
    selector([{ hostnames: { value: formState.hostnames } }]),
}))

function radioTag(html: string, value: string): string {
  const tag = html.match(new RegExp(`<input\\b[^>]*value="${value}"[^>]*>`))?.[0]
  if (!tag) throw new Error(`Missing radio ${value} in ${html}`)
  return tag
}

function renderDirection(): string {
  return renderToStaticMarkup(
    React.createElement(DirectionField, {
      path: 'direction',
      field: {
        label: 'Direction',
        admin: { description: 'One rule for every www/apex pair.' },
      },
    }),
  )
}

describe('hostname direction form', () => {
  beforeEach(() => {
    formState.direction = 'allow-www-and-non-www'
    formState.hostnames = []
  })

  it('shows the stored hostname list as one comma-separated field', () => {
    formState.hostnames = ['www.example.com', 'example.com']
    const html = renderToStaticMarkup(
      React.createElement(HostnameListField, {
        path: 'hostnames',
        field: { label: 'Hostnames', admin: { description: 'Comma-separated hostnames.' } },
      }),
    )

    expect(html).toContain('value="www.example.com, example.com"')
    expect(html).toContain('Comma-separated hostnames.')
  })

  it('keeps both redirect choices visible and disables them when no custom hostname is named', () => {
    const html = renderDirection()

    expect(html).toContain('Allow www and non-www')
    expect(html).toContain('Redirect to www')
    expect(html).toContain('Redirect to non-www')
    expect(radioTag(html, 'allow-www-and-non-www')).toContain('checked')
    expect(radioTag(html, 'allow-www-and-non-www')).not.toContain('disabled')
    expect(radioTag(html, 'redirect-to-www')).toContain('disabled')
    expect(radioTag(html, 'redirect-to-non-www')).toContain('disabled')
  })

  it('allows Redirect to non-www only when the first hostname apex is in the list', () => {
    formState.hostnames = ['example.com']
    const html = renderDirection()

    expect(radioTag(html, 'redirect-to-www')).toContain('disabled')
    expect(radioTag(html, 'redirect-to-non-www')).not.toContain('disabled')
  })

  it('allows Redirect to www only when www of the first hostname is in the list', () => {
    formState.hostnames = ['www.example.com']
    const html = renderDirection()

    expect(radioTag(html, 'redirect-to-www')).not.toContain('disabled')
    expect(radioTag(html, 'redirect-to-non-www')).toContain('disabled')
  })

  it('disables both redirect choices for a hostname with no pair partner', () => {
    formState.hostnames = ['blog.example.co.uk']
    const blog = renderDirection()
    formState.hostnames = ['mysite.example.com']
    const nested = renderDirection()

    for (const html of [blog, nested]) {
      expect(radioTag(html, 'redirect-to-www')).toContain('disabled')
      expect(radioTag(html, 'redirect-to-non-www')).toContain('disabled')
    }
  })

  it('does not enable a redirect choice because a later pair is complete', () => {
    formState.hostnames = ['blog.example.co.uk', 'www.other.com', 'other.com']
    const html = renderDirection()

    expect(radioTag(html, 'redirect-to-www')).toContain('disabled')
    expect(radioTag(html, 'redirect-to-non-www')).toContain('disabled')
  })

  it('keeps a Direction selected after the list no longer supports it', () => {
    formState.direction = 'redirect-to-non-www'
    formState.hostnames = ['www.example.com']
    const html = renderDirection()
    const selected = radioTag(html, 'redirect-to-non-www')

    expect(selected).toContain('checked')
    expect(selected).toContain('disabled')
    expect(formState.direction).toBe('redirect-to-non-www')
    expect(radioTag(html, 'redirect-to-www')).not.toContain('disabled')
  })
})
