/** Shared copy when the app server cannot TCP to the customer mail host. */

/** Outbound IP of the live API host (Contabo VPS — www/api.poreiago.com). Not the old GCP IP. */
export const APP_MAIL_EGRESS_IP = '169.58.199.186';

/** Achillio cPanel server that holds the mailbox (webmail / AUTH). */
export const ACHILLIO_CPANEL_MAIL_HOST = 'srv23.intechs.gr';

/**
 * Hosts that open TCP but reject AUTH because DNS points at the wrong cPanel box.
 * mail.achilliotravel.com → srv24; mailbox is on srv23.
 */
export const WRONG_MAIL_HOST_HINTS = {
  'mail.achilliotravel.com': {
    suggestedHost: ACHILLIO_CPANEL_MAIL_HOST,
    peerNote: 'DNS → srv24.intechs.gr · mailbox στο srv23.intechs.gr',
  },
};

export function resolveWrongMailHost(mailHost) {
  const host = String(mailHost || '')
    .trim()
    .toLowerCase();
  const hint = WRONG_MAIL_HOST_HINTS[host];
  if (!hint) return null;
  return { configuredHost: host, ...hint };
}

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
    `Παρακαλώ επιβεβαιώστε ότι επιτρέπεται remote IMAP/SMTP AUTH από το IP ${ip} ` +
    `(Contabo VPS της εφαρμογής — ΟΧΙ το παλιό GCP 34.141.98.145) ` +
    `προς ${mailHost} στις θύρες ${imapPort} (IMAP SSL) και ${smtpPort} (SMTP SSL) ` +
    `για τον λογαριασμό mailbox. Χρειάζεται remote AUTH (IMAP LOGIN + SMTP AUTH), ` +
    `όχι μόνο άνοιγμα θυρών / «όλα ΟΚ στο webmail». ` +
    `Από αυτό το IP παίρνουμε AUTHENTICATIONFAILED / 535 ενώ το TCP ανοίγει.`
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
  const ip = String(egressIp || APP_MAIL_EGRESS_IP).trim() || APP_MAIL_EGRESS_IP;
  return {
    title: 'Το webmail ανοίγει — η εφαρμογή όχι',
    summary:
      `Αν το Intechs λέει ότι «το έκαναν ήδη», επιβεβαιώστε ότι το επιτρεπόμενο IP είναι ${ip} (Contabo) και ΟΧΙ το παλιό Google IP 34.141.98.145. Επίσης remote AUTH (IMAP LOGIN + SMTP AUTH), όχι μόνο ανοιχτές θύρες. Το 535 / AUTHENTICATIONFAILED είναι ίδιο είτε για λάθος κωδικό είτε για block ανά IP.`,
    nextStep:
      'Στείλτε στο Intechs το παρακάτω αίτημα και ζητήστε επιβεβαίωση ποιο ακριβώς IP έχουν στη whitelist (CSF / cPHulk / SMTP Restrictions).',
    ...mailReachabilityGuideBase({ mailHost, imapPort, smtpPort, egressIp: ip }),
  };
}

/**
 * Guide when AUTH fails because mail.domain DNS points at the wrong shared cPanel host.
 */
export function mailWrongHostGuide({
  mailHost,
  suggestedHost = ACHILLIO_CPANEL_MAIL_HOST,
  imapPort = 993,
  smtpPort = 465,
} = {}) {
  const bad = String(mailHost || 'mail.achilliotravel.com').trim() || 'mail.achilliotravel.com';
  const good = String(suggestedHost || ACHILLIO_CPANEL_MAIL_HOST).trim() || ACHILLIO_CPANEL_MAIL_HOST;
  const request =
    `Το DNS A του ${bad} δείχνει σε λάθος Intechs server (srv24) ενώ το mailbox ` +
    `info@achilliotravel.com και το webmail είναι στο ${good} (srv23). ` +
    `Παρακαλώ διορθώστε το A record του ${bad} (και MX αν χρειάζεται) ώστε να δείχνει στο ίδιο IP με το ${good}, ` +
    `ή επιβεβαιώστε ότι για IMAP/SMTP Client Settings χρησιμοποιούμε host ${good}. ` +
    `Από εξωτερικό client: AUTH στο ${bad} = AUTHENTICATIONFAILED/535 · AUTH στο ${good} = OK με τον ίδιο κωδικό.`;
  return {
    title: 'Λάθος mail host (DNS) — όχι κωδικός',
    summary:
      `Το ${bad} ανοίγει TCP αλλά το AUTH απορρίπτεται επειδή δείχνει σε άλλο cPanel (srv24). ` +
      `Το webmail / mailbox είναι στο ${good}. Αλλάξτε IMAP + SMTP host σε ${good}, αποθηκεύστε και ξανακάντε Έλεγχο.`,
    nextStep: `Βάλτε IMAP host και SMTP host: ${good} · μετά «Έλεγχος σύνδεσης».`,
    request,
    facts: [
      { id: 'bad', label: 'Λάθος host', value: bad, copy: bad },
      { id: 'good', label: 'Σωστό host', value: good, copy: good },
      { id: 'imap', label: 'IMAP', value: String(Number(imapPort) || 993), copy: String(Number(imapPort) || 993) },
      { id: 'smtp', label: 'SMTP', value: String(Number(smtpPort) || 465), copy: String(Number(smtpPort) || 465) },
    ],
    steps: [
      `Αλλάξτε IMAP host → ${good}`,
      `Αλλάξτε SMTP host → ${good}`,
      'Αποθήκευση · Έλεγχος σύνδεσης',
      'Στείλτε στο Intechs αίτημα διόρθωσης DNS για mail.achilliotravel.com',
    ],
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
