/** Provider presets for autonomous personal-email connect (no hosting whitelist). */

export const PROVIDERS = {
  gmail: {
    id: 'gmail',
    label: 'Gmail / Google',
    autonomous: true,
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: true,
    passwordLabel: 'App Password Google',
    help: [
      'Google Account → Ασφάλεια → Επαλήθευση σε 2 βήματα (αν χρειάζεται)',
      'Κωδικοί εφαρμογών → Δημιουργία → Mail',
      'Επικολλήστε τον 16ψήφιο App Password παρακάτω (όχι τον κανονικό κωδικό Gmail)',
    ],
  },
  outlook: {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    autonomous: true,
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_secure: true,
    passwordLabel: 'Κωδικός ή App Password',
    help: [
      'Για προσωπικό Outlook/Hotmail συχνά αρκεί ο κωδικός λογαριασμού',
      'Για Microsoft 365 εταιρικό: Security → App passwords αν ζητηθεί',
    ],
  },
  yahoo: {
    id: 'yahoo',
    label: 'Yahoo Mail',
    autonomous: true,
    imap_host: 'imap.mail.yahoo.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.mail.yahoo.com',
    smtp_port: 587,
    smtp_secure: true,
    passwordLabel: 'App Password Yahoo',
    help: [
      'Yahoo Account Security → Generate app password',
      'Χρησιμοποιήστε το app password (όχι τον κανονικό κωδικό)',
    ],
  },
  custom: {
    id: 'custom',
    label: 'Εταιρικό email (cPanel)',
    autonomous: true,
    imap_host: '',
    imap_port: 993,
    imap_secure: true,
    smtp_host: '',
    // cPanel Secure SSL/TLS: SMTP 465 implicit SSL (not 587 STARTTLS).
    smtp_port: 465,
    smtp_secure: false,
    passwordLabel: 'Κωδικός mailbox',
    help: [
      'Όπως στο cPanel → Mail Client: host mail.το-domain.gr',
      'IMAP 993 SSL · SMTP 465 SSL · κωδικός webmail',
    ],
  },
};

export function detectProvider(email) {
  const domain = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[1] || '';
  if (!domain) return PROVIDERS.custom;
  if (['gmail.com', 'googlemail.com'].includes(domain)) return PROVIDERS.gmail;
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'office365.com'].includes(domain)) {
    return PROVIDERS.outlook;
  }
  if (domain.endsWith('.onmicrosoft.com')) return PROVIDERS.outlook;
  if (['yahoo.com', 'yahoo.gr', 'ymail.com'].includes(domain)) return PROVIDERS.yahoo;
  return {
    ...PROVIDERS.custom,
    imap_host: `mail.${domain}`,
    smtp_host: `mail.${domain}`,
  };
}

export function buildAccountFromWizard({
  email,
  password,
  label,
  provider,
  mode = 'direct',
}) {
  const addr = String(email || '').trim().toLowerCase();
  const prov =
    mode === 'gmail_bridge'
      ? PROVIDERS.gmail
      : provider || detectProvider(addr);

  return {
    label: label || addr,
    email_address: mode === 'gmail_bridge' ? addr : addr,
    mail_username: mode === 'gmail_bridge' ? addr : addr,
    mail_password: password || '',
    imap_host: prov.imap_host || (addr.includes('@') ? `mail.${addr.split('@')[1]}` : ''),
    imap_port: prov.imap_port,
    imap_secure: prov.imap_secure,
    imap_mailbox: 'INBOX',
    imap_folder_sent: 'Sent',
    imap_folder_spam: 'Spam',
    smtp_host: prov.smtp_host || (addr.includes('@') ? `mail.${addr.split('@')[1]}` : ''),
    smtp_port: prov.smtp_port,
    smtp_secure: prov.smtp_secure,
    is_active: true,
    provider_id: prov.id,
    connect_mode: mode,
  };
}
