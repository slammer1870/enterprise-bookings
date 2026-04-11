/**
 * When there are zero users in the database, the next create must become platform
 * super-admin so a fresh install is never locked out of Payload admin.
 *
 * The role list is set to exactly `['super-admin']` so the bootstrap user is not
 * also treated as a normal `user` for `checkRole(['user'], …)`-style access rules.
 */
export function applyFirstUserSuperAdminRole(
  data: { role?: unknown },
  existingUserCount: number,
): void {
  if (existingUserCount > 0 || !data) return
  data.role = ['super-admin']
}
