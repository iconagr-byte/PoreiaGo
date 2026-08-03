"""Contract: driver login / tab navigation must not auto-start GPS / tachograph."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DriverNoShiftAutostartTests(unittest.TestCase):
    def test_login_clears_shift_instead_of_autostart(self) -> None:
        gate = (ROOT / "src" / "components" / "driver" / "MasterQrGate.jsx").read_text(
            encoding="utf-8"
        )
        auth = (ROOT / "src" / "pages" / "driver" / "DriverAuthPage.jsx").read_text(
            encoding="utf-8"
        )
        session = (
            ROOT / "src" / "lib" / "driver" / "useDriverShiftSession.js"
        ).read_text(encoding="utf-8")

        self.assertIn("clearDriverShiftLaunchState", gate)
        self.assertIn("clearDriverShiftLaunchState", auth)
        self.assertNotIn("requestDriverGpsAutostart()", gate)
        self.assertNotIn("requestDriverGpsAutostart()", auth)

        self.assertIn("clearDriverShiftLaunchState", session)
        self.assertIn("return false", session)
        self.assertIn("Έναρξη βάρδιας", session)

    def test_nav_tabs_do_not_autostart_shift(self) -> None:
        """Αρχική / Θέση / Scan / … — shift only via explicit Έναρξη βάρδιας."""
        cmd = (
            ROOT / "src" / "pages" / "driver" / "DriverCommandCenter.jsx"
        ).read_text(encoding="utf-8")
        # Old bug: opening GPS tab called goOnline automatically.
        self.assertNotIn("if (t.id === 'gps' && !shift.online)", cmd)
        self.assertIn("Never auto-start shift on tab enter", cmd)
        self.assertIn("startShiftNow", cmd)
        self.assertIn("void shift.goOnline({ resume: false })", cmd)


if __name__ == "__main__":
    unittest.main()
