import { describe, it, expect } from 'vitest'
import {
  createPathHelpers,
  getCollectionEditParams,
  isOptionalTenantCollectionRoute,
  isTenantRequiredCreatePath,
  isCreateRequireTenantForTenantAdminPath,
} from '../shared/pathHelpers'

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

  describe('getCollectionEditParams', () => {
    it('returns collection slug and doc id for edit path', () => {
      expect(getCollectionEditParams('/admin/collections/pages/123')).toEqual({
        collectionSlug: 'pages',
        docId: '123',
      })
      expect(getCollectionEditParams('/admin/collections/posts/42')).toEqual({
        collectionSlug: 'posts',
        docId: '42',
      })
    })

    it('returns null for create path', () => {
      expect(getCollectionEditParams('/admin/collections/pages/create')).toBeNull()
    })

    it('returns null for list path or invalid paths', () => {
      expect(getCollectionEditParams('/admin/collections/pages')).toBeNull()
      expect(getCollectionEditParams(null)).toBeNull()
      expect(getCollectionEditParams('/admin')).toBeNull()
    })

    it('accepts pathname without leading slash', () => {
      expect(getCollectionEditParams('admin/collections/posts/1')).toEqual({
        collectionSlug: 'posts',
        docId: '1',
      })
    })
  })

  describe('isOptionalTenantCollectionRoute', () => {
    it('returns true for pages create (optional tenant)', () => {
      expect(
        isOptionalTenantCollectionRoute('/admin/collections/pages/create', {
          collectionsWithTenantField: ['posts', 'pages'],
          collectionsRequireTenantOnCreate: ['posts'],
        }),
      ).toBe(true)
    })

    it('returns false for required collection even when not in collectionsWithTenantField', () => {
      expect(
        isOptionalTenantCollectionRoute('/admin/collections/subscriptions/1', {
          collectionsWithTenantField: ['pages'],
          collectionsRequireTenantOnCreate: ['subscriptions'],
        }),
      ).toBe(false)
    })

    it('returns false for posts create (required tenant)', () => {
      expect(
        isOptionalTenantCollectionRoute('/admin/collections/posts/create', {
          collectionsWithTenantField: ['posts', 'pages'],
          collectionsRequireTenantOnCreate: ['posts'],
        }),
      ).toBe(false)
    })

    it('returns true for pages edit (optional tenant)', () => {
      expect(
        isOptionalTenantCollectionRoute('/admin/collections/pages/123', {
          collectionsWithTenantField: ['posts', 'pages'],
          collectionsRequireTenantOnCreate: ['posts'],
        }),
      ).toBe(true)
    })

    it('returns false for posts edit (required tenant)', () => {
      expect(
        isOptionalTenantCollectionRoute('/admin/collections/posts/456', {
          collectionsWithTenantField: ['posts', 'pages'],
          collectionsRequireTenantOnCreate: ['posts'],
        }),
      ).toBe(false)
    })

    it('returns true for root doc collection path', () => {
      expect(
        isOptionalTenantCollectionRoute('/admin/collections/navbar/1', {
          rootDocCollections: ['navbar', 'footer'],
          collectionsWithTenantField: ['pages'],
          collectionsRequireTenantOnCreate: ['posts'],
        }),
      ).toBe(true)
    })

    it('returns true for pathname null or non-collection path', () => {
      expect(isOptionalTenantCollectionRoute(null, {})).toBe(true)
      expect(isOptionalTenantCollectionRoute('/admin', {})).toBe(true)
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
