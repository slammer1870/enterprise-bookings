import { getPayload, type Payload } from 'payload'
import config from './multi-tenant.config'
import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

describe('Multi-tenant plugin configuration', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('has tenants collection configured', async () => {
    expect(payload).toBeDefined()
    const collections = payload.config.collections.map((c) => c.slug)
    expect(collections).toContain('tenants')
  })
})

