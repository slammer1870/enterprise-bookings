import type { Access } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

/**
 * Get tenant IDs that a user has access to
 * - Admin users: null (can access all tenants)
 * - Tenant-admin users: array of tenant IDs from their tenants field
 * - Regular users: empty array (no tenant management access)
 */
function getUserTenantIds(user: SharedUser | null): number[] | null {
  if (!user) return []
  
  // Admin can access all tenants
  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return null // null means "all tenants"
  }
  
  // Tenant-admin can access their assigned tenants
  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenants = (user as any).tenants as Array<any>
    if (!tenants) return []
    
    // tenants can be an array of IDs, an array of tenant objects with 'id', or an array of objects with 'tenant' property
    return tenants.map((tenant: any) => {
      if (typeof tenant === 'object' && tenant !== null) {
        // Handle structure: { tenant: <id> }
        if ('tenant' in tenant) {
          const tenantValue = tenant.tenant
          return typeof tenantValue === 'object' && tenantValue !== null ? tenantValue.id : tenantValue
        }
        // Handle structure: { id: <id> }
        if ('id' in tenant) {
          return tenant.id
        }
      }
      // Handle direct ID
      return tenant
    }).filter((id): id is number => typeof id === 'number')
  }
  
  // Regular users have no tenant management access
  return []
}

/**
 * Access control for reading tenant-scoped documents
 * - Admin: can read all documents
 * - Tenant-admin: can only read documents from their assigned tenants
 * - Regular users: can read documents for booking purposes (public read)
 */
export const tenantScopedRead: Access = ({ req: { user } }) => {
  // Public read access (for booking pages, etc.)
  // This allows regular users to read lessons, class-options, etc. for booking
  return true
}

/**
 * Access control for creating tenant-scoped documents
 * - Admin: can create documents for any tenant
 * - Tenant-admin: can only create documents for their assigned tenants
 * - Regular users: cannot create configuration documents
 */
export const tenantScopedCreate: Access = ({ req: { user }, data }) => {
  if (!user) return false
  
  // Admin can create for any tenant
  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can only create for their assigned tenants
  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null) return true // Shouldn't happen for tenant-admin, but safe
    
    const dataTenant = data?.tenant
    const dataTenantId = typeof dataTenant === 'object' && dataTenant !== null
      ? dataTenant.id
      : dataTenant
    
    if (!dataTenantId) return false
    
    return tenantIds.includes(dataTenantId)
  }
  
  // Regular users cannot create configuration documents
  return false
}

/**
 * Access control for updating tenant-scoped documents
 * - Admin: can update documents for any tenant
 * - Tenant-admin: can only update documents from their assigned tenants
 * - Regular users: cannot update configuration documents
 */
export const tenantScopedUpdate: Access = ({ req: { user }, id }) => {
  if (!user) return false
  
  // Admin can update any document
  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can only update documents from their assigned tenants
  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    // We need to check the document's tenant
    // This will be handled by query constraints in the access control
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false
    
    // Return query constraint to filter by tenant
    return {
      tenant: {
        in: tenantIds,
      },
    }
  }
  
  // Regular users cannot update configuration documents
  return false
}

/**
 * Access control for deleting tenant-scoped documents
 * - Admin: can delete documents for any tenant
 * - Tenant-admin: can only delete documents from their assigned tenants
 * - Regular users: cannot delete configuration documents
 */
export const tenantScopedDelete: Access = ({ req: { user } }) => {
  if (!user) return false
  
  // Admin can delete any document
  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can delete documents from their assigned tenants
  // (query constraint will be applied automatically by update access)
  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false
    
    return {
      tenant: {
        in: tenantIds,
      },
    }
  }
  
  // Regular users cannot delete configuration documents
  return false
}

/**
 * Access control for reading tenant-scoped documents with tenant filtering
 * Used for collections where tenant-admin should only see their tenant's data
 * - Admin: can read all documents
 * - Tenant-admin: can only read documents from their assigned tenants
 * - Regular users: can read documents for the current tenant context (from subdomain)
 * 
 * Note: For lessons specifically, we also need to respect the date range and active status
 * from the default lessonReadAccess, but allow authenticated users to see lessons
 * for the tenant they're currently viewing.
 */
export const tenantScopedReadFiltered: Access = ({ req: { user } }) => {
  // Public read - allow access (multi-tenant plugin will filter by request context)
  if (!user) return true
  
  // Admin can read all documents
  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can only read documents from their assigned tenants
  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false
    
    return {
      tenant: {
        in: tenantIds,
      },
    }
  }
  
  // Regular users: Allow read access for booking purposes
  // The multi-tenant plugin will filter by request context (subdomain)
  // This allows users to see lessons for the tenant they're currently viewing,
  // even if they don't have that tenant in their tenants array
  return true
}
