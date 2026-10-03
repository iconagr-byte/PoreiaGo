"""Contract: «Τέλος βάρδιας» must end the shift on the first tap."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DriverEndShiftButtonTests(unittest.TestCase):
    def test_gps_primary_calls_go_offline_without_two_tap(self) -> None:
        """Regression: two-tap + 4s auto-reset made the button look like a no-op."""
        ui = (ROOT / "src" / "components" / "driver" / "DriverShiftTelemetry.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("ΤΕΛΟΣ ΒΑΡΔΙΑΣ", ui)
        self.assertIn("void goOffline()", ui)
        self.assertNotIn("confirmEnd", ui)
        self.assertNotIn("ΕΠΙΒΕΒΑΙΩΣΗ ΤΕΛΟΥΣ", ui)
        self.assertNotIn("setConfirmEnd", ui)
        # First tap while online must end — not arm a second press.
        on_primary = ui.split("const onPrimary = () => {", 1)[1].split("};", 1)[0]
        self.assertIn("void goOffline()", on_primary)
        self.assertNotIn("setConfirmEnd(true)", on_primary)

    def test_end_shift_api_wire(self) -> None:
        api = (ROOT / "src" / "services" / "driverPortalApi.js").read_text(encoding="utf-8")
        session = (ROOT / "src" / "lib" / "driver" / "useDriverShiftSession.js").read_text(
            encoding="utf-8"
        )
        backend = (ROOT / "backend" / "api" / "driver_portal.py").read_text(encoding="utf-8")

        self.assertIn("/api/driver/telemetry/shift/end", api)
        self.assertIn("export async function endDriverShift", api)
        self.assertIn("endDriverShift()", session)
        self.assertIn('setEnding(true)', session)
        self.assertIn("@router.post(\"/telemetry/shift/end\")", backend)
        self.assertIn("async def driver_shift_end", backend)

    def test_ending_blocks_gps_resume(self) -> None:
        session = (ROOT / "src" / "lib" / "driver" / "useDriverShiftSession.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("if (endingRef.current) return;", session)
        self.assertIn("Never resurrect GPS while Τέλος βάρδιας is in flight", session)


if __name__ == "__main__":
    unittest.main()
