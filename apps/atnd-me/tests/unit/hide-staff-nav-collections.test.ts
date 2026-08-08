import { describe, it, expect } from 'vitest'
import { STAFF_ONLY_NAV_COLLECTION_SLUGS } from '@/plugins/hide-staff-nav-collections'

describe('STAFF_ONLY_NAV_COLLECTION_SLUGS', () => {
  it('allows timeslots, users, and emergency contacts only', () => {
    expect([...STAFF_ONLY_NAV_COLLECTION_SLUGS].sort()).toEqual(
      ['emergency-contacts', 'timeslots', 'users'].sort(),
    )
  })
})
