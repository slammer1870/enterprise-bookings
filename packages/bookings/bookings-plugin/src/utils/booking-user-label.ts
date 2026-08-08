/**
 * Display labels for a booking's user when some fields may be omitted by field-level
 * access (e.g. staff cannot read other users' emails). Never interpolates missing
 * values as the string "undefined".
 */

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function relationUserId(user: unknown): number | null {
  if (typeof user === "number" && Number.isFinite(user)) return user;
  if (user && typeof user === "object" && "id" in user) {
    const id = (user as { id: unknown }).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);
  }
  return null;
}

/** Compact label for lists / detail rows: prefer name, then email, then id. */
export function bookingUserLabel(user: unknown): string {
  if (user && typeof user === "object") {
    const name = asNonEmptyString((user as { name?: unknown }).name);
    if (name) return name;
    const email = asNonEmptyString((user as { email?: unknown }).email);
    if (email) return email;
  }
  const id = relationUserId(user);
  return id != null ? `User #${id}` : "Unknown user";
}

/** Select-option label: include email when readable; never append "undefined". */
export function bookingUserOptionLabel(user: unknown): string {
  if (user && typeof user === "object") {
    const name = asNonEmptyString((user as { name?: unknown }).name);
    const email = asNonEmptyString((user as { email?: unknown }).email);
    if (name && email) return `${name} – ${email}`;
    if (name) return name;
    if (email) return email;
  }
  const id = relationUserId(user);
  return id != null ? `User #${id}` : "Unknown user";
}
