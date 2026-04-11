import type { User } from "@repo/shared-types/";

/** Normalize Better Auth `role` (string or hasMany array) into a string list. */
export function getEffectiveUserRoles(user: User | null | undefined): string[] {
  if (!user) return [];
  const fromRoles = Array.isArray(user.roles)
    ? user.roles.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const raw = user.role;
  const fromRole = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string" && x.length > 0)
    : raw != null && raw !== ""
      ? typeof raw === "string" && raw.includes(",")
        ? raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [String(raw)]
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...fromRole, ...fromRoles]) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}
