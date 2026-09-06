/**
 * Receipt status: Εστάλη → Παραδόθηκε → Διαβάστηκε
 */

const LABELS = {
  sent: 'Εστάλη',
  delivered: 'Παραδόθηκε',
  read: 'Διαβάστηκε',
};

export function resolveChatReceipt(message, viewer) {
  if (!message || message.sender !== viewer) return null;
  if (message.receipt === 'read' || message.receipt === 'delivered' || message.receipt === 'sent') {
    return message.receipt;
  }
  if (viewer === 'driver') {
    if (message.read_by_office_at) return 'read';
    if (message.delivered_to_office_at) return 'delivered';
    return 'sent';
  }
  if (message.read_by_driver_at) return 'read';
  if (message.delivered_to_driver_at) return 'delivered';
  return 'sent';
}

export function ChatReceiptStatus({ status, tone = 'light' }) {
  if (!status) return null;
  const label = LABELS[status] || LABELS.sent;
  const isRead = status === 'read';
  const isDelivered = status === 'delivered' || isRead;
  const color =
    tone === 'onBlue'
      ? isRead
        ? 'text-sky-200'
        : 'text-white/75'
      : isRead
        ? 'text-sky-600'
        : 'text-slate-400';

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${color}`}>
      <span className="material-symbols-outlined text-[14px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
        {isDelivered ? 'done_all' : 'done'}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function formatChatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
