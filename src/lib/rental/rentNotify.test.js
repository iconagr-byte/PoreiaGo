/**
 * Smoke test for rent notify settings helpers.
 */
import {
  DEFAULT_RENT_NOTIFY,
  readRentNotifySettings,
  rentNotifyPatchFromForm,
} from './rentNotify.js';

const defaults = readRentNotifySettings(null);
console.assert(defaults.emailEnabled === true, 'email on by default');
console.assert(defaults.smsEnabled === true, 'sms on by default');
console.assert(defaults.emailLabel.includes('email'), 'email label');
console.assert(defaults.smsLabel.includes('SMS'), 'sms label');

const off = readRentNotifySettings({
  rent_notify_email_enabled: false,
  rent_notify_sms_enabled: false,
  rent_notify_email_default: true,
  rent_notify_sms_default: true,
});
console.assert(off.emailEnabled === false, 'email can disable');
console.assert(off.smsEnabled === false, 'sms can disable');
console.assert(off.emailDefault === true, 'email default');
console.assert(off.smsDefault === true, 'sms default');

const patch = rentNotifyPatchFromForm({
  emailEnabled: true,
  smsEnabled: false,
  emailLabel: 'Offers',
  smsLabel: 'SMS',
  emailDefault: true,
  smsDefault: false,
  smsTemplateConfirmed: 'Hi {ref}',
  smsTemplateStatus: 'Status {status}',
  emailSubject: 'Subj {ref}',
  emailBody: 'Body {name}',
});
console.assert(patch.rent_notify_email_enabled === true, 'patch email on');
console.assert(patch.rent_notify_sms_enabled === false, 'patch sms off');
console.assert(patch.rent_notify_email_label === 'Offers', 'patch label');
console.assert(patch.rent_notify_email_default === true, 'patch default');
console.assert(
  Object.keys(DEFAULT_RENT_NOTIFY).every((k) => k in patch),
  'patch has all keys',
);

console.log('rentNotify: OK');
