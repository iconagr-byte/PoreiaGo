import { useEffect, useState, useRef } from 'react';
import { API_BASE } from '../config/api.js';
import { isBookingPaid } from '../lib/ticketing/bookingStore.js';
import { bookingIdAliases, localIdFromReference } from '../lib/ticketing/bookingIds.js';
import { issueSignedQrToken } from '../lib/ticketing/qrToken.js';

/**
 * Candidate booking ids for /api/tickets/{id}/qr — primary first, then aliases.
 * Avoids Promise.all fan-out that 404-spams the console for unused aliases.
 */
export function qrLookupIds(booking) {
  if (!booking?.id) return [];
  const ids = bookingIdAliases(booking.id);
  if (booking.pnr) {
    const fromPnr = localIdFromReference(booking.pnr);
    if (fromPnr && !ids.includes(fromPnr)) ids.unshift(fromPnr);
    if (!ids.includes(booking.pnr)) ids.push(booking.pnr);
  }
  // Prefer local B-… / raw id before BK- / B-BK- invents.
  const score = (id) => {
    const u = String(id || '').toUpperCase();
    if (u === String(booking.id || '').toUpperCase()) return 0;
    if (u.startsWith('B-') && !u.startsWith('B-BK-')) return 1;
    if (u.startsWith('BK-')) return 2;
    return 3;
  };
  return [...ids].sort((a, b) => score(a) - score(b));
}

/**
 * Polls FastAPI for a new rotating JWT every ~25s (30s TOTP window).
 * QR contains only opaque ref — no PII.
 *
 * Console-safe: tries one id at a time, remembers the working id, and stops
 * hammering /api/tickets/…/qr after a full miss (local signed token fallback).
 */
export function useRotatingTicketQr(booking) {
  const [qrValue, setQrValue] = useState('');
  const [expiresIn, setExpiresIn] = useState(30);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const workingIdRef = useRef(null);
  const skipApiRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    workingIdRef.current = null;
    skipApiRef.current = false;

    function clearCountdown() {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }

    function startCountdown(seconds) {
      clearCountdown();
      const total = Math.max(1, Number(seconds) || 30);
      if (!cancelled) setExpiresIn(total);
      const started = Date.now();
      countdownRef.current = setInterval(() => {
        if (cancelled) return;
        const left = Math.max(0, total - Math.floor((Date.now() - started) / 1000));
        setExpiresIn(left);
      }, 1000);
    }

    async function issueLocal() {
      const token = await issueSignedQrToken(
        {
          ...booking,
          id: localIdFromReference(booking.pnr || booking.id) || booking.id,
        },
        { seat: booking.seat || '' },
      );
      if (!cancelled) {
        setQrValue(token);
        startCountdown(30);
        setError(null);
      }
    }

    async function fetchQrFromApi(ids, qs) {
      const preferred = workingIdRef.current;
      const ordered = preferred
        ? [preferred, ...ids.filter((id) => id !== preferred)]
        : ids;

      let lastDetail = 'QR fetch failed';
      for (const id of ordered) {
        let res;
        try {
          res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(id)}/qr${qs}`);
        } catch {
          continue;
        }
        if (res.ok) {
          workingIdRef.current = id;
          return await res.json();
        }
        const err = await res.json().catch(() => ({}));
        lastDetail = err.detail || lastDetail;
        // Wrong alias / unknown booking — try next without re-throwing.
        if (res.status === 404 || res.status === 400) continue;
        // Paid/cancel mismatches are authoritative for this id set.
        if (res.status === 402 || res.status === 410) {
          throw new Error(lastDetail);
        }
      }
      throw new Error(lastDetail);
    }

    async function fetchQr() {
      if (!booking?.id) {
        setQrValue('');
        return;
      }
      if (!isBookingPaid(booking)) {
        setQrValue('');
        setError('unpaid');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        if (skipApiRef.current) {
          await issueLocal();
          return;
        }

        const ids = qrLookupIds(booking);
        const seatParam = encodeURIComponent(String(booking.seat || '').trim());
        const qs = seatParam ? `?seat=${seatParam}` : '';
        const data = await fetchQrFromApi(ids, qs);
        if (!cancelled) {
          setQrValue(data.token);
          startCountdown(data.expires_in ?? 30);
        }
      } catch {
        // Server does not know this booking (or aliases) — fall back once and
        // stop polling the API so DevTools is not flooded with 404s.
        skipApiRef.current = true;
        try {
          await issueLocal();
        } catch (e) {
          if (!cancelled) setError(e.message || 'QR fetch failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQr();
    timerRef.current = setInterval(fetchQr, 25000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      clearCountdown();
    };
  }, [booking?.id, booking?.seat, booking?.paymentStatus, booking?.pnr]);

  return { qrValue, expiresIn, loading, error };
}
