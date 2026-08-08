/**
 * Server wrapper: hide analytics Home for staff-only (operational nav).
 * Client link handles pathname highlighting / transitions.
 */
import React from 'react'
import { isStaffOnlyUser } from '@/access/userTenantAccess'
import { NavHomeLinkClient } from './NavHomeLinkClient'

type NavHomeLinkProps = {
  user?: unknown
}

export default function NavHomeLink({ user }: NavHomeLinkProps) {
  if (isStaffOnlyUser(user)) {
    return null
  }
  return <NavHomeLinkClient />
}
