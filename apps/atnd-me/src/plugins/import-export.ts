import { importExportPlugin } from '@payloadcms/plugin-import-export'
import type { Access, CollectionBeforeOperationHook, Plugin } from 'payload'

import { resolveTenantIdFromRequest } from '@/access/tenant-scoped'
import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'

const USER_DATA_EXPORT_COLLECTIONS = [
  'users',
  'bookings',
  'subscriptions',
  'class-passes',
  'transactions',
] as const

const exportCreateAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  return isAdmin(user) || isTenantAdmin(user)
}

const exportReadAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true

  const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)
  if (!Number.isFinite(userId)) return false

  return {
    requestedBy: {
      equals: userId,
    },
  }
}

const exportDeleteAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true

  const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)
  if (!Number.isFinite(userId)) return false

  return {
    requestedBy: {
      equals: userId,
    },
  }
}

const captureExportRequestContext: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create') return

  const data = args.data as Record<string, unknown>
  const tenantScope = await resolveTenantIdFromRequest(req)
  if (tenantScope != null) {
    data.tenantScope = tenantScope
  }

  if (req.user?.id != null) {
    const userId =
      typeof req.user.id === 'number' ? req.user.id : parseInt(String(req.user.id), 10)
    if (Number.isFinite(userId)) {
      data.requestedBy = userId
    }
  }
}

export const userDataImportExportPlugin = (): Plugin =>
  importExportPlugin({
    collections: [...USER_DATA_EXPORT_COLLECTIONS],
    format: 'csv',
    disableSave: true,
    overrideExportCollection: (collection) => ({
      ...collection,
      access: {
        ...collection.access,
        create: exportCreateAccess,
        read: exportReadAccess,
        update: () => false,
        delete: exportDeleteAccess,
      },
      admin: {
        ...collection.admin,
        group: false,
      },
      fields: [
        ...collection.fields,
        {
          name: 'requestedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            hidden: true,
          },
        },
        {
          name: 'tenantScope',
          type: 'number',
          admin: {
            hidden: true,
          },
        },
      ],
      hooks: {
        ...collection.hooks,
        beforeOperation: [
          captureExportRequestContext,
          ...(collection.hooks?.beforeOperation ?? []),
        ],
      },
    }),
  })
