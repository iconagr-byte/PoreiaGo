/**
 * Parse email account settings from JSON, .env, or Apple .mobileconfig (cPanel Secure Email Setup).
 */

const ENV_ALIASES = {
  EMAIL: 'email_address',
  EMAIL_ADDRESS: 'email_address',
  MAIL_FROM: 'email_address',
  MAIL_EMAIL: 'email_address',
  MAIL_FROM_ADDRESS: 'email_address',
  FROM_EMAIL: 'email_address',
  SMTP_FROM: 'email_address',
  SMTP_FROM_EMAIL: 'email_address',
  MAIL_USERNAME: 'mail_username',
  USERNAME: 'mail_username',
  USER: 'mail_username',
  SMTP_USER: 'mail_username',
  SMTP_USERNAME: 'mail_username',
  IMAP_USER: 'mail_username',
  IMAP_USERNAME: 'mail_username',
  MAIL_PASSWORD: 'mail_password',
  PASSWORD: 'mail_password',
  PASS: 'mail_password',
  SMTP_PASSWORD: 'mail_password',
  SMTP_PASS: 'mail_password',
  IMAP_PASSWORD: 'mail_password',
  IMAP_PASS: 'mail_password',
  MAIL_PASS: 'mail_password',
  IMAP_HOST: 'imap_host',
  MAIL_IMAP_HOST: 'imap_host',
  IMAP_SERVER: 'imap_host',
  IMAP_HOSTNAME: 'imap_host',
  IMAP_PORT: 'imap_port',
  MAIL_IMAP_PORT: 'imap_port',
  IMAP_SECURE: 'imap_secure',
  IMAP_SSL: 'imap_secure',
  IMAP_TLS: 'imap_secure',
  IMAP_MAILBOX: 'imap_mailbox',
  IMAP_FOLDER: 'imap_mailbox',
  IMAP_FOLDER_SENT: 'imap_folder_sent',
  IMAP_FOLDER_SPAM: 'imap_folder_spam',
  SMTP_HOST: 'smtp_host',
  MAIL_HOST: 'smtp_host',
  MAIL_SMTP_HOST: 'smtp_host',
  SMTP_SERVER: 'smtp_host',
  SMTP_HOSTNAME: 'smtp_host',
  SMTP_PORT: 'smtp_port',
  MAIL_PORT: 'smtp_port',
  MAIL_SMTP_PORT: 'smtp_port',
  SMTP_SECURE: 'smtp_secure',
  SMTP_SSL: 'smtp_secure',
  SMTP_TLS: 'smtp_secure',
  SMTP_STARTTLS: 'smtp_secure',
  MAIL_ENCRYPTION: 'mail_encryption',
  SMTP_ENCRYPTION: 'mail_encryption',
  LABEL: 'label',
  MAIL_LABEL: 'label',
  MAIL_FROM_NAME: 'label',
  // Single host often used by shared hosting (Intechs / cPanel).
  MAIL_SERVER: 'smtp_host',
  EMAIL_HOST: 'smtp_host',
  HOST: 'smtp_host',
};

function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

/** Decode UTF-8 / UTF-16LE / UTF-16BE from raw bytes (Windows Notepad etc.). */
export function decodeEmailSettingsBytes(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes);
    }
  }
  // UTF-16LE without BOM: lots of 0x00 in odd positions
  if (bytes.length >= 8) {
    let zeros = 0;
    for (let i = 1; i < Math.min(bytes.length, 64); i += 2) {
      if (bytes[i] === 0) zeros += 1;
    }
    if (zeros >= 8) {
      try {
        return new TextDecoder('utf-16le').decode(bytes);
      } catch {
        /* fall through */
      }
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function looksLikeEnvText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return false;
  let kv = 0;
  for (const line of lines.slice(0, 80)) {
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) kv += 1;
  }
  return kv >= 2;
}

function filenameSuggestsEnv(filename = '') {
  const lower = String(filename || '').toLowerCase();
  if (!lower) return false;
  if (lower.endsWith('.env') || lower.endsWith('.txt')) return true;
  if (lower.includes('.env.') || lower.endsWith('.env.local') || lower.endsWith('.env.prod')) {
    return true;
  }
  if (/(^|[\\/])(\.?env)([.\\-_].*)?$/i.test(lower)) return true;
  if (lower.endsWith('.env.example') || lower.endsWith('.env.sample')) return true;
  return false;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'ssl', 'tls', 'starttls'].includes(v)) return true;
  if (['0', 'false', 'no', 'off', '', 'null', 'none'].includes(v)) return false;
  return Boolean(value);
}

