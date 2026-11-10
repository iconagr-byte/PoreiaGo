/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStore = new Map();
const listeners = new Map();

function installDom() {
  vi.stubGlobal('localStorage', {
    getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
    setItem: (k, v) => localStore.set(String(k), String(v)),
    removeItem: (k) => localStore.delete(k),
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (type, fn) => {
      const list = listeners.get(`doc:${type}`) || [];
      list.push(fn);
      listeners.set(`doc:${type}`, list);
    },
    removeEventListener: (type, fn) => {
      const list = (listeners.get(`doc:${type}`) || []).filter((x) => x !== fn);
      listeners.set(`doc:${type}`, list);
    },
  });
  vi.stubGlobal('window', {
    addEventListener: (type, fn) => {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener: (type, fn) => {
      const list = (listeners.get(type) || []).filter((x) => x !== fn);
      listeners.set(type, list);
    },
    dispatchEvent: (ev) => {
      for (const fn of listeners.get(ev.type) || []) fn(ev);
      return true;
    },
  });
  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  vi.stubGlobal('CustomEvent', CustomEvent);
}

describe('bookingSyncEvents', () => {
  beforeEach(() => {
    localStore.clear();
    listeners.clear();
    installDom();
  });

  it('notifies subscribers on bookings changed', async () => {
    const {
      notifyBookingsChanged,
      subscribeOfficeCatalogSync,
    } = await import('./bookingSyncEvents.js');
    const onBookings = vi.fn();
    const unsub = subscribeOfficeCatalogSync({ onBookings });
    notifyBookingsChanged({ reason: 'delete' });
    expect(onBookings).toHaveBeenCalled();
    unsub();
  });
});
