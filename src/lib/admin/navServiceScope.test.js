import { describe, expect, it } from 'vitest';
import {
  isSharedNavItem,
  navItemServiceScope,
  navItemVisibleInServiceMode,
  normalizeNavServiceMode,
  suggestTabForServiceMode,
} from './navServiceScope.js';

describe('navServiceScope', () => {
  it('classifies shared vs buses vs rent', () => {
    expect(navItemServiceScope('dashboard')).toBe('shared');
    expect(navItemServiceScope('customers')).toBe('shared');
    expect(navItemServiceScope('routes')).toBe('buses');
    expect(navItemServiceScope('fleet')).toBe('buses');
    expect(navItemServiceScope('fleet_rental_vehicles')).toBe('rent');
    expect(isSharedNavItem('email')).toBe(true);
  });

  it('filters by service mode', () => {
    expect(navItemVisibleInServiceMode('dashboard', 'rent')).toBe(true);
    expect(navItemVisibleInServiceMode('routes', 'rent')).toBe(false);
    expect(navItemVisibleInServiceMode('routes', 'buses')).toBe(true);
    expect(navItemVisibleInServiceMode('fleet_rental', 'buses')).toBe(false);
    expect(navItemVisibleInServiceMode('routes', 'all')).toBe(true);
  });

  it('suggests landing tab when mode hides current view', () => {
    expect(suggestTabForServiceMode('routes', 'rent', { rentEnabled: true })).toBe('fleet_rental');
    expect(suggestTabForServiceMode('fleet_rental', 'buses')).toBe('dashboard');
    expect(suggestTabForServiceMode('dashboard', 'rent')).toBeNull();
    expect(normalizeNavServiceMode('nope')).toBe('all');
  });
});
