"""Guardrails: driver shift must not autostart on login / GPS tab."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DriverShiftManualStartTests(unittest.TestCase):
    def test_gps_tab_does_not_call_go_online(self):
        src = (ROOT / "src/pages/driver/DriverCommandCenter.jsx").read_text(encoding="utf-8")
        self.assertNotIn("t.id === 'gps' && !shift.online", src)
        self.assertNotIn("shift.goOnline({ resume: false })", src)
        # Start remains available from the explicit button path in the hook toggle.
        hook = (ROOT / "src/lib/driver/useDriverShiftSession.js").read_text(encoding="utf-8")
        self.assertIn("void goOnline({ resume: false })", hook)

    def test_login_clears_shift_launch_state(self):
        gate = (ROOT / "src/components/driver/MasterQrGate.jsx").read_text(encoding="utf-8")
        self.assertIn("clearDriverShiftLaunchState()", gate)
        cmd = (ROOT / "src/pages/driver/DriverCommandCenter.jsx").read_text(encoding="utf-8")
        self.assertIn("clearDriverShiftLaunchState()", cmd)
        hook = (ROOT / "src/lib/driver/useDriverShiftSession.js").read_text(encoding="utf-8")
        self.assertIn("useState(false)", hook)
        self.assertIn("peekDriverGpsAutostart is always false", hook)
        self.assertIn("return false;", hook)

    def test_autostart_helper_is_noop_clear(self):
        hook = (ROOT / "src/lib/driver/useDriverShiftSession.js").read_text(encoding="utf-8")
        # requestDriverGpsAutostart must clear, never arm a start.
        start = hook.index("export function requestDriverGpsAutostart")
        chunk = hook[start : start + 200]
        self.assertIn("clearDriverShiftLaunchState()", chunk)
        self.assertNotIn("sessionStorage.setItem(AUTOSTART_GPS_KEY", chunk)


if __name__ == "__main__":
    unittest.main()
