/** Shared copy when the app server cannot TCP to the customer mail host. */

/** Outbound IP of the live API host (Contabo VPS — www/api.poreiago.com). Not the old GCP IP. */
export const APP_MAIL_EGRESS_IP = '169.58.199.186';

export function isMailTimeoutMessage(msg) {
  return /timeout|timed out|δεν ήταν δυνατή η σύνδεση|Errno 110|μη προσβάσιμος|μη απαντά|δεν ανοίγει σύνδεση|θύρα 993\/143|θύρα 587\/465/i.test(
    String(msg || ''),
  );
}

/**
 * Exim/cPanel often returns 535 «Incorrect authentication data» when remote SMTP AUTH
 * is restricted by IP — even when the mailbox password is correct and webmail works.
 */
export function isMailRemoteAuthRejectMessage(msg) {
  const text = String(msg || '');
  return (
    /Incorrect authentication data/i.test(text) ||
    /\(535,\s*b?['"]Incorrect authentication/i.test(text) ||
    /SMTP σύνδεση:.*\b535\b/i.test(text) ||
    /\b535\b/.test(text) ||
    /μπλοκάρει remote SMTP/i.test(text) ||
    /whitelist εξωτερικών IMAP\/SMTP/i.test(text)
  );
}

/** IMAP AUTH failed + SMTP 535 → almost always hosting remote-auth restrict, not a typo. */
export function isMailRemoteAuthPair(imapError, smtpError) {
  const imap = String(imapError || '');
  const smtp = String(smtpError || '');
  const imapAuth =
    /AUTHENTICATIONFAILED|Authentication failed|λάθος username ή κωδικός/i.test(imap);
  return (
    isMailRemoteAuthRejectMessage(smtp) ||
    isMailRemoteAuthRejectMessage(imap) ||
    (imapAuth && isMailRemoteAuthRejectMessage(smtp))
  );
}

/** Short toast — avoid dumping the full IMAP paragraph twice. */
export const MAIL_TIMEOUT_TOAST_EL = 'Mail server μη προσβάσιμος — δείτε οδηγίες παρακάτω';

export function hostingWhitelistRequest({
  mailHost = 'mail.achilliotravel.com',
  imapPort = 993,
  smtpPort = 465,
  egressIp = APP_MAIL_EGRESS_IP,
} = {}) {
  const ip = String(egressIp || APP_MAIL_EGRESS_IP).trim() || APP_MAIL_EGRESS_IP;
  return (
    `Παρακαλώ επιτρέψτε εξωτερικές συνδέσεις IMAP/SMTP από το IP ${ip} ` +
    `προς ${mailHost} στις θύρες ${imapPort} (IMAP SSL) και ${smtpPort} (SMTP SSL). ` +
    `Επιτρέψτε remote AUTH (IMAP LOGIN + SMTP AUTH) — όχι μόνο άνοιγμα θυρών. ` +
    `Το webmail μπορεί να δουλεύει ενώ το remote AUTH από αυτό το IP απορρίπτεται με 535. ` +
    `Χωρίς whitelist το γραφείο δεν μπορεί να συγχρονίσει το mailbox.`
  );
}

function mailReachabilityGuideBase({ mailHost, imapPort, smtpPort, egressIp } = {}) {
  const host = String(mailHost || 'mail.achilliotravel.com').trim() || 'mail.achilliotravel.com';
  const imap = Number(imapPort) || 993;
  const smtp = Number(smtpPort) || 465;
  const ip = String(egressIp || APP_MAIL_EGRESS_IP).trim() || APP_MAIL_EGRESS_IP;
  const request = hostingWhitelistRequest({ mailHost: host, imapPort: imap, smtpPort: smtp, egressIp: ip });
  return {
    request,
    facts: [
      { id: 'ip', label: 'IP εφαρμογής', value: ip, copy: ip },
      { id: 'host', label: 'Mail host', value: host, copy: host },
      { id: 'imap', label: 'IMAP', value: String(imap), copy: String(imap) },
      { id: 'smtp', label: 'SMTP', value: String(smtp), copy: String(smtp) },
    ],
    steps: [
      'Αντιγράψτε το αίτημα whitelist',
      'Στείλτε το στον πάροχο hosting / cPanel',
      'Μόλις ανοίξουν τις θύρες, πατήστε ξανά «Έλεγχος»',
    ],
  };
}

/** Structured guide for timeout / firewall UI (copyable request + fact chips). */
export function mailTimeoutGuide({ mailHost, imapPort, smtpPort, egressIp } = {}) {
  return {
    title: 'Ο mail server δεν απαντά',
    summary:
      'Δεν είναι λάθος κωδικός. Ο διακομιστής email μπλοκάρει τη σύνδεση από τον server της εφαρμογής.',
    nextStep: 'Στείλτε στον πάροχο hosting (cPanel / Intechs) το παρακάτω αίτημα whitelist.',
    ...mailReachabilityGuideBase({ mailHost, imapPort, smtpPort, egressIp }),
  };
}

/**
 * Guide when webmail works but IMAP/SMTP AUTH fails with Exim 535 from the app server.
 */
export function mailRemoteAuthGuide({ mailHost, imapPort, smtpPort, egressIp } = {}) {
  return {
    title: 'Το webmail ανοίγει — η εφαρμογή όχι',
    summary:
      'Αν το Intechs λέει ότι όλα είναι ΟΚ στο hosting, ζητήστε ρητά remote AUTH από το IP της εφαρμογής. Το webmail μπορεί να δουλεύει ενώ IMAP/SMTP από εξωτερικό IP απορρίπτεται με 535 Incorrect authentication data.',
    nextStep: 'Στείλτε στον πάροχο hosting (cPanel / Intechs) το παρακάτω αίτημα whitelist (και remote AUTH, όχι μόνο άνοιγμα θυρών).',
    ...mailReachabilityGuideBase({ mailHost, imapPort, smtpPort, egressIp }),
  };
}

/** Full hint text (summary + request) — used for clipboard / legacy callers. */
export function mailTimeoutHintEl(opts = {}) {
  const g = mailTimeoutGuide(opts);
  return `${g.summary} ${g.nextStep}\n\n${g.request}`;
}

export function mailRemoteAuthHintEl(opts = {}) {
  const g = mailRemoteAuthGuide(opts);
  return `${g.summary} ${g.nextStep}\n\n${g.request}`;
}
