/** ISO 13616 IBAN mod-97 validation. */

export function normalizeIban(value) {
  return String(value || '').replace(/\s/g, '').trim().toUpperCase();
}

export function validateIbanChecksum(iban) {
  const cleaned = normalizeIban(iban);
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false;

  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  let digits = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') digits += ch;
    else if (ch >= 'A' && ch <= 'Z') digits += String(ch.charCodeAt(0) - 55);
    else return false;
  }

  let remainder = 0;
  for (let i = 0; i < digits.length; i += 7) {
    remainder = Number(String(remainder) + digits.slice(i, i + 7)) % 97;
  }
  return remainder === 1;
}

export function maskIban(iban, visibleTail = 4) {
  const cleaned = normalizeIban(iban);
  if (cleaned.length <= visibleTail + 4) return cleaned;
  const head = cleaned.slice(0, 4);
  const tail = cleaned.slice(-visibleTail);
  const maskedLen = Math.max(4, cleaned.length - head.length - visibleTail);
  return `${head}${'*'.repeat(maskedLen)}${tail}`;
}
