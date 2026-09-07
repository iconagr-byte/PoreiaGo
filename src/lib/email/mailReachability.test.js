import { describe, expect, it } from 'vitest';
import {
  APP_MAIL_EGRESS_IP,
  hostingWhitelistRequest,
  isMailRemoteAuthRejectMessage,
  isMailRemoteAuthPair,
  mailRemoteAuthGuide,
  mailTimeoutGuide,
  mailTimeoutHintEl,
} from './mailReachability.js';

describe('mailReachability', () => {
  it('uses Contabo egress IP', () => {
    expect(APP_MAIL_EGRESS_IP).toBe('169.58.199.186');
    expect(hostingWhitelistRequest({})).toContain('169.58.199.186');
    expect(hostingWhitelistRequest({})).not.toContain('34.141.98.145');
  });

  it('builds structured timeout guide with copyable request', () => {
    const g = mailTimeoutGuide({
      mailHost: 'mail.achilliotravel.com',
      imapPort: 993,
      smtpPort: 465,
    });
    expect(g.title).toBeTruthy();
    expect(g.request).toContain('169.58.199.186');
    expect(g.request).toContain('mail.achilliotravel.com');
    expect(g.facts.map((f) => f.id)).toEqual(['ip', 'host', 'imap', 'smtp']);
    expect(g.steps).toHaveLength(3);
    expect(mailTimeoutHintEl({ mailHost: 'mail.achilliotravel.com' })).toContain(g.request);
  });

  it('detects Exim 535 remote-auth reject and builds whitelist guide', () => {
    expect(
      isMailRemoteAuthRejectMessage("SMTP σύνδεση: (535, b'Incorrect authentication data')"),
    ).toBe(true);
    expect(
      isMailRemoteAuthPair(
        'IMAP σύνδεση: λάθος username ή κωδικός mailbox.',
        'SMTP σύνδεση: Incorrect authentication data (535). Αν το webmail…',
      ),
    ).toBe(true);
    const g = mailRemoteAuthGuide({
      mailHost: 'mail.achilliotravel.com',
      imapPort: 993,
      smtpPort: 465,
    });
    expect(g.title).toMatch(/webmail/i);
    expect(g.request).toContain('169.58.199.186');
  });
});
