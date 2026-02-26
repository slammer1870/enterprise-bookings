import { describe, it, expect } from 'vitest'
import {
  createPathHelpers,
  isTenantRequiredCreatePath,
  isCreateRequireTenantForTenantAdminPath,
} from '../lib/pathHelpers'

describe('path helpers', () => {
  describe('isTenantRequiredCreatePath', () => {
    it('returns true when pathname is /admin/collections/lessons/create and lessons is in the set', () => {
      const helpers = createPathHelpers({
        collectionsRequireTenantOnCreate: ['lessons', 'instructors'],
      })
      expect(helpers.isTenantRequiredCreatePath('/admin/collections/lessons/create')).toBe(true)
    })

    it('returns false when pathname is /admin/collections/pages/create and pages is not in the set', () => {
      const helpers = createPathHelpers({
        collectionsRequireTenantOnCreate: ['lessons'],
      })
      expect(helpers.isTenantRequiredCreatePath('/admin/collections/pages/create')).toBe(false)
    })

    it('returns false when pathname is null or not a create path', () => {
      const helpers = createPathHelpers({ collectionsRequireTenantOnCreate: ['lessons'] })
      expect(helpers.isTenantRequiredCreatePath(null)).toBe(false)
      expect(helpers.isTenantRequiredCreatePath('/admin/collections/lessons')).toBe(false)
      expect(helpers.isTenantRequiredCreatePath('/admin/collections/lessons/123')).toBe(false)
    })

    it('accepts Set for collectionsRequireTenantOnCreate', () => {
      const helpers = createPathHelpers({
        collectionsRequireTenantOnCreate: new Set(['instructors']),
      })
      expect(helpers.isTenantRequiredCreatePath('/admin/collections/instructors/create')).toBe(true)
      expect(helpers.isTenantRequiredCreatePath('/admin/collections/lessons/create')).toBe(false)
    })
  })

  describe('isCreateRequireTenantForTenantAdminPath', () => {
    it('returns true when pathname is /admin/collections/pages/create and pages is in the set', () => {
      const helpers = createPathHelpers({
        collectionsCreateRequireTenantForTenantAdmin: ['pages', 'navbar', 'footer'],
      })
      expect(helpers.isCreateRequireTenantForTenantAdminPath('/admin/collections/pages/create')).toBe(
        true,
      )
    })

    it('returns false when pathname is /admin/collections/lessons/create and lessons is not in tenant-admin set', () => {
      const helpers = createPathHelpers({
        collectionsCreateRequireTenantForTenantAdmin: ['pages'],
      })
      expect(helpers.isCreateRequireTenantForTenantAdminPath('/admin/collections/lessons/create')).toBe(
        false,
      )
    })

    it('returns false when pathname is null', () => {
      const helpers = createPathHelpers({
        collectionsCreateRequireTenantForTenantAdmin: ['pages'],
      })
      expect(helpers.isCreateRequireTenantForTenantAdminPath(null)).toBe(false)
    })
  })

  describe('standalone exports (default options)', () => {
    it('isTenantRequiredCreatePath uses empty set when no options', () => {
      expect(isTenantRequiredCreatePath('/admin/collections/lessons/create', {})).toBe(false)
    })

    it('isTenantRequiredCreatePath returns true when slug in options', () => {
      expect(
        isTenantRequiredCreatePath('/admin/collections/lessons/create', {
          collectionsRequireTenantOnCreate: ['lessons'],
        }),
      ).toBe(true)
    })

    it('isCreateRequireTenantForTenantAdminPath returns true when slug in options', () => {
      expect(
        isCreateRequireTenantForTenantAdminPath('/admin/collections/pages/create', {
          collectionsCreateRequireTenantForTenantAdmin: ['pages'],
        }),
      ).toBe(true)
    })
  })
})
