import { describe, expect, it, vi } from 'vitest'
import { anotherTenantDeclaresHostname, findTenantByHost } from '@/lib/tenantDbResolve'

function queryText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? []
  return chunks
    .map((chunk) => {
      if (typeof chunk === 'string') return chunk
      if (chunk && typeof chunk === 'object' && 'value' in chunk) {
        const value = (chunk as { value: unknown }).value
        return Array.isArray(value) ? value.join('') : String(value ?? '')
      }
      return ''
    })
    .join('')
}

function payloadWith(execute: ReturnType<typeof vi.fn>, sessionExecute?: ReturnType<typeof vi.fn>) {
  return {
    db: {
      drizzle: { execute },
      sessions: sessionExecute ? { 'tx-1': { db: { execute: sessionExecute } } } : {},
    },
  }
}

const otherRow = {
  rows: [{ id: 2, slug: 'other', hostnames: ['a.com'], direction: 'allow-www-and-non-www' }],
}

describe('anotherTenantDeclaresHostname', () => {
  it('reads inside the hook transaction', async () => {
    const adapterExecute = vi.fn()
    const sessionExecute = vi.fn().mockResolvedValue(otherRow)
    const payload = payloadWith(adapterExecute, sessionExecute)

    await expect(
      anotherTenantDeclaresHostname(payload as never, 'A.com', 9, { transactionID: 'tx-1' }),
    ).resolves.toBe(true)

    expect(sessionExecute).toHaveBeenCalledOnce()
    expect(adapterExecute).not.toHaveBeenCalled()
    const sqlText = queryText(sessionExecute.mock.calls[0][0])
    expect(sqlText).toContain('"hostnames" @>')
    expect(sqlText).toContain('"id"::text <>')
  })

  it('awaits a promised transaction id', async () => {
    const sessionExecute = vi.fn().mockResolvedValue({ rows: [] })
    const payload = payloadWith(vi.fn(), sessionExecute)

    await expect(
      anotherTenantDeclaresHostname(payload as never, 'a.com', 9, {
        transactionID: Promise.resolve('tx-1'),
      }),
    ).resolves.toBe(false)

    expect(sessionExecute).toHaveBeenCalledOnce()
  })

  it('uses the adapter connection when the request has no transaction', async () => {
    const adapterExecute = vi.fn().mockResolvedValue(otherRow)
    const payload = payloadWith(adapterExecute)

    await expect(anotherTenantDeclaresHostname(payload as never, 'a.com', 9)).resolves.toBe(true)
    expect(adapterExecute).toHaveBeenCalledOnce()
  })

  it('falls back to the adapter connection when the session is already gone', async () => {
    const adapterExecute = vi.fn().mockResolvedValue({ rows: [] })
    const payload = payloadWith(adapterExecute)

    await expect(
      anotherTenantDeclaresHostname(payload as never, 'a.com', 9, { transactionID: 'missing' }),
    ).resolves.toBe(false)
    expect(adapterExecute).toHaveBeenCalledOnce()
  })

  it('refuses the check when drizzle is missing', async () => {
    await expect(
      anotherTenantDeclaresHostname({ db: {} } as never, 'a.com', 9, { transactionID: 'tx-1' }),
    ).rejects.toThrow('Cannot tell whether another tenant lists "a.com".')
  })

  it('returns false for a blank hostname without querying', async () => {
    const adapterExecute = vi.fn()
    await expect(
      anotherTenantDeclaresHostname(payloadWith(adapterExecute) as never, '  ', 9),
    ).resolves.toBe(false)
    expect(adapterExecute).not.toHaveBeenCalled()
  })
})

describe('findTenantByHost', () => {
  it('resolves a saved hostname by containment', async () => {
    const adapterExecute = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 4,
          slug: 'acme',
          hostnames: ['www.acme.com'],
          direction: 'allow-www-and-non-www',
        },
      ],
    })

    const resolved = await findTenantByHost(payloadWith(adapterExecute) as never, 'www.acme.com')

    expect(resolved).toMatchObject({ type: 'domain', id: 4, slug: 'acme' })
    const sqlText = queryText(adapterExecute.mock.calls[0][0])
    expect(sqlText).toContain('"hostnames" @>')
    expect(sqlText).not.toContain('"id"::text <>')
  })
})
