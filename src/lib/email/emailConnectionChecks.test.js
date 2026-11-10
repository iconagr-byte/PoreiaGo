import {
  buildEmailChecksFromResult,
  buildPendingEmailChecks,
} from './emailConnectionChecks.js';

const account = {
  email_address: 'info@office.example',
  mail_username: 'info@office.example',
  imap_host: 'mail.example.com',
  imap_port: 993,
  imap_secure: true,
  smtp_host: 'mail.example.com',
  smtp_port: 465,
  smtp_secure: false,
};

const pending = buildPendingEmailChecks(account);
console.assert(pending.length === 5, 'five steps');
console.assert(pending[0].label.includes('info@office.example'), 'shows mailbox');
console.assert(pending[1].label.includes('mail.example.com:993'), 'shows imap host');
console.assert(pending[3].label.includes(':465'), 'shows smtp port');

const ok = buildEmailChecksFromResult(account, {
  ok: true,
  imap: { ok: true, message: 'IMAP σύνδεση επιτυχής' },
  smtp: { ok: true, message: 'SMTP σύνδεση επιτυχής' },
});
console.assert(ok.ok === true, 'ok flag');
console.assert(ok.checks.every((c) => c.status === 'ok'), 'all ok');

const fail = buildEmailChecksFromResult(account, {
  ok: false,
  imap: { ok: false, error: 'Connection timed out' },
  smtp: { ok: false, error: 'Connection timed out' },
});
console.assert(fail.imapHostFail && fail.smtpHostFail, 'timeout flags');
console.assert(fail.checks.find((c) => c.id === 'imap_auth')?.status === 'skip', 'auth skipped');

console.log('emailConnectionChecks.test.js OK');
