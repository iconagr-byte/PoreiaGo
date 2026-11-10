import { useCallback, useEffect, useState } from 'react';
import { readActiveEmailAccountId } from '../../lib/email/activeEmailAccount.js';
import { fetchMailboxFolders } from '../../services/emailClientApi.js';
import { fetchEmailSettings } from '../../services/emailSettingsApi.js';
import { useUiLang } from '../../hooks/useUiLang.js';
import '../../styles/admin-header-icons.css';

/**
 * Compact circular mail control in admin header — opens Mailbox + unread dot.
 */
export default function AdminMailHeaderButton({ onOpenMailbox, active = false } = {}) {
  const { t } = useUiLang();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const accounts = await fetchEmailSettings();
      const list = Array.isArray(accounts) ? accounts : [];
      if (!list.length) {
        setUnread(0);
        return;
      }
      const preferred = readActiveEmailAccountId();
      const accountId =
        (preferred && list.some((a) => a?.id === preferred) && preferred) || list[0]?.id || '';
      if (!accountId) {
        setUnread(0);
        return;
      }
      const data = await fetchMailboxFolders(accountId);
      const total = Number(data?.total_unread || 0);
      setUnread(Number.isFinite(total) && total > 0 ? total : 0);
    } catch {
      /* deploy / no mailbox — keep last or zero quietly */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshUnread();
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshUnread]);

  return (
    <button
      type="button"
      className={`admin-hdr-icon admin-hdr-icon--mail${active ? ' is-open' : ''}`}
      aria-label={
        unread > 0
          ? `${t('email') || 'Email'}, ${unread} αδιάβαστα`
          : t('email') || 'Email'
      }
      title={t('email') || 'Email'}
      onClick={() => onOpenMailbox?.()}
    >
      <span className="material-symbols-outlined" aria-hidden>
        mail
      </span>
      {unread > 0 ? <span className="admin-hdr-dot" aria-hidden /> : null}
    </button>
  );
}
