import { describe, expect, it } from 'vitest'

import { tenantScopedSlugField } from '@/fields/tenant-scoped-slug-field'
import { runHooks } from '../helpers/admin-toast'

const slugHooks = (
  tenantScopedSlugField({ collection: 'pages' }) as {
    hooks?: { beforeValidate?: unknown }
  }
).hooks?.beforeValidate

describe('tenantScopedSlugField formatting', () => {
  it('formats invalid characters into a URL-safe slug', async () => {
    const result = await runHooks(
      slugHooks,
      {
        data: { tenant: 1 },
        operation: 'create',
        req: { context: {}, payload: { find: async () => ({ docs: [] }) } },
        value: 'About Us!!!',
      },
      'value',
    )
    expect(result).toBe('about-us')
  })

  it('does not throw when slug is empty during create hydration', async () => {
    await expect(
      runHooks(
        slugHooks,
        {
          data: { tenant: 1 },
          operation: 'create',
          req: { context: {}, payload: { find: async () => ({ docs: [] }) } },
          value: '',
        },
        'value',
      ),
    ).resolves.toBe('')
  })

  it('auto-formats from title on create when slug is empty', async () => {
    const result = await runHooks(
      slugHooks,
      {
        data: { tenant: 1, title: 'Hello World' },
        operation: 'create',
        req: { context: {}, payload: { find: async () => ({ docs: [] }) } },
        value: '',
      },
      'value',
    )
    expect(result).toBe('hello-world')
  })

  it('rejects unusable non-empty slugs', async () => {
    await expect(
      runHooks(
        slugHooks,
        {
          data: { tenant: 1 },
          operation: 'create',
          req: { context: {}, payload: { find: async () => ({ docs: [] }) } },
          value: '!!!',
        },
        'value',
      ),
    ).rejects.toThrow(/valid URL path/i)
  })
})
