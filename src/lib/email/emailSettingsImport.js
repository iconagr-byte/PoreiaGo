/**
 * Parse email account settings from JSON or .env-style file for IMAP/SMTP import.
 */

const ENV_ALIASES = {
  EMAIL: 'email_address',
  EMAIL_ADDRESS: 'email_address',
  MAIL_USERNAME: 'mail_username',
  USERNAME: 'mail_username',
  MAIL_PASSWORD: 'mail_password',
  PASSWORD: 'mail_password',
  IMAP_HOST: 'imap_host',
  IMAP_PORT: 'imap_port',
  IMAP_SECURE: 'imap_secure',
  IMAP_MAILBOX: 'imap_mailbox',
  IMAP_FOLDER_SENT: 'imap_folder_sent',
  IMAP_FOLDER_SPAM: 'imap_folder_spam',
  SMTP_HOST: 'smtp_host',
  SMTP_PORT: 'smtp_port',
  SMTP_SECURE: 'smtp_secure',
  SMTP_STARTTLS: 'smtp_secure',
  LABEL: 'label',
};

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return Boolean(value);
}

function parsePort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeRawAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const src = { ...raw };
  if (src.email && !src.email_address) src.email_address = src.email;
  if (src.username && !src.mail_username) src.mail_username = src.username;
  if (src.password && !src.mail_password) src.mail_password = src.password;

  const email = String(src.email_address || src.email || '').trim();
  const imapHost = String(src.imap_host || '').trim();
  const smtpHost = String(src.smtp_host || '').trim();
  if (!email || !imapHost || !smtpHost) return null;

  return {
    label: String(src.label || '').trim(),
    email_address: email,
    imap_host: imapHost,
    imap_port: parsePort(src.imap_port, 993),
    imap_secure: parseBool(src.imap_secure ?? true),
    imap_mailbox: String(src.imap_mailbox || 'INBOX').trim() || 'INBOX',
    imap_folder_sent: String(src.imap_folder_sent || 'Sent').trim() || 'Sent',
    imap_folder_spam: String(src.imap_folder_spam || 'Spam').trim() || 'Spam',
    smtp_host: smtpHost,
    smtp_port: parsePort(src.smtp_port, 587),
    smtp_secure: parseBool(src.smtp_secure ?? true),
    mail_username: String(src.mail_username || src.username || email).trim(),
    mail_password: String(src.mail_password || src.password || '').trim(),
    is_active: parseBool(src.is_active ?? true),
    owner_key: String(src.owner_key || 'default').trim() || 'default',
  };
}

function parseEnvText(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim().toUpperCase();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const alias = ENV_ALIASES[key];
    if (alias) map[alias] = value;
  }
  return map;
}

function extractAccountsFromJson(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.accounts)) return data.accounts;
  if (data && typeof data === 'object') return [data];
  return [];
}

/**
 * @param {string} text
 * @param {string} [filename]
 * @returns {{ accounts: object[], errors: string[] }}
 */
export function parseEmailSettingsFile(text, filename = '') {
  const errors = [];
  const lower = (filename || '').toLowerCase();

  if (lower.endsWith('.env') || lower.endsWith('.txt')) {
    const one = normalizeRawAccount(parseEnvText(text));
    if (!one) {
      return {
        accounts: [],
        errors: ['Το αρχείο .env δεν περιέχει EMAIL, IMAP_HOST και SMTP_HOST'],
      };
    }
    if (!one.mail_password) errors.push('Λείπει MAIL_PASSWORD στο αρχείο');
    return { accounts: [one], errors };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { accounts: [], errors: ['Μη έγκυρο JSON αρχείο'] };
  }

  const rawList = extractAccountsFromJson(data);
  const accounts = [];
  rawList.forEach((raw, idx) => {
    const normalized = normalizeRawAccount(raw);
    if (!normalized) {
      errors.push(`Λογαριασμός #${idx + 1}: λείπουν email / IMAP host / SMTP host`);
      return;
    }
    if (!normalized.mail_password) {
      errors.push(`Λογαριασμός ${normalized.email_address}: λείπει κωδικός`);
    }
    accounts.push(normalized);
  });

  return { accounts, errors };
}

export const EMAIL_SETTINGS_TEMPLATE = {
  label: 'Πωλήσεις',
  email_address: 'info@mydomain.gr',
  imap_host: 'mail.mydomain.gr',
  imap_port: 993,
  imap_secure: true,
  imap_mailbox: 'INBOX',
  imap_folder_sent: 'Sent',
  imap_folder_spam: 'Spam',
  smtp_host: 'mail.mydomain.gr',
  smtp_port: 587,
  smtp_secure: true,
  mail_username: 'info@mydomain.gr',
  mail_password: 'YOUR_PASSWORD_HERE',
  is_active: true,
};

export function downloadEmailSettingsTemplate() {
  const blob = new Blob([`${JSON.stringify(EMAIL_SETTINGS_TEMPLATE, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'email-account.example.json';
  a.click();
  URL.revokeObjectURL(url);
}
