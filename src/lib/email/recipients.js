/** Συγχώνευση πελατών (local store) + subscribers API */

export function mergeRecipientContacts(customers = [], subscribers = []) {
  const map = new Map();
  for (const c of customers) {
    const email = (c.email || '').trim().toLowerCase();
    if (!email.includes('@')) continue;
    map.set(email, {
      email,
      name: (c.name || '').trim(),
      customerId: c.id || null,
      source: 'customer',
    });
  }
  for (const s of subscribers) {
    const email = (s.email || '').trim().toLowerCase();
    if (!email.includes('@')) continue;
    const prev = map.get(email);
    if (prev) {
      map.set(email, {
        ...prev,
        name: prev.name || (s.name || '').trim(),
        customerId: prev.customerId || s.customer_id || null,
      });
    } else {
      map.set(email, {
        email,
        name: (s.name || '').trim(),
        customerId: s.customer_id || null,
        source: 'subscriber',
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email, 'el'),
  );
}

export function parseToEmails(str) {
  return String(str || '')
    .split(/[,;]\s*/)
    .map((s) => s.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

/** Αντικαθιστά το τελευταίο τμήμα (π.χ. καθώς πληκτρολογείτε) με πλήρες email */
export function replaceLastToSegment(current, email) {
  const addr = String(email).trim().toLowerCase();
  if (!addr.includes('@')) return current;
  const trimmed = String(current || '').trim();
  if (!trimmed) return addr;
  const parts = trimmed.split(/[,;]\s*/);
  if (parts.length === 1 && !/[,;]/.test(trimmed)) return addr;
  parts[parts.length - 1] = addr;
  return parts.join(', ');
}

export function appendToField(current, emails) {
  const list = Array.isArray(emails) ? emails : [emails];
  const existing = new Set(parseToEmails(current));
  const add = list
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e.includes('@') && !existing.has(e));
  if (!add.length) return current;
  const base = (current || '').trim();
  const sep = base ? (base.endsWith(',') ? ' ' : ', ') : '';
  return `${base}${sep}${add.join(', ')}`;
}

export function filterContacts(contacts, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(
    (c) =>
      c.email.includes(q) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.customerId && String(c.customerId).toLowerCase().includes(q)),
  );
}
