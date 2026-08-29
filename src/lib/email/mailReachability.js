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

export function mailTimeoutHintEl({ mailHost, imapPort, smtpPort } = {}) {
  return (
    'Δεν είναι λάθος κωδικός — ο mail server δεν απαντά από τον server της εφαρμογής. ' +
    'Στείλτε στον πάροχο hosting (cPanel / Intechs) το παρακάτω αίτημα whitelist.\n\n' +
    hostingWhitelistRequest({ mailHost, imapPort, smtpPort })
  );
}
