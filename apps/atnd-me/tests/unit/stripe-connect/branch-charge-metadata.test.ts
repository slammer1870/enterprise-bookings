import { describe, expect, it } from 'vitest'

import { branchChargeMetadata, omitClientBranchMetadata } from '@/lib/stripe-connect/branchChargeMetadata'

describe('branchChargeMetadata', () => {
  it('labels a charge with the one location’s name and slug', () => {
    expect(
      branchChargeMetadata([{ name: 'Rathmines', slug: 'rathmines' }]),
    ).toEqual({
      branchName: 'Rathmines',
      branchSlug: 'rathmines',
    })
  })

  it('labels a charge when every location is the same branch', () => {
    expect(
      branchChargeMetadata([
        { name: 'Rathmines', slug: 'rathmines' },
        { name: 'Rathmines', slug: 'rathmines' },
      ]),
    ).toEqual({
      branchName: 'Rathmines',
      branchSlug: 'rathmines',
    })
  })

  it('leaves a charge unlabeled when the location has no name', () => {
    expect(branchChargeMetadata([{ name: '', slug: 'rathmines' }])).toEqual({})
  })

  it('leaves a charge unlabeled when the location has no slug', () => {
    expect(branchChargeMetadata([{ name: 'Rathmines', slug: '' }])).toEqual({})
  })

  it('leaves a charge unlabeled when any location’s branch is unknown', () => {
    expect(
      branchChargeMetadata([{ name: 'Rathmines', slug: 'rathmines' }, null]),
    ).toEqual({})
  })

  it('leaves a charge unlabeled when the locations are different branches', () => {
    expect(
      branchChargeMetadata([
        { name: 'Rathmines', slug: 'rathmines' },
        { name: 'Drumcondra', slug: 'drumcondra' },
      ]),
    ).toEqual({})
  })

  it('drops a client branch before the server label is applied', () => {
    expect(
      omitClientBranchMetadata({
        branchName: 'Client Branch',
        branchSlug: 'client-branch',
        tenantId: '3',
      }),
    ).toEqual({ tenantId: '3' })
  })
})
