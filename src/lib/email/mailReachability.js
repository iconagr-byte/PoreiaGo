/** Shared copy when the app server cannot TCP to the customer mail host. */

/** Outbound IP of the live API host (Contabo VPS — www/api.poreiago.com). Not the old GCP IP. */
export const APP_MAIL_EGRESS_IP = '169.58.199.186';

export function isMailTimeoutMessage(msg) {
  return /timeout|timed out|δεν ήταν δυνατή η σύνδεση|Errno 110|μη προσβάσιμος/i.test(
    String(msg || ''),
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

/** Structured guide for timeout / firewall UI (copyable request + fact chips). */
export function mailTimeoutGuide({ mailHost, imapPort, smtpPort } = {}) {
  const host = String(mailHost || 'mail.achilliotravel.com').trim() || 'mail.achilliotravel.com';
  const imap = Number(imapPort) || 993;
  const smtp = Number(smtpPort) || 465;
  const request = hostingWhitelistRequest({ mailHost: host, imapPort: imap, smtpPort: smtp });
  return {
    title: 'Ο mail server δεν απαντά',
    summary:
      'Δεν είναι λάθος κωδικός. Ο διακομιστής email μπλοκάρει τη σύνδεση από τον server της εφαρμογής.',
    nextStep: 'Στείλτε στον πάροχο hosting (cPanel / Intechs) το παρακάτω αίτημα whitelist.',
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

/** Full hint text (summary + request) — used for clipboard / legacy callers. */
export function mailTimeoutHintEl(opts = {}) {
  const g = mailTimeoutGuide(opts);
  return `${g.summary} ${g.nextStep}\n\n${g.request}`;
}
