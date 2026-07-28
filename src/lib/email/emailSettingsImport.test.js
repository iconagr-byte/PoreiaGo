/**
 * Smoke tests for email settings file import (JSON + .env + Apple .mobileconfig).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeEmailSettingsBytes,
  parseEmailSettingsBytes,
  parseEmailSettingsFile,
} from './emailSettingsImport.js';

const here = dirname(fileURLToPath(import.meta.url));

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

const unsignedMc = parseEmailSettingsBytes(
  readFileSync(join(here, 'fixtures/unsigned-email.mobileconfig')),
  'unsigned-email.mobileconfig',
);
console.assert(unsignedMc.accounts.length === 1, 'unsigned mobileconfig account');
console.assert(unsignedMc.accounts[0].email_address === 'sales@example.com', 'mc email');
console.assert(unsignedMc.accounts[0].imap_host === 'mail.example.com', 'mc imap');
console.assert(unsignedMc.accounts[0].smtp_port === 465, 'mc smtp 465');
console.assert(unsignedMc.accounts[0].mail_password === 'secret-pass', 'mc password');
console.assert(unsignedMc.errors.length === 0, 'unsigned with password has no soft errors');

const signedMc = parseEmailSettingsBytes(
  readFileSync(join(here, 'fixtures/info-achilliotravel.mobileconfig')),
  'info@achilliotravel.com Secure Email Setup.mobileconfig',
);
console.assert(signedMc.accounts.length === 1, 'signed PKCS#7 mobileconfig');
console.assert(
  signedMc.accounts[0].email_address === 'info@achilliotravel.com',
  'signed email',
);
console.assert(
  signedMc.accounts[0].imap_host === 'mail.achilliotravel.com',
  'signed imap host',
);
console.assert(signedMc.accounts[0].imap_port === 993, 'signed imap port');
console.assert(signedMc.accounts[0].smtp_port === 465, 'signed smtp port');
console.assert(signedMc.accounts[0].smtp_secure === true, 'signed smtp ssl');
console.assert(!signedMc.accounts[0].mail_password, 'cPanel profile has no password');
console.assert(
  signedMc.errors.some((e) => e.includes('κωδικός')),
  'prompts for password',
);

console.log('emailSettingsImport: OK');
