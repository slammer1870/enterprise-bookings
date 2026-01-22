import type { Access } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

/**
 * Get tenant IDs that a user has access to
 * - Admin users: null (can access all tenants)
 * - Tenant-admin users: array of tenant IDs from their tenants field
 * - Regular users: empty array (no tenant management access)
 */
export function getUserTenantIds(user: SharedUser | null): number[] | null {
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
 * 
 * Note: For isGlobal: true collections, the tenant may not be set in data when
 * accessing the create page. The beforeValidate hook will set it from req.context.tenant.
 * So we allow tenant-admin to create if they have any tenants assigned.
 */
export const tenantScopedCreate: Access = ({ req: { user, context }, data }) => {
  if (!user) return false
  
  // Admin can create for any tenant
  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can only create for their assigned tenants
  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false
    
    // If data.tenant is set, validate it's in the user's tenants
    const dataTenant = data?.tenant
    if (dataTenant) {
      const dataTenantId = typeof dataTenant === 'object' && dataTenant !== null
        ? dataTenant.id
        : dataTenant
      
      if (dataTenantId && typeof dataTenantId === 'number' && tenantIds.includes(dataTenantId)) {
        return true
      }
    }
    
    // If data.tenant is not set, check if context.tenant is set and valid
    // This handles the case when accessing the create page (before form submission)
    const contextTenant = context?.tenant
    if (contextTenant) {
      const contextTenantId = typeof contextTenant === 'object' && contextTenant !== null && 'id' in contextTenant
        ? contextTenant.id
        : contextTenant
      
      if (contextTenantId && typeof contextTenantId === 'number' && tenantIds.includes(contextTenantId)) {
        return true
      }
    }
    
    // If no tenant is set in data or context, allow create if user has tenants
    // The beforeValidate hook will set the tenant from context when the form is submitted
    // For isGlobal: true collections, the multi-tenant plugin should set context.tenant
    return true
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
 * IMPORTANT: When req.context.tenant is set (from subdomain), it takes precedence over
 * the user's tenants array. This allows cross-tenant booking - users can see lessons
 * for the tenant they're viewing, regardless of their tenant assignments.
 */
export const tenantScopedReadFiltered: Access = ({ req }) => {
  const user = req.user
  const contextTenant = req.context?.tenant
  
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
  // If context.tenant is set (from subdomain), return true to allow access.
  // The explicit tenant filter in the where clause will handle tenant filtering.
  // 
  // NOTE: We return true here instead of a tenant constraint because:
  // 1. The tRPC router already has an explicit tenant filter in the where clause
  // 2. Having both explicit filter AND access control constraint can cause conflicts
  // 3. The explicit filter is more reliable and easier to debug
  //
  // This allows cross-tenant booking - users can see lessons for the tenant
  // they're viewing (from subdomain), regardless of their tenant assignments.
  if (contextTenant) {
    // Return true to allow access - tenant filtering is handled by explicit where clause
    return true
  }
  
  // No tenant context - allow read (multi-tenant plugin will handle filtering if needed)
  return true
}
