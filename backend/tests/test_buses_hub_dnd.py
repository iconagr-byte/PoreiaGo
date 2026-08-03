"""Buses hub menu supports drag-and-drop reorder with persisted order."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class BusesHubDndContractTests(unittest.TestCase):
    def test_order_helpers_exist(self) -> None:
        hub = (ROOT / "src" / "lib" / "admin" / "busesHub.js").read_text(encoding="utf-8")
        self.assertIn("BUSES_HUB_ORDER_KEY", hub)
        self.assertIn("loadBusesHubOrder", hub)
        self.assertIn("saveBusesHubOrder", hub)
        self.assertIn("moveBusesHubTab", hub)

    def test_buses_hub_has_drag_handles(self) -> None:
        ui = (ROOT / "src" / "components" / "admin" / "BusesHub.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("drag_indicator", ui)
        self.assertIn("draggable", ui)
        self.assertIn("onDragStart", ui)
        self.assertIn("moveBusesHubTab", ui)
        self.assertIn("Σύρετε", ui)


if __name__ == "__main__":
    unittest.main()
