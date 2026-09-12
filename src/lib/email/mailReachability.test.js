import { describe, expect, it } from 'vitest';
import {
  APP_MAIL_EGRESS_IP,
  ACHILLIO_CPANEL_MAIL_HOST,
  hostingWhitelistRequest,
  isMailRemoteAuthRejectMessage,
  isMailRemoteAuthPair,
  mailRemoteAuthGuide,
  mailTimeoutGuide,
  mailTimeoutHintEl,
  mailWrongHostGuide,
  resolveWrongMailHost,
} from './mailReachability.js';

describe('mailReachability', () => {
  it('uses Contabo egress IP', () => {
    expect(APP_MAIL_EGRESS_IP).toBe('169.58.199.186');
    expect(hostingWhitelistRequest({})).toContain('169.58.199.186');
    // Mentions old GCP IP only as explicit "do NOT whitelist this" warning.
    expect(hostingWhitelistRequest({})).toContain('34.141.98.145');
    expect(hostingWhitelistRequest({})).toMatch(/ΟΧΙ το παλιό GCP/);
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
    expect(g.request).toContain('34.141.98.145');
    expect(g.summary).toContain('34.141.98.145');
  });

  it('detects Achillio wrong mail host (DNS → srv24) and suggests srv23', () => {
    const hint = resolveWrongMailHost('mail.achilliotravel.com');
    expect(hint?.suggestedHost).toBe(ACHILLIO_CPANEL_MAIL_HOST);
    const g = mailWrongHostGuide({
      mailHost: 'mail.achilliotravel.com',
      suggestedHost: ACHILLIO_CPANEL_MAIL_HOST,
    });
    expect(g.title).toMatch(/DNS|host/i);
    expect(g.request).toContain('srv23.intechs.gr');
    expect(g.request).toContain('mail.achilliotravel.com');
    expect(g.facts.map((f) => f.id)).toEqual(['bad', 'good', 'imap', 'smtp']);
  });
});
