/** Smoke tests for personal-email provider detection. */
import {
  buildAccountFromWizard,
  detectProvider,
} from './emailProviderPresets.js';

const gmail = detectProvider('me@gmail.com');
console.assert(gmail.id === 'gmail', 'gmail detect');
console.assert(gmail.imap_host === 'imap.gmail.com', 'gmail imap');

const yahoo = detectProvider('x@yahoo.gr');
console.assert(yahoo.id === 'yahoo', 'yahoo.gr detect');

const custom = detectProvider('info@achilliotravel.com');
console.assert(custom.id === 'custom', 'custom detect');
console.assert(custom.imap_host === 'mail.achilliotravel.com', 'custom imap host');
console.assert(custom.smtp_host === 'mail.achilliotravel.com', 'custom smtp host');
console.assert(custom.imap_port === 993, 'cPanel IMAP 993');
console.assert(custom.smtp_port === 465, 'cPanel SMTP 465 SSL');
console.assert(custom.smtp_secure === false, '465 uses implicit SSL not STARTTLS');

const achillio = buildAccountFromWizard({
  email: 'info@achilliotravel.com',
  password: 'mailbox-pass',
  provider: custom,
});
console.assert(achillio.imap_host === 'mail.achilliotravel.com', 'wizard imap');
console.assert(achillio.smtp_port === 465, 'wizard smtp 465');
console.assert(achillio.imap_port === 993, 'wizard imap 993');

const bridged = buildAccountFromWizard({
  email: 'me@gmail.com',
  password: 'abcd efgh ijkl mnop',
  mode: 'gmail_bridge',
});
console.assert(bridged.imap_host === 'imap.gmail.com', 'bridge uses gmail');
console.assert(bridged.smtp_port === 587, 'bridge smtp 587');

console.log('emailProviderPresets ok');
