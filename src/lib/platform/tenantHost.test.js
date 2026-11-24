/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { platformOfficeSubdomain } from './tenantHost.js';

describe('platformOfficeSubdomain', () => {
  it('extracts single-label office subdomains', () => {
    expect(platformOfficeSubdomain('iconarent.poreiago.com')).toBe('iconarent');
    expect(
      platformOfficeSubdomain(
        'dodopoulos-christos-charalampidis-achilleas-o-e.poreiago.com',
      ),
    ).toBe('dodopoulos-christos-charalampidis-achilleas-o-e');
  });

  it('rejects marketing and multi-label hosts', () => {
    expect(platformOfficeSubdomain('www.poreiago.com')).toBe('');
    expect(platformOfficeSubdomain('api.poreiago.com')).toBe('');
    expect(platformOfficeSubdomain('achilliotravel.com')).toBe('');
  });
});