function parsePort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function applyEncryptionHints(src) {
  const enc = String(src.mail_encryption || '').trim().toLowerCase();
  if (!enc) return src;
  const next = { ...src };
  if (['ssl', 'smtps'].includes(enc)) {
    if (next.smtp_secure == null || next.smtp_secure === '') next.smtp_secure = true;
    if (!next.smtp_port) next.smtp_port = 465;
  } else if (['tls', 'starttls'].includes(enc)) {
    if (next.smtp_secure == null || next.smtp_secure === '') next.smtp_secure = true;
    if (!next.smtp_port) next.smtp_port = 587;
  }
  return next;
}

function normalizeRawAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let src = { ...raw };
  // Flat JSON that used .env-style keys (EMAIL, IMAP_HOST, …).
  for (const [key, value] of Object.entries(raw)) {
    const alias = ENV_ALIASES[String(key).trim().toUpperCase()];
    if (alias && (src[alias] == null || src[alias] === '')) {
      src[alias] = value;
    }
  }
  if (src.email && !src.email_address) src.email_address = src.email;
  if (src.username && !src.mail_username) src.mail_username = src.username;
  if (src.password && !src.mail_password) src.mail_password = src.password;
  src = applyEncryptionHints(src);

  let email = String(src.email_address || src.email || '').trim();
  const username = String(src.mail_username || src.username || '').trim();
  if (!email && username.includes('@')) email = username;

  let imapHost = String(src.imap_host || '').trim();
  let smtpHost = String(src.smtp_host || '').trim();
  // Same mail server for IMAP+SMTP is the common Intechs / cPanel case.
  if (!imapHost && smtpHost) imapHost = smtpHost;
  if (!smtpHost && imapHost) smtpHost = imapHost;
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

function stripInlineEnvComment(value) {
  // Keep passwords/values that intentionally contain # inside quotes (already unquoted).
  if (!value.includes('#')) return value;
  // Unquoted trailing comment: host.example.com # production
  const hash = value.indexOf(' #');
  if (hash > 0) return value.slice(0, hash).trim();
  return value;
}

