"""Guest booking must not await notify side-effects on the request path."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKINGS = ROOT / "backend" / "app" / "api" / "bookings.py"


class GuestBookingAsyncNotifyTests(unittest.TestCase):
    def test_guest_create_uses_create_task_not_background_tasks(self) -> None:
        src = BOOKINGS.read_text(encoding="utf-8")
        self.assertIn("_schedule_guest_booking_side_effects", src)
        self.assertIn("create_task", src)
        self.assertIn("JSONResponse", src)
        # FastAPI BackgroundTasks would keep the ASGI cycle open until SMTP ends.
        self.assertNotIn("background_tasks.add_task", src)
        self.assertNotRegex(src, r"from fastapi import[^\n]*BackgroundTasks")

        tree = ast.parse(src)
        guest_fn = None
        for node in tree.body:
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "create_guest_booking":
                guest_fn = node
                break
        self.assertIsNotNone(guest_fn)
        arg_names = [a.arg for a in guest_fn.args.args]
        self.assertNotIn("background_tasks", arg_names)


if __name__ == "__main__":
    unittest.main()
