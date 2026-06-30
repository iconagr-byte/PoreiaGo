import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { loadAllCustomers } from '../../../lib/customers/customerStore.js';
import {
  appendToField,
  filterContacts,
  mergeRecipientContacts,
  parseToEmails,
  replaceLastToSegment,
} from '../../../lib/email/recipients.js';
import { fetchSubscribers } from '../../../services/emailClientApi.js';

export default function ComposeRecipients({ value, onChange }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [toQuery, setToQuery] = useState('');

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const local = loadAllCustomers().filter((c) => (c.email || '').includes('@'));
    try {
      const subs = await fetchSubscribers(false);
      setContacts(mergeRecipientContacts(local, subs));
    } catch {
      setContacts(mergeRecipientContacts(local, []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const pickerList = useMemo(() => filterContacts(contacts, search), [contacts, search]);

  const suggestionList = useMemo(() => {
    const q = toQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return filterContacts(contacts, q).slice(0, 8);
  }, [contacts, toQuery]);

  const selectedCount = parseToEmails(value).length;

  const addEmail = (email, { replaceLast = false } = {}) => {
    onChange(replaceLast ? replaceLastToSegment(value, email) : appendToField(value, email));
    setSuggestOpen(false);
    setToQuery('');
  };

  const addAll = () => {
    onChange(appendToField(value, contacts.map((c) => c.email)));
  };

  const onToChange = (e) => {
    const v = e.target.value;
    onChange(v);
    const parts = v.split(/[,;]/);
    setToQuery((parts[parts.length - 1] || '').trim());
    setSuggestOpen(true);
  };

  return (
    <div className="emc-recipients">
      <div className="emc-recipients-input-wrap">
        <input
          className="emc-field mb-0"
          placeholder="Προς * (επιλέξτε πελάτη ή email με κόμμα)"
          value={value}
          onChange={onToChange}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => window.setTimeout(() => setSuggestOpen(false), 180)}
          autoComplete="off"
        />
        {suggestOpen && suggestionList.length > 0 && (
          <ul className="emc-recipient-suggestions" role="listbox">
            {suggestionList.map((c) => (
              <li key={c.email}>
                <button
                  type="button"
                  role="option"
                  className="emc-recipient-suggestion-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addEmail(c.email, { replaceLast: true })}
                >
                  <span className="emc-recipient-suggestion-name">{c.name || c.email}</span>
                  <span className="emc-recipient-suggestion-email">{c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="emc-recipient-picker">
        <div className="emc-recipient-picker-head">
          <span className="emc-recipient-picker-title">
            <Users size={14} aria-hidden />
            Πελάτες
            {loading ? ' …' : ` (${contacts.length})`}
          </span>
          <div className="emc-recipient-picker-actions">
            <button type="button" className="emc-recipient-chip-btn" onClick={addAll} disabled={!contacts.length}>
              Όλοι
            </button>
            <button
              type="button"
              className="emc-recipient-chip-btn"
              onClick={() => onChange('')}
              disabled={!value.trim()}
            >
              Καθαρισμός
            </button>
          </div>
        </div>
        {selectedCount > 0 && (
          <p className="emc-recipient-selected-hint">
            {selectedCount} {selectedCount === 1 ? 'παραλήπτης' : 'παραλήπτες'} στο πεδίο Προς
          </p>
        )}
        <input
          className="emc-recipient-search"
          placeholder="Αναζήτηση ονόματος ή email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="emc-recipient-list">
          {pickerList.length === 0 && !loading && (
            <li className="emc-recipient-empty">Δεν βρέθηκαν πελάτες με email.</li>
          )}
          {pickerList.map((c) => {
            const picked = parseToEmails(value).includes(c.email);
            return (
              <li key={c.email}>
                <button
                  type="button"
                  className={`emc-recipient-row ${picked ? 'emc-recipient-row-picked' : ''}`}
                  onClick={() => addEmail(c.email)}
                  title={picked ? 'Ήδη στο Προς' : 'Προσθήκη email'}
                >
                  <span className="emc-recipient-row-name">{c.name || '—'}</span>
                  <span className="emc-recipient-row-email">{c.email}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
