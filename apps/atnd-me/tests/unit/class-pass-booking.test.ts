/**
 * Phase 4.6 – Unit tests for valid class passes for lesson (filter logic).
 */
import { describe, it, expect } from 'vitest'
import {
  filterValidClassPassesForTimeslot,
  type TimeslotLike,
  type ClassPassLike,
} from '@repo/shared-services'

describe('class-pass-booking (Phase 4.6)', () => {
  const tenantId = 1
  const allowedTypeIds = [10, 20]
  const lesson: TimeslotLike = {
    tenant: tenantId,
    classOption: {
      paymentMethods: {
        allowedClassPasses: [10, 20],
      },
    },
  }

  it('returns only passes that match lesson tenant and allowed types', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const passes: ClassPassLike[] = [
      { id: 1, tenant: tenantId, type: 10, status: 'active', quantity: 5, expirationDate: future },
      { id: 2, tenant: 2, type: 10, status: 'active', quantity: 3, expirationDate: future },
      { id: 3, tenant: tenantId, type: 99, status: 'active', quantity: 1, expirationDate: future },
      { id: 4, tenant: tenantId, type: 20, status: 'active', quantity: 2, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lesson, passes)
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.id)).toEqual([1, 4])
  })

  it('excludes passes with wrong status', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const passes: ClassPassLike[] = [
      { id: 1, tenant: tenantId, type: 10, status: 'expired', quantity: 5, expirationDate: future },
      { id: 2, tenant: tenantId, type: 10, status: 'used', quantity: 1, expirationDate: future },
      { id: 3, tenant: tenantId, type: 10, status: 'active', quantity: 1, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lesson, passes)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(3)
  })

  it('excludes passes with quantity 0 or less', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const passes: ClassPassLike[] = [
      { id: 1, tenant: tenantId, type: 10, status: 'active', quantity: 0, expirationDate: future },
      { id: 2, tenant: tenantId, type: 10, status: 'active', quantity: 2, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lesson, passes)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('excludes passes that cannot cover the requested quantity', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const passes: ClassPassLike[] = [
      { id: 1, tenant: tenantId, type: 10, status: 'active', quantity: 2, expirationDate: future },
      { id: 2, tenant: tenantId, type: 10, status: 'active', quantity: 3, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lesson, passes, new Date(), 3)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('excludes expired passes', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const future = new Date(Date.now() + 86400000).toISOString()
    const passes: ClassPassLike[] = [
      { id: 1, tenant: tenantId, type: 10, status: 'active', quantity: 5, expirationDate: past },
      { id: 2, tenant: tenantId, type: 10, status: 'active', quantity: 2, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lesson, passes)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('returns empty when lesson has no allowedClassPasses', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const lessonNoAllowed: TimeslotLike = {
      tenant: tenantId,
      classOption: { paymentMethods: {} },
    }
    const passes: ClassPassLike[] = [
      { id: 1, tenant: tenantId, type: 10, status: 'active', quantity: 5, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lessonNoAllowed, passes)
    expect(result).toHaveLength(0)
  })

  it('accepts type/tenant as object with id', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const passes: ClassPassLike[] = [
      { id: 1, tenant: { id: tenantId }, type: { id: 10 }, status: 'active', quantity: 1, expirationDate: future },
    ]
    const result = filterValidClassPassesForTimeslot(lesson, passes)
    expect(result).toHaveLength(1)
  })
})
