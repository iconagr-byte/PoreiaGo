/**
 * Smoke tests for email settings file import (JSON + .env).
 */
import { parseEmailSettingsFile } from './emailSettingsImport.js';

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

console.log('emailSettingsImport: OK');
