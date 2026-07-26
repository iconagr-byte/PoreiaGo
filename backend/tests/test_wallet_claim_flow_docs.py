"""Document phase-A wallet claim contract (frontend session helper).

The real claim store lives in the SPA (sessionStorage). This test locks the
intended product contract so phase B (magic link) can extend it later.
"""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CLAIM_JS = ROOT / "src" / "lib" / "wallet" / "walletClaim.js"


class WalletClaimFlowContractTests(unittest.TestCase):
    def test_claim_helper_exists_with_phase_markers(self):
        text = CLAIM_JS.read_text(encoding="utf-8")
        lowered = text.lower()
        self.assertIn("phase a", lowered)
        self.assertIn("phase b", lowered)
        self.assertIn("magic link", lowered)
        self.assertIn("saveWalletClaim", text)
        self.assertIn("walletClaimNavState", text)
        self.assertIn("setWalletFocusBooking", text)
        self.assertIn("walletHomeNavState", text)
        self.assertIn("wallet_focus_booking_v1", text)


if __name__ == "__main__":
    unittest.main()
