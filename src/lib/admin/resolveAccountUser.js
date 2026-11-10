/**
 * Pick which platform user the account/security panel should edit.
 *
 * Impersonation JWTs keep the SuperAdmin `sub` + email, which are not rows in
 * the target office — falling back to that id yields PATCH "User not found".
 * While impersonating, resolve the office admin (email match, else first admin).
 */
export function resolveAccountUser(users, { jwtSub = '', email = '', impersonating = false } = {}) {
  const list = Array.isArray(users) ? users.filter(Boolean) : [];
  const sub = String(jwtSub || '').trim();
  const emailL = String(email || '').trim().toLowerCase();

  if (sub) {
    const byId = list.find((u) => String(u.id) === sub);
    if (byId) return byId;
  }
  if (emailL) {
    const byEmail = list.find((u) => String(u.email || '').toLowerCase() === emailL);
    if (byEmail) return byEmail;
  }
  if (!impersonating) return null;

  const admins = list.filter((u) => String(u.role || '').toLowerCase() === 'admin');
  const activeAdmin = admins.find((u) => u.is_active !== false);
  if (activeAdmin) return activeAdmin;
  if (admins[0]) return admins[0];

  const active = list.find((u) => u.is_active !== false);
  return active || list[0] || null;
}
