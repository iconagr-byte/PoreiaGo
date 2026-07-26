"""Contract: driver login must not auto-start GPS / tachograph."""

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


if __name__ == "__main__":
    unittest.main()
