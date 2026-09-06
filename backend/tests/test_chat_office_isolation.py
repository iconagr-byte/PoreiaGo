"""Chat threads/messages must never bleed across offices."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.driver import chat_store as chat
from travel_platform.settings import drivers_store as drivers
from travel_platform.settings.drivers_store import DEMO_TENANT_ID

OFFICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OFFICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class ChatOfficeIsolationTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        root = Path(self._tmpdir.name)
        chat.reset_chat_store_for_tests(root / "chat.json")
        drivers.STORE_PATH = root / "fleet_drivers.json"
        drivers._DATA_DIR = root
        drivers.STORE_PATH.write_text('{"drivers": []}', encoding="utf-8")
        drivers.reset_drivers_cache()

        self.driver_a = drivers.create_driver(
            {
                "id": str(uuid4()),
                "name": "Οδηγός A",
                "license_no": f"LICA{uuid4().hex[:6]}",
                "email": f"a.{uuid4().hex[:6]}@example.com",
                "password": "driver123",
                "status": "active",
                "tenant_id": OFFICE_A,
            }
        )
        self.driver_b = drivers.create_driver(
            {
                "id": str(uuid4()),
                "name": "Οδηγός B",
                "license_no": f"LICB{uuid4().hex[:6]}",
                "email": f"b.{uuid4().hex[:6]}@example.com",
                "password": "driver123",
                "status": "active",
                "tenant_id": OFFICE_B,
            }
        )

    def tearDown(self):
        drivers.reset_drivers_cache()
        self._tmpdir.cleanup()

    def test_threads_filtered_by_tenant_and_allowed_ids(self):
        chat.append_message(
            tenant_id=OFFICE_A,
            driver_id=self.driver_a.id,
            sender="driver",
            body="Από A",
        )
        chat.append_message(
            tenant_id=OFFICE_B,
            driver_id=self.driver_b.id,
            sender="driver",
            body="Από B",
        )

        a_threads = chat.list_threads(tenant_id=OFFICE_A)
        self.assertEqual([t["driver_id"] for t in a_threads], [self.driver_a.id])

        b_threads = chat.list_threads(tenant_id=OFFICE_B)
        self.assertEqual([t["driver_id"] for t in b_threads], [self.driver_b.id])

        # Even if somehow B's id were listed under A tenant, allow-list blocks it.
        leaked = chat.list_threads(
            tenant_id=OFFICE_A,
            allowed_driver_ids={self.driver_a.id},
        )
        self.assertEqual(len(leaked), 1)
        self.assertEqual(leaked[0]["driver_id"], self.driver_a.id)

        empty = chat.list_threads(
            tenant_id=OFFICE_A,
            allowed_driver_ids={self.driver_b.id},
        )
        self.assertEqual(empty, [])

    def test_reassign_demo_chat_onto_office(self):
        orphan_id = str(uuid4())
        chat.append_message(
            tenant_id=DEMO_TENANT_ID,
            driver_id=orphan_id,
            sender="driver",
            body="Παλιό μήνυμα DEMO",
        )
        moved = chat.reassign_messages_tenant(
            driver_ids={orphan_id},
            to_tenant=OFFICE_A,
            from_tenant=DEMO_TENANT_ID,
        )
        self.assertEqual(moved, 1)
        self.assertEqual(chat.list_threads(tenant_id=DEMO_TENANT_ID), [])
        threads = chat.list_threads(tenant_id=OFFICE_A)
        self.assertEqual(len(threads), 1)
        self.assertEqual(threads[0]["driver_id"], orphan_id)
        self.assertEqual(threads[0]["last_message"], "Παλιό μήνυμα DEMO")

    def test_messages_never_cross_tenant(self):
        chat.append_message(
            tenant_id=OFFICE_A,
            driver_id=self.driver_a.id,
            sender="driver",
            body="secret-a",
        )
        self.assertEqual(
            chat.list_messages(tenant_id=OFFICE_B, driver_id=self.driver_a.id),
            [],
        )
        self.assertEqual(
            chat.unread_counts(tenant_id=OFFICE_B, driver_id=self.driver_a.id)["office"],
            0,
        )


if __name__ == "__main__":
    unittest.main()