function parseEnvText(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const exportPrefix = /^export\s+/i;
    const lineBody = exportPrefix.test(trimmed) ? trimmed.replace(exportPrefix, '') : trimmed;
    const eq = lineBody.indexOf('=');
    if (eq < 1) continue;
    const key = lineBody.slice(0, eq).trim().toUpperCase();
    let value = lineBody.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      value = stripInlineEnvComment(value);
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

function finalizeAccounts(rawList) {
  const errors = [];
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

function parseAsEnv(text) {
  const one = normalizeRawAccount(parseEnvText(text));
  if (!one) {
    return {
      accounts: [],
      errors: [
        'Το αρχείο δεν περιέχει EMAIL (ή MAIL_FROM / MAIL_FROM_ADDRESS), και SMTP_HOST ή IMAP_HOST (π.χ. MAIL_HOST). Δείτε το «Πρότυπο .env».',
      ],
    };
  }
  const errors = [];
  if (!one.mail_password) {
    errors.push('Λείπει MAIL_PASSWORD (ή SMTP_PASSWORD) στο αρχείο — χωρίς κωδικό δεν γίνεται αποθήκευση');
  }
  return { accounts: [one], errors };
}

function tryParseJson(text) {
  const cleaned = text.trim();
  if (!(cleaned.startsWith('{') || cleaned.startsWith('['))) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function filenameSuggestsMobileconfig(filename = '') {
  return String(filename || '').toLowerCase().endsWith('.mobileconfig');
}

function filenameSuggestsVbs(filename = '') {
  return String(filename || '').toLowerCase().endsWith('.vbs');
}

function looksLikeCpanelVbs(text) {
  const t = String(text || '');
  return (
    /strIncServerAddress\s*=/i.test(t) &&
    /strAccount\s*=/i.test(t) &&
    (/strServerSmtpPort\s*=/i.test(t) || /strOutServerAddress\s*=/i.test(t))
  );
}

/** cPanel VBS stores ports as hex DWORD strings, e.g. "000003e1" → 993. */
function parseVbsHexDword(value, fallback) {
  const raw = String(value ?? '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return fallback;
  if (/^0x/i.test(raw) || /^[0-9a-f]+$/i.test(raw)) {
    const n = Number.parseInt(raw.replace(/^0x/i, ''), 16);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return parsePort(raw, fallback);
}

function parseVbsQuotedAssign(text, varName) {
  const re = new RegExp(
    `\\b${varName}\\s*=\\s*"([^"]*)"`,
    'i',
  );
  const m = re.exec(text);
  return m ? m[1].trim() : '';
}

function parseVbsBoolAssign(text, varName, fallback = false) {
  const re = new RegExp(`\\b${varName}\\s*=\\s*(True|False)\\b`, 'i');
  const m = re.exec(text);
  if (!m) return fallback;
  return String(m[1]).toLowerCase() === 'true';
}

/**
 * Parse cPanel / hosting «Secure Email Setup.vbs» (Windows Live Mail).
 * @param {string} text
 * @returns {{ accounts: object[], errors: string[] }}
 */
export function parseVbsEmailSettings(text) {
  const cleaned = stripBom(text);
  if (!looksLikeCpanelVbs(cleaned)) {
    return {
      accounts: [],
      errors: [
        'Δεν βρέθηκε cPanel Secure Email Setup (.vbs). Χρειάζεται strAccount / strIncServerAddress.',
      ],
    };
  }

  const email = parseVbsQuotedAssign(cleaned, 'strAccount');
  const imapHost = parseVbsQuotedAssign(cleaned, 'strIncServerAddress');
  const smtpHost =
    parseVbsQuotedAssign(cleaned, 'strOutServerAddress') || imapHost;
  const secureHex = parseVbsQuotedAssign(cleaned, 'strSecureConnection');
  const secure =
    secureHex === ''
      ? true
      : parseVbsHexDword(secureHex, 1) !== 0;
  const isPop = parseVbsBoolAssign(cleaned, 'boolPop', false);
  let imapPort = parseVbsHexDword(
    parseVbsQuotedAssign(cleaned, 'strServerMailPort'),
    secure ? 993 : 143,
  );
  // PoreiaGo is IMAP-only — map POP SSL/plain ports to IMAP equivalents.
  if (isPop || imapPort === 995 || imapPort === 110) {
    imapPort = secure ? 993 : 143;
  }
  const smtpPort = parseVbsHexDword(
    parseVbsQuotedAssign(cleaned, 'strServerSmtpPort'),
    secure ? 465 : 587,
  );
  const password =
    parseVbsQuotedAssign(cleaned, 'strPassword') ||
    parseVbsQuotedAssign(cleaned, 'strMailPassword') ||
    parseVbsQuotedAssign(cleaned, 'strAccountPassword');

  const result = finalizeAccounts([
    {
      label: email,
      email_address: email,
      imap_host: imapHost,
      imap_port: imapPort,
      imap_secure: secure,
      imap_mailbox: 'INBOX',
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: secure,
      mail_username: email,
      mail_password: password,
      is_active: true,
    },
  ]);
  if (
    result.accounts.length &&
    result.accounts.every((a) => !a.mail_password) &&
    !result.errors.some((e) => e.includes('κωδικός'))
  ) {
    result.errors.push(
      'Το .vbs δεν περιλαμβάνει κωδικό — συμπληρώστε τον στη φόρμα και Αποθήκευση',
    );
  }
  return result;
}

function bytesToBinaryString(bytes) {
  const chunk = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

/** Extract XML plist from unsigned .mobileconfig or signed PKCS#7 DER profile. */
export function extractMobileconfigPlistXml(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.length) return '';
  const asBin = bytesToBinaryString(bytes);
  let start = asBin.indexOf('<?xml');
  if (start < 0) start = asBin.indexOf('<plist');
  if (start < 0) return '';
  const end = asBin.indexOf('</plist>', start);
  if (end < 0) return '';
  const xmlBin = asBin.slice(start, end + '</plist>'.length);
  // Profiles use UTF-8 ASCII for keys; decode via TextDecoder for safety.
  const xmlBytes = new Uint8Array(xmlBin.length);
  for (let i = 0; i < xmlBin.length; i += 1) xmlBytes[i] = xmlBin.charCodeAt(i) & 0xff;
  return new TextDecoder('utf-8').decode(xmlBytes);
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function plistValueAfterKey(dictXml, key) {
  const keyRe = new RegExp(
    `<key>${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/key>\\s*`,
    'i',
  );
  const km = keyRe.exec(dictXml);
  if (!km) return null;
  const rest = dictXml.slice(km.index + km[0].length);
  const str = /^<string>([\s\S]*?)<\/string>/i.exec(rest);
  if (str) return { type: 'string', value: decodeXmlEntities(str[1]) };
  const integer = /^<integer>(-?\d+)<\/integer>/i.exec(rest);
  if (integer) return { type: 'integer', value: Number(integer[1]) };
  const boolTrue = /^<true\s*\/>/i.exec(rest);
  if (boolTrue) return { type: 'bool', value: true };
  const boolFalse = /^<false\s*\/>/i.exec(rest);
  if (boolFalse) return { type: 'bool', value: false };
  return null;
}

function plistString(dictXml, key) {
  const v = plistValueAfterKey(dictXml, key);
  return v && v.type === 'string' ? String(v.value).trim() : '';
}

function plistPort(dictXml, key, fallback) {
  const v = plistValueAfterKey(dictXml, key);
  if (v && v.type === 'integer') return parsePort(v.value, fallback);
  if (v && v.type === 'string') return parsePort(v.value, fallback);
  return fallback;
}

function plistBool(dictXml, key, fallback) {
  const v = plistValueAfterKey(dictXml, key);
  if (v && v.type === 'bool') return v.value;
  if (v && v.type === 'string') return parseBool(v.value);
  return fallback;
}

/** Top-level <dict> blocks that look like com.apple.mail.managed payloads. */
function extractMailPayloadDicts(plistXml) {
  const blocks = [];
  const re = /<dict>([\s\S]*?)<\/dict>/gi;
  let m;
  while ((m = re.exec(plistXml))) {
    const body = m[1];
    if (
      /<key>EmailAddress<\/key>/i.test(body) &&
      /<key>IncomingMailServerHostName<\/key>/i.test(body)
    ) {
      blocks.push(body);
    }
  }
  return blocks;
}

function mobileconfigDictToRaw(dictXml) {
  const email =
    plistString(dictXml, 'EmailAddress') ||
    plistString(dictXml, 'IncomingMailServerUsername');
  const imapHost = plistString(dictXml, 'IncomingMailServerHostName');
  const smtpHost =
    plistString(dictXml, 'OutgoingMailServerHostName') || imapHost;
  const password =
    plistString(dictXml, 'IncomingPassword') ||
    plistString(dictXml, 'OutgoingPassword') ||
    plistString(dictXml, 'Password');
  const label =
    plistString(dictXml, 'EmailAccountDescription') ||
    plistString(dictXml, 'EmailAccountName') ||
    plistString(dictXml, 'PayloadDisplayName') ||
    email;
  const username =
    plistString(dictXml, 'IncomingMailServerUsername') ||
    plistString(dictXml, 'OutgoingMailServerUsername') ||
    email;
  const mailbox =
    plistString(dictXml, 'IncomingMailServerIMAPPathPrefix') || 'INBOX';

  return {
    label,
    email_address: email,
    imap_host: imapHost,
    imap_port: plistPort(dictXml, 'IncomingMailServerPortNumber', 993),
    imap_secure: plistBool(dictXml, 'IncomingMailServerUseSSL', true),
    imap_mailbox: mailbox || 'INBOX',
    smtp_host: smtpHost,
    smtp_port: plistPort(dictXml, 'OutgoingMailServerPortNumber', 587),
    smtp_secure: plistBool(dictXml, 'OutgoingMailServerUseSSL', true),
    mail_username: username,
    mail_password: password,
    is_active: true,
  };
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {{ accounts: object[], errors: string[] }}
 */
export function parseMobileconfigEmailSettings(buffer) {
  const xml = extractMobileconfigPlistXml(buffer);
  if (!xml) {
    return {
      accounts: [],
      errors: [
        'Δεν βρέθηκε Apple profile (.mobileconfig). Χρησιμοποιήστε το «Secure Email Setup» από cPanel / hosting.',
      ],
    };
  }
  const dicts = extractMailPayloadDicts(xml);
  if (!dicts.length) {
    return {
      accounts: [],
      errors: [
        'Το .mobileconfig δεν περιέχει λογαριασμό email (com.apple.mail.managed).',
      ],
    };
  }
  const result = finalizeAccounts(dicts.map(mobileconfigDictToRaw));
  // cPanel profiles almost never embed the password — guide the user clearly.
  if (
    result.accounts.length &&
    result.accounts.every((a) => !a.mail_password) &&
    !result.errors.some((e) => e.includes('κωδικός'))
  ) {
    result.errors.push(
      'Το Apple profile δεν περιλαμβάνει κωδικό — συμπληρώστε τον στη φόρμα και Αποθήκευση',
    );
  }
  return result;
}

/**
 * @param {string} text
 * @param {string} [filename]
 * @returns {{ accounts: object[], errors: string[] }}
 */
export function parseEmailSettingsFile(text, filename = '') {
  const cleaned = stripBom(text).trim();
  if (!cleaned) {
    return { accounts: [], errors: ['Το αρχείο είναι κενό'] };
  }

  // Unsigned .mobileconfig saved as plain XML plist.
  if (
    filenameSuggestsMobileconfig(filename) ||
    (cleaned.includes('<plist') && cleaned.includes('EmailAddress'))
  ) {
    const enc = new TextEncoder().encode(cleaned);
    const mobile = parseMobileconfigEmailSettings(enc);
    if (mobile.accounts.length || filenameSuggestsMobileconfig(filename)) {
      return mobile;
    }
  }

  // cPanel Windows Live Mail Secure Email Setup (.vbs)
  if (filenameSuggestsVbs(filename) || looksLikeCpanelVbs(cleaned)) {
    const vbs = parseVbsEmailSettings(cleaned);
    if (vbs.accounts.length || filenameSuggestsVbs(filename)) {
      return vbs;
    }
  }

  // Prefer JSON when content is clearly JSON — even if named .env.prod.
  const asJson = tryParseJson(cleaned);
  if (asJson != null) {
    return finalizeAccounts(extractAccountsFromJson(asJson));
  }

  const preferEnv = filenameSuggestsEnv(filename) || looksLikeEnvText(cleaned);
  if (preferEnv) {
    return parseAsEnv(cleaned);
  }

  try {
    const data = JSON.parse(cleaned);
    return finalizeAccounts(extractAccountsFromJson(data));
  } catch {
    if (looksLikeEnvText(cleaned)) {
      return parseAsEnv(cleaned);
    }
    return {
      accounts: [],
      errors: [
        'Μη έγκυρο αρχείο — χρειάζεται .mobileconfig / .vbs (cPanel Secure Email), JSON ή .env με EMAIL + MAIL_HOST/SMTP_HOST. Όχι Word/PDF.',
      ],
    };
  }
}

/**
 * Preferred entry for file input: handles signed .mobileconfig binary + text formats.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @param {string} [filename]
 * @returns {{ accounts: object[], errors: string[] }}
 */
export function parseEmailSettingsBytes(buffer, filename = '') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.length) {
    return { accounts: [], errors: ['Το αρχείο είναι κενό'] };
  }

  const looksSigned =
    bytes.length > 4 && bytes[0] === 0x30 && (bytes[1] === 0x82 || bytes[1] === 0x80);
  if (filenameSuggestsMobileconfig(filename) || looksSigned) {
    const mobile = parseMobileconfigEmailSettings(bytes);
    if (mobile.accounts.length || filenameSuggestsMobileconfig(filename)) {
      return mobile;
    }
  }

  return parseEmailSettingsFile(decodeEmailSettingsBytes(bytes), filename);
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

export const EMAIL_SETTINGS_ENV_TEMPLATE = `# PoreiaGo email account (.env)
EMAIL=info@mydomain.gr
MAIL_USERNAME=info@mydomain.gr
MAIL_PASSWORD=YOUR_PASSWORD_HERE
IMAP_HOST=mail.mydomain.gr
IMAP_PORT=993
IMAP_SECURE=true
SMTP_HOST=mail.mydomain.gr
SMTP_PORT=587
SMTP_SECURE=true
LABEL=Πωλήσεις

# Laravel / shared hosting aliases also work:
# MAIL_FROM_ADDRESS=info@mydomain.gr
# MAIL_HOST=mail.mydomain.gr
# MAIL_ENCRYPTION=tls
`;

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

export function downloadEmailSettingsEnvTemplate() {
  const blob = new Blob([EMAIL_SETTINGS_ENV_TEMPLATE], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'email-account.example.env';
  a.click();
  URL.revokeObjectURL(url);
}
