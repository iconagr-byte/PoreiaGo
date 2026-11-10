/**
 * @vitest-environment node
 *
 * Wallet design preview must use ?preview=1 so the iframe shows Αρχική, not login.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('wallet design preview wiring', () => {
  it('page-design wallet page points iframe at /wallet?preview=1', () => {
    const panel = read('src/components/admin/HomepageSettingsPanel.jsx');
    expect(panel).toContain("previewSrc: '/wallet?preview=1'");
    expect(panel).toContain("previewPathLabel: '/wallet?preview=1'");

    const shell = read('src/components/admin/homepage/PageDesignWizardShell.jsx');
    expect(shell).toContain("'/wallet?preview=1'");

    const live = read('src/components/admin/homepage/PageDesignLivePreview.jsx');
    expect(live).toContain("'/wallet?preview=1'");
  });

  it('SimpleWalletPage serves WalletDesignPreview when preview=1', () => {
    const page = read('src/pages/SimpleWalletPage.jsx');
    expect(page).toContain("import WalletDesignPreview from '../components/wallet/WalletDesignPreview.jsx'");
    expect(page).toContain("get('preview') === '1'");
    expect(page).toContain('return <WalletDesignPreview />');
  });

  it('WalletHomeCopyEditor pushes homepage preview drafts', () => {
    const editor = read('src/components/admin/WalletHomeCopyEditor.jsx');
    expect(editor).toContain('pushHomepagePreviewDraft');
  });
});
