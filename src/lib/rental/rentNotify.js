/**
 * Rent booking communication preferences (email offers + SMS updates).
 * Stored on site appearance; used by checkout + admin Ειδοποιήσεις tab.
 */

export const DEFAULT_RENT_NOTIFY = {
  rent_notify_email_enabled: true,
  rent_notify_sms_enabled: true,
  rent_notify_email_label: 'Θέλω προσφορές στο email',
  rent_notify_sms_label: 'Θέλω ενημερώσεις SMS για την κράτηση',
  rent_notify_email_default: false,
  rent_notify_sms_default: false,
  rent_notify_sms_template_confirmed:
    'Κράτηση {ref} επιβεβαιώθηκε. Παραλαβή: {pickup} · {start}. {office}',
  rent_notify_sms_template_status:
    'Κράτηση {ref}: νέα κατάσταση {status}. {office}',
  rent_notify_email_subject: 'Κράτηση {ref} — επιβεβαίωση',
  rent_notify_email_body:
    'Γεια σου {name},<br/><br/>Η κράτησή σου <strong>{ref}</strong> επιβεβαιώθηκε.<br/>Παραλαβή: {pickup}<br/>Έναρξη: {start}<br/><br/>Ευχαριστούμε,<br/>{office}',
};

export function readRentNotifySettings(appearance = {}) {
  const src = appearance && typeof appearance === 'object' ? appearance : {};
  const str = (key) => {
    const v = String(src[key] ?? DEFAULT_RENT_NOTIFY[key] ?? '').trim();
    return v || DEFAULT_RENT_NOTIFY[key];
  };
  return {
    emailEnabled: src.rent_notify_email_enabled !== false,
    smsEnabled: src.rent_notify_sms_enabled !== false,
    emailLabel: str('rent_notify_email_label'),
    smsLabel: str('rent_notify_sms_label'),
    emailDefault: Boolean(src.rent_notify_email_default),
    smsDefault: Boolean(src.rent_notify_sms_default),
    smsTemplateConfirmed: str('rent_notify_sms_template_confirmed'),
    smsTemplateStatus: str('rent_notify_sms_template_status'),
    emailSubject: str('rent_notify_email_subject'),
    emailBody: str('rent_notify_email_body'),
  };
}

export function rentNotifyPatchFromForm(form) {
  return {
    rent_notify_email_enabled: form.emailEnabled !== false,
    rent_notify_sms_enabled: form.smsEnabled !== false,
    rent_notify_email_label: String(form.emailLabel || '').trim() || DEFAULT_RENT_NOTIFY.rent_notify_email_label,
    rent_notify_sms_label: String(form.smsLabel || '').trim() || DEFAULT_RENT_NOTIFY.rent_notify_sms_label,
    rent_notify_email_default: Boolean(form.emailDefault),
    rent_notify_sms_default: Boolean(form.smsDefault),
    rent_notify_sms_template_confirmed:
      String(form.smsTemplateConfirmed || '').trim() ||
      DEFAULT_RENT_NOTIFY.rent_notify_sms_template_confirmed,
    rent_notify_sms_template_status:
      String(form.smsTemplateStatus || '').trim() || DEFAULT_RENT_NOTIFY.rent_notify_sms_template_status,
    rent_notify_email_subject:
      String(form.emailSubject || '').trim() || DEFAULT_RENT_NOTIFY.rent_notify_email_subject,
    rent_notify_email_body:
      String(form.emailBody || '').trim() || DEFAULT_RENT_NOTIFY.rent_notify_email_body,
  };
}
