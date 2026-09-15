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
        invite = (
            ROOT / "src" / "lib" / "driver" / "applyDriverShiftInvite.js"
        ).read_text(encoding="utf-8")
        session = (
            ROOT / "src" / "lib" / "driver" / "useDriverShiftSession.js"
        ).read_text(encoding="utf-8")
        cmd = (
            ROOT / "src" / "pages" / "driver" / "DriverCommandCenter.jsx"
        ).read_text(encoding="utf-8")

        self.assertIn("clearDriverShiftLaunchState", gate)
        self.assertIn("applyDriverShiftInvite", auth)
        self.assertIn("clearDriverShiftLaunchState", invite)
        self.assertNotIn("requestDriverGpsAutostart()", gate)
        self.assertNotIn("requestDriverGpsAutostart()", auth)
        self.assertNotIn("requestDriverGpsAutostart()", invite)

        self.assertIn("clearDriverShiftLaunchState", session)
        self.assertIn("return false", session)
        self.assertIn("Έναρξη βάρδιας", session)
        # Command center also clears on successful login (stale flag safety).
        self.assertIn("clearDriverShiftLaunchState()", cmd)

    def test_nav_tabs_do_not_autostart_shift(self) -> None:
        """Αρχική / Θέση / Scan / … — shift only via explicit Έναρξη βάρδιας."""
        cmd = (
            ROOT / "src" / "pages" / "driver" / "DriverCommandCenter.jsx"
        ).read_text(encoding="utf-8")
        # Old bug: opening GPS tab called goOnline automatically.
        self.assertNotIn("if (t.id === 'gps' && !shift.online)", cmd)
        self.assertIn("Tab enter", cmd)
        self.assertIn("never starts shift", cmd)
        self.assertIn("startShiftNow", cmd)
        self.assertIn("void shift.goOnline({ resume: false })", cmd)
        # Nav click only changes tab — no goOnline in the bottom-nav handler.
        nav_idx = cmd.find("driver-nav")
        self.assertGreater(nav_idx, 0)
        nav_chunk = cmd[nav_idx : nav_idx + 2500]
        self.assertNotIn("goOnline", nav_chunk)
        self.assertIn("setTab(t.id)", nav_chunk)

    def test_driver_sw_cache_bumped_for_client_update(self) -> None:
        sw = (ROOT / "public" / "driver-sw.js").read_text(encoding="utf-8")
        self.assertIn("aerostride-driver-v9", sw)
        self.assertNotIn("aerostride-driver-v8", sw)


if __name__ == "__main__":
    unittest.main()
