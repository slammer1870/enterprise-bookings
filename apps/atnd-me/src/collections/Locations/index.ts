import type { CollectionConfig } from 'payload'
import { isValidTimeZone } from '@repo/shared-utils'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedUpdate,
} from '@/access/tenant-scoped'
import { locationsReadAccess } from '@/access/locationsReadAccess'
import { isPureLocationManager } from '@/access/locationManagerScope'
import { isLocationManager, isStaffOnlyUser, tenantOrgPayloadAdminAccess } from '@/access/userTenantAccess'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'

function normalizeLocationSlug(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Locations: CollectionConfig = {
  slug: 'locations',
  labels: {
    singular: 'Location',
    plural: 'Locations',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Configuration',
    defaultColumns: ['name', 'slug', 'tenant', 'active'],
    description: 'Branches or sites for a tenant (e.g. Town A / Town B). Slug is unique per tenant.',
    hidden: ({ user }) => {
      if (!user) return true
      return !(tenantOrgPayloadAdminAccess({ req: { user } } as any) || isLocationManager(user))
    },
  },
  access: {
    admin: ({ req: { user } }) => {
      if (!user) return false
      return tenantOrgPayloadAdminAccess({ req: { user } } as any) || isLocationManager(user)
    },
    read: locationsReadAccess,
    create: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      if (isPureLocationManager(args.req.user)) return false
      return tenantScopedCreate(args)
    },
    update: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      if (isPureLocationManager(args.req.user)) return false
      return tenantScopedUpdate(args)
    },
    delete: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      if (isPureLocationManager(args.req.user)) return false
      return tenantScopedDelete(args)
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      unique: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'address',
      type: 'textarea',
      required: false,
    },
    {
      name: 'timeZone',
      type: 'text',
      required: false,
      admin: {
        description:
          'Optional IANA timezone for this branch (e.g. Europe/Dublin). If empty, the tenant default is used.',
      },
      validate: (value: unknown) => {
        const timeZone = typeof value === 'string' ? value.trim() : ''
        if (!timeZone) return true
        return isValidTimeZone(timeZone) || 'Enter a valid IANA timezone'
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Inactive locations can be hidden from scheduling and public UIs later.',
      },
    },
    {
      name: 'defaultForSchedule',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Optional. If enabled (and the location is active), this location is pre-selected as the default branch on public schedule pages.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        if (!data) return data

        if (operation === 'create' && !data.tenant) {
          const tenantId = await getTenantIdForCreateRequest(req.payload, {
            context: req.context,
            cookies:
              req && typeof req === 'object' && 'cookies' in req
                ? (req as { cookies?: { get: (name: string) => { value?: string } | undefined } }).cookies
                : undefined,
            headers: req.headers,
          })
          if (tenantId != null && tenantId !== '') {
            data.tenant = tenantId
          }
        }

        const rawSlug = data.slug ?? (operation === 'update' ? originalDoc?.slug : undefined)
        const normalized = normalizeLocationSlug(rawSlug)
        if (!normalized) {
          throw new Error('Location slug is required')
        }
        data.slug = normalized

        let tenantId: number | null = null
        const rawTenant = data.tenant ?? originalDoc?.tenant
        if (rawTenant != null && rawTenant !== '') {
          const id =
            typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
              ? (rawTenant as { id: unknown }).id
              : rawTenant
          if (typeof id === 'number' && Number.isFinite(id)) {
            tenantId = id
          } else if (typeof id === 'string' && /^\d+$/.test(id)) {
            tenantId = parseInt(id, 10)
          }
        }

        if (tenantId == null) {
          throw new Error('Each location must belong to a tenant')
        }

        const currentId = operation === 'update' && originalDoc?.id ? originalDoc.id : null

        const existing = await req.payload.find({
          collection: 'locations',
          where: {
            and: [
              { slug: { equals: normalized } },
              { tenant: { equals: tenantId } },
              ...(currentId != null ? [{ id: { not_equals: currentId } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.docs.length > 0) {
          throw new Error(
            `A location with the slug "${normalized}" already exists for this tenant. Choose a different slug.`,
          )
        }

        return data
      },
      async ({ data, operation, req, originalDoc }) => {
        if (!data) return data

        const effectiveDefaultForSchedule = data.defaultForSchedule ?? originalDoc?.defaultForSchedule
        const effectiveActive = data.active ?? originalDoc?.active

        // Only enforce when the location is both active and marked as the default.
        if (effectiveDefaultForSchedule !== true || effectiveActive !== true) return data

        // tenant is already enforced by the previous hook, but re-derive defensively.
        let tenantId: number | null = null
        const rawTenant = data.tenant ?? originalDoc?.tenant
        if (rawTenant != null && rawTenant !== '') {
          const id =
            typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
              ? (rawTenant as { id: unknown }).id
              : rawTenant
          if (typeof id === 'number' && Number.isFinite(id)) {
            tenantId = id
          } else if (typeof id === 'string' && /^\d+$/.test(id)) {
            tenantId = parseInt(id, 10)
          }
        }
        if (tenantId == null) return data

        const currentId = operation === 'update' && originalDoc?.id ? originalDoc.id : null

        const existingDefault = await req.payload.find({
          collection: 'locations',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { active: { equals: true } },
              { defaultForSchedule: { equals: true } },
              ...(currentId != null ? [{ id: { not_equals: currentId } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existingDefault.totalDocs > 0) {
          throw new Error('Only one active default location can be selected per tenant.')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
