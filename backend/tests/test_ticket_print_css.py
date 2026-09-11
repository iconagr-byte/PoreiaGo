"""Ticket print CSS must unlock wallet-app overflow for Chrome print preview."""

from __future__ import annotations

from pathlib import Path
import unittest

CSS = Path(__file__).resolve().parents[2] / "src" / "styles" / "ticket-print.css"


class TicketPrintCssTests(unittest.TestCase):
    def test_print_unlocks_wallet_overflow(self):
        text = CSS.read_text(encoding="utf-8")
        self.assertIn("@media print", text)
        self.assertIn("overflow: visible !important", text)
        self.assertIn("height: auto !important", text)
        self.assertIn(".wallet-app.ticket-print-shell", text)
        self.assertIn("visibility: visible !important", text)

    def test_screen_shell_not_clipped(self):
        text = CSS.read_text(encoding="utf-8")
        # Screen override lives before the real @media print { block
        screen = text.split("@media print {")[0]
        self.assertIn(".wallet-app.ticket-print-shell", screen)
        self.assertIn("overflow: visible", screen)
        self.assertIn("height: auto", screen)


if __name__ == "__main__":
    unittest.main()
