/**
 * Step checklist for email IMAP/SMTP «Έλεγχος» — shared by settings + wizard.
 * Shows what is being verified (host, port, user) for every office mailbox.
 */

export function buildPendingEmailChecks(account = {}) {
  const email = String(account.email_address || '').trim();
  const user = String(account.mail_username || email || '').trim();
  const imapHost = String(account.imap_host || '').trim();
  const smtpHost = String(account.smtp_host || '').trim();
  const imapPort = Number(account.imap_port) || 993;
  const smtpPort = Number(account.smtp_port) || 465;
  const imapSsl =
    account.imap_secure !== false ? 'SSL/TLS' : 'χωρίς SSL';
  const smtpTls =
    Number(smtpPort) === 465
      ? 'SSL'
      : account.smtp_secure
        ? 'STARTTLS'
        : 'χωρίς TLS';

  return [
    {
      id: 'target',
      label: `Λογαριασμός · ${email || '—'}`,
      status: 'pending',
      detail: user && user !== email ? `Username: ${user}` : 'Έλεγχος IMAP + SMTP για αυτό το γραφείο',
    },
    {
      id: 'imap_host',
      label: `IMAP · ${imapHost || '—'}:${imapPort} (${imapSsl})`,
      status: 'pending',
      detail: 'Αναμονή…',
    },
    {
      id: 'imap_auth',
      label: `IMAP login · ${user || '—'}`,
      status: 'pending',
      detail: 'Αναμονή…',
    },
    {
      id: 'smtp_host',
      label: `SMTP · ${smtpHost || '—'}:${smtpPort} (${smtpTls})`,
      status: 'pending',
      detail: 'Αναμονή…',
    },
    {
      id: 'smtp_auth',
      label: `SMTP login · ${user || '—'}`,
      status: 'pending',
      detail: 'Αναμονή…',
    },
  ];
}

function isTimeout(msg) {
  return /timeout|timed out|δεν ήταν δυνατή η σύνδεση|Errno 110/i.test(String(msg || ''));
}

/**
 * @param {object} account
 * @param {{ ok?: boolean, imap?: { ok?: boolean, error?: string, message?: string }, smtp?: { ok?: boolean, error?: string, message?: string } }} result
 */
export function buildEmailChecksFromResult(account = {}, result = {}) {
  const pending = buildPendingEmailChecks(account);
  const imapOk = Boolean(result.imap?.ok);
  const smtpOk = Boolean(result.smtp?.ok);
  const imapErr = result.imap?.error || (!imapOk ? 'Αποτυχία IMAP' : '');
  const smtpErr = result.smtp?.error || (!smtpOk ? 'Αποτυχία SMTP' : '');
  const imapHostFail = !imapOk && isTimeout(imapErr);
  const smtpHostFail = !smtpOk && isTimeout(smtpErr);

  const byId = Object.fromEntries(pending.map((c) => [c.id, { ...c }]));

  byId.target.status = result.ok ? 'ok' : 'fail';
  byId.target.detail = result.ok
    ? 'IMAP & SMTP επιτυχία'
    : 'Ολοκληρώθηκε με σφάλμα — δείτε τα βήματα παρακάτω';

  byId.imap_host.status = imapOk ? 'ok' : 'fail';
  byId.imap_host.detail = imapOk ? (result.imap?.message || 'Σύνδεση OK') : imapErr;

  byId.imap_auth.status = imapOk ? 'ok' : imapHostFail ? 'skip' : 'fail';
  byId.imap_auth.detail = imapOk
    ? 'Ταυτοποίηση OK'
    : imapHostFail
      ? 'Παραλείφθηκε — δεν ανοίγει πρώτα ο διακομιστής'
      : imapErr;

  byId.smtp_host.status = smtpOk ? 'ok' : 'fail';
  byId.smtp_host.detail = smtpOk ? (result.smtp?.message || 'Σύνδεση OK') : smtpErr;

  byId.smtp_auth.status = smtpOk ? 'ok' : smtpHostFail ? 'skip' : 'fail';
  byId.smtp_auth.detail = smtpOk
    ? 'Ταυτοποίηση OK'
    : smtpHostFail
      ? 'Παραλείφθηκε — δεν ανοίγει πρώτα ο διακομιστής'
      : smtpErr;

  return {
    checks: ['target', 'imap_host', 'imap_auth', 'smtp_host', 'smtp_auth'].map((id) => byId[id]),
    imapHostFail,
    smtpHostFail,
    ok: Boolean(result.ok),
  };
}
