import { describe, expect, it, vi } from 'vitest'

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

import { abortOnPublicHostOutcome } from '../../src/utilities/guardPublicHostAppRoute'

describe('guardPublicHostAppRoute', () => {
  it('throws a 503 response for failed host lookup', () => {
    try {
      abortOnPublicHostOutcome({ kind: 'failed' })
      expect.fail('expected throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      expect((error as Response).status).toBe(503)
    }
  })

  it('calls notFound for unknown host lookup', () => {
    notFoundMock.mockClear()
    abortOnPublicHostOutcome({ kind: 'unknown' })
    expect(notFoundMock).toHaveBeenCalledOnce()
  })
})
