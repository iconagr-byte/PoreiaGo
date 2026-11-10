/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStore = new Map();
const sessionStore = new Map();

function installStorage() {
  const make = (store) => ({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });
  vi.stubGlobal('localStorage', make(localStore));
  vi.stubGlobal('sessionStorage', make(sessionStore));
}

vi.mock('../capacitor/isNativeApp.js', () => ({
  shouldPersistNativeDriverSession: vi.fn(() => false),
}));

import { shouldPersistNativeDriverSession } from '../capacitor/isNativeApp.js';
import {
  clearDriverSession,
  markDriverAuthFresh,
  resolveDriverAuthOnLaunch,
  saveDriverSession,
} from './driverSession.js';

describe('resolveDriverAuthOnLaunch', () => {
  beforeEach(() => {
    localStore.clear();
    sessionStore.clear();
    installStorage();
    shouldPersistNativeDriverSession.mockReturnValue(false);
    clearDriverSession();
  });

  it('survives React StrictMode double-invoke without wiping a fresh web login', () => {
    saveDriverSession({
      accessToken: 'tok',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      tenantId: 't1',
      driverId: 'd1',
    });
    markDriverAuthFresh();

    expect(resolveDriverAuthOnLaunch()).toBe(true);
    // Second initializer call (StrictMode) must still see the fresh session.
    expect(resolveDriverAuthOnLaunch()).toBe(true);
    expect(sessionStorage.getItem('driver_command_session')).toBeTruthy();
  });

  it('opens command center on native when JWT is in localStorage', () => {
    shouldPersistNativeDriverSession.mockReturnValue(true);
    const session = {
      accessToken: 'native-tok',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      tenantId: 't1',
      driverId: 'd1',
    };
    localStorage.setItem('driver_command_session', JSON.stringify(session));
    expect(resolveDriverAuthOnLaunch()).toBe(true);
    expect(resolveDriverAuthOnLaunch()).toBe(true);
  });
});
