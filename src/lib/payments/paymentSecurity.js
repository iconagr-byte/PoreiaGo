export const DEFAULT_PAYMENT_SECURITY = {
  require_amount_on_confirm: true,
  require_reference_on_confirm: true,
  validate_iban_checksum: true,
  audit_payment_actions: true,
  mask_iban_public: false,
  notify_customer_on_payment: true,
  notify_admin_on_payment: true,
  notify_sms_on_fiscal_receipt: true,
  notify_push_on_fiscal_receipt: true,
  notify_erp_on_fiscal_receipt: true,
  notify_admin_on_fiscal_issues: true,
  admin_notification_email: '',
  email_spam_filter_enabled: true,
  block_disposable_emails: true,
  email_deliverability_headers: true,
  blocked_email_domains: [],
  allowed_email_domains: [],
};

export function normalizePaymentSecurity(raw = {}) {
  const merged = { ...DEFAULT_PAYMENT_SECURITY, ...(raw || {}) };
  return {
    require_amount_on_confirm: merged.require_amount_on_confirm !== false,
    require_reference_on_confirm: merged.require_reference_on_confirm !== false,
    validate_iban_checksum: merged.validate_iban_checksum !== false,
    audit_payment_actions: merged.audit_payment_actions !== false,
    mask_iban_public: Boolean(merged.mask_iban_public),
    notify_customer_on_payment: merged.notify_customer_on_payment !== false,
    notify_admin_on_payment: merged.notify_admin_on_payment !== false,
    notify_sms_on_fiscal_receipt: merged.notify_sms_on_fiscal_receipt !== false,
    notify_push_on_fiscal_receipt: merged.notify_push_on_fiscal_receipt !== false,
    notify_erp_on_fiscal_receipt: merged.notify_erp_on_fiscal_receipt !== false,
    notify_admin_on_fiscal_issues: merged.notify_admin_on_fiscal_issues !== false,
    admin_notification_email: String(merged.admin_notification_email || '').trim(),
    email_spam_filter_enabled: merged.email_spam_filter_enabled !== false,
    block_disposable_emails: merged.block_disposable_emails !== false,
    email_deliverability_headers: merged.email_deliverability_headers !== false,
    blocked_email_domains: Array.isArray(merged.blocked_email_domains)
      ? merged.blocked_email_domains.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
      : [],
    allowed_email_domains: Array.isArray(merged.allowed_email_domains)
      ? merged.allowed_email_domains.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
      : [],
  };
}

export const SPAM_BLOCK_REASONS = {
  invalid_email_format: 'Μη έγκυρη μορφή email',
  missing_domain: 'Λείπει domain email',
  suspicious_local_part: 'Ύποπτο email address',
  domain_not_in_allowlist: 'Το domain δεν επιτρέπεται',
  domain_blocklisted: 'Το domain είναι αποκλεισμένο',
  disposable_email_domain: 'Προσωρινά / disposable email δεν επιτρέπονται',
};

export function spamBlockMessage(reason) {
  return SPAM_BLOCK_REASONS[reason] || 'Το email δεν επιτρέπεται';
}

export function amountsMatch(expected, confirmed, tolerance = 0.02) {
  return Math.abs(Number(expected) - Number(confirmed)) <= tolerance;
}

export function referencesMatch(booking, reference) {
  const ref = String(reference || '').trim().toUpperCase().replace(/\s/g, '');
  if (!ref) return false;
  const candidates = [
    booking?.pnr,
    booking?.id,
    booking?.saasBookingId,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase().replace(/\s/g, ''));

  if (candidates.includes(ref)) return true;
  const strip = (v) => v.replace(/^BK-/, '').replace(/^B-/, '');
  return candidates.some((c) => strip(c) === strip(ref) || c.endsWith(ref) || ref.endsWith(c));
}

export function validateDepositConfirmation(booking, { amount, reference }, security) {
  const sec = normalizePaymentSecurity(security);
  const expectedAmount = Number(booking.balanceDue || booking.price || 0);
  const errors = [];

  if (sec.require_amount_on_confirm) {
    if (!Number.isFinite(Number(amount))) {
      errors.push('Συμπληρώστε το ποσό κατάθεσης');
    } else if (!amountsMatch(expectedAmount, amount)) {
      errors.push(`Το ποσό πρέπει να είναι €${expectedAmount.toFixed(2)}`);
    }
  }

  if (sec.require_reference_on_confirm) {
    if (!referencesMatch(booking, reference)) {
      errors.push('Η αναφορά δεν ταιριάζει με PNR / κωδικό κράτησης');
    }
  }

  return errors;
}

export function bookingBalanceDue(booking) {
  const explicit = Number(booking?.balanceDue);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const total = Number(booking?.price || 0);
  const paid = Number(booking?.amountPaid || 0);
  return Math.max(0, total - paid);
}

export function validateCashPayment(booking, { amount, channel, reference }, security) {
  const sec = normalizePaymentSecurity(security);
  const errors = [];
  const balance = bookingBalanceDue(booking);
  const amountNum = Number(amount);

  if (!channel || !['office_counter', 'driver_on_bus'].includes(channel)) {
    errors.push('Επιλέξτε κανάλι είσπραξης (γκισέ ή οδηγός)');
  }

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.push('Συμπληρώστε έγκυρο ποσό είσπραξης');
  } else if (balance > 0 && amountNum > balance + 0.02) {
    errors.push(`Το ποσό υπερβαίνει το υπόλοιπο (€${balance.toFixed(2)})`);
  }

  const status = String(booking?.status || '').toLowerCase();
  if (status.includes('ακυρ') || status === 'cancelled' || status === 'refunded') {
    errors.push('Η κράτηση είναι ακυρωμένη');
  }

  if (sec.require_reference_on_confirm && reference) {
    if (!referencesMatch(booking, reference)) {
      errors.push('Ο κωδικός κράτησης δεν ταιριάζει');
    }
  }

  return errors;
}
