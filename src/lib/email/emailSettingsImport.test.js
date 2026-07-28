/**
 * Smoke tests for email settings file import (JSON + .env).
 */
import {
  decodeEmailSettingsBytes,
  parseEmailSettingsFile,
} from './emailSettingsImport.js';

const jsonOk = parseEmailSettingsFile(
  JSON.stringify({
    email_address: 'a@b.gr',
    imap_host: 'imap.b.gr',
    smtp_host: 'smtp.b.gr',
    mail_password: 'secret',
  }),
  'account.json',
);
console.assert(jsonOk.accounts.length === 1, 'json account');
console.assert(jsonOk.errors.length === 0, 'json no errors');

const envNamedProd = parseEmailSettingsFile(
  `
EMAIL=info@office.gr
IMAP_HOST=mail.office.gr
SMTP_HOST=mail.office.gr
MAIL_PASSWORD=pass123
`,
  '.env.prod',
);
console.assert(envNamedProd.accounts.length === 1, '.env.prod parsed');
console.assert(envNamedProd.accounts[0].email_address === 'info@office.gr', 'env email');

const envNoExt = parseEmailSettingsFile(
  `EMAIL=x@y.gr
IMAP_HOST=imap.y.gr
SMTP_HOST=smtp.y.gr
SMTP_PASSWORD=zz
`,
  'secrets',
);
console.assert(envNoExt.accounts.length === 1, 'env without extension');
console.assert(envNoExt.accounts[0].mail_password === 'zz', 'SMTP_PASSWORD alias');

const badJson = parseEmailSettingsFile('{not json', 'broken.json');
console.assert(badJson.accounts.length === 0, 'bad json rejected');
console.assert(badJson.errors[0].includes('Μη έγκυρο'), 'clear error');

const bomEnv = parseEmailSettingsFile(
  `\uFEFFEMAIL=bom@test.gr
IMAP_HOST=imap.test.gr
SMTP_HOST=smtp.test.gr
MAIL_PASSWORD=1
`,
  'mail.env',
);
console.assert(bomEnv.accounts[0]?.email_address === 'bom@test.gr', 'BOM stripped');

const smtpOnly = parseEmailSettingsFile(
  `EMAIL=info@achilliotravel.com
SMTP_HOST=mail.achilliotravel.com
MAIL_PASSWORD=secret
`,
  '.env.prod',
);
console.assert(smtpOnly.accounts.length === 1, 'smtp-only env');
console.assert(
  smtpOnly.accounts[0].imap_host === 'mail.achilliotravel.com',
  'imap derived from smtp',
);

const envKeyedJson = parseEmailSettingsFile(
  JSON.stringify({
    EMAIL: 'a@b.gr',
    SMTP_HOST: 'mail.b.gr',
    MAIL_PASSWORD: 'x',
  }),
  'settings.json',
);
console.assert(envKeyedJson.accounts.length === 1, 'env keys inside JSON');

const laravel = parseEmailSettingsFile(
  `MAIL_FROM_ADDRESS=info@office.gr
MAIL_HOST=mail.office.gr
MAIL_PASSWORD=secret
MAIL_ENCRYPTION=tls
MAIL_PORT=587
`,
  '.env',
);
console.assert(laravel.accounts.length === 1, 'laravel aliases');
console.assert(laravel.accounts[0].smtp_port === 587, 'laravel port');

const jsonNamedEnv = parseEmailSettingsFile(
  JSON.stringify({
    email_address: 'j@son.gr',
    smtp_host: 'mail.son.gr',
    mail_password: 'p',
  }),
  '.env.prod',
);
console.assert(jsonNamedEnv.accounts[0]?.email_address === 'j@son.gr', 'json inside .env.prod name');

const utf16 = decodeEmailSettingsBytes(
  new Uint8Array([0xff, 0xfe, 0x45, 0x00, 0x3d, 0x00, 0x61, 0x00]),
);
console.assert(utf16.includes('E=a') || utf16.startsWith('E='), 'utf16 decode');

console.log('emailSettingsImport: OK');
