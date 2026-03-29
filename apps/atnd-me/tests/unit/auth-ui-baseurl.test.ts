// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://bru-grappling.atnd.me/auth/magic-link"}

import { describe, it, expect } from 'vitest'
import { getAuthUiBaseURL } from '../../src/lib/auth/getAuthUiBaseURL'

describe('getAuthUiBaseURL', () => {
  it('returns window.location.origin in the browser', () => {
    expect(getAuthUiBaseURL()).toBe('https://bru-grappling.atnd.me')
  })
})

