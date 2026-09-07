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
} = {}) {
  return (
    `Παρακαλώ επιτρέψτε εξωτερικές συνδέσεις IMAP/SMTP από το IP ${APP_MAIL_EGRESS_IP} ` +
    `προς ${mailHost} στις θύρες ${imapPort} (IMAP SSL) και ${smtpPort} (SMTP SSL). ` +
    `Χωρίς whitelist το γραφείο δεν μπορεί να συγχρονίσει το mailbox.`
  );
}

function mailReachabilityGuideBase({ mailHost, imapPort, smtpPort } = {}) {
  const host = String(mailHost || 'mail.achilliotravel.com').trim() || 'mail.achilliotravel.com';
  const imap = Number(imapPort) || 993;
  const smtp = Number(smtpPort) || 465;
  const request = hostingWhitelistRequest({ mailHost: host, imapPort: imap, smtpPort: smtp });
  return {
    request,
    facts: [
      { id: 'ip', label: 'IP εφαρμογής', value: APP_MAIL_EGRESS_IP, copy: APP_MAIL_EGRESS_IP },
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
export function mailTimeoutGuide({ mailHost, imapPort, smtpPort } = {}) {
  return {
    title: 'Ο mail server δεν απαντά',
    summary:
      'Δεν είναι λάθος κωδικός. Ο διακομιστής email μπλοκάρει τη σύνδεση από τον server της εφαρμογής.',
    nextStep: 'Στείλτε στον πάροχο hosting (cPanel / Intechs) το παρακάτω αίτημα whitelist.',
    ...mailReachabilityGuideBase({ mailHost, imapPort, smtpPort }),
  };
}

/**
 * Guide when webmail works but IMAP/SMTP AUTH fails with Exim 535 from the app server.
 */
export function mailRemoteAuthGuide({ mailHost, imapPort, smtpPort } = {}) {
  return {
    title: 'Το webmail ανοίγει — η εφαρμογή όχι',
    summary:
      'Ο κωδικός mailbox είναι πιθανότατα σωστός. Το hosting συχνά επιτρέπει μόνο τοπικό webmail και απορρίπτει remote IMAP/SMTP από το IP της εφαρμογής (535 Incorrect authentication data).',
    nextStep: 'Στείλτε στον πάροχο hosting (cPanel / Intechs) το παρακάτω αίτημα whitelist.',
    ...mailReachabilityGuideBase({ mailHost, imapPort, smtpPort }),
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
