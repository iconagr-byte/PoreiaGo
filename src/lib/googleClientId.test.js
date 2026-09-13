import { describe, expect, it } from 'vitest';
import { isUsableGoogleClientId } from './googleClientId.js';

describe('isUsableGoogleClientId', () => {
  it('rejects empty and non-google ids', () => {
    expect(isUsableGoogleClientId('')).toBe(false);
    expect(isUsableGoogleClientId(null)).toBe(false);
    expect(isUsableGoogleClientId('not-a-client-id')).toBe(false);
  });

  it('rejects docs placeholders', () => {
    expect(isUsableGoogleClientId('123456789-xxxx.apps.googleusercontent.com')).toBe(false);
    expect(isUsableGoogleClientId('your-client-id.apps.googleusercontent.com')).toBe(false);
    expect(isUsableGoogleClientId('example.apps.googleusercontent.com')).toBe(false);
  });

  it('accepts real-looking client ids', () => {
    expect(isUsableGoogleClientId('123-abc.apps.googleusercontent.com')).toBe(true);
    expect(
      isUsableGoogleClientId(
        '987654321-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
      ),
    ).toBe(true);
  });
});
