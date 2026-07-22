"""Tests for driver ↔ office chat store."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from travel_platform.driver import chat_store as store


class DriverChatStoreTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        store.reset_chat_store_for_tests(Path(self._tmpdir.name) / "chat.json")

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_append_list_and_unread(self):
        store.append_message(
            tenant_id="t1",
            driver_id="d1",
            sender="driver",
            body="Γεια από το λεωφορείο",
            trip_id=9,
            sender_name="Νίκος",
        )
        store.append_message(
            tenant_id="t1",
            driver_id="d1",
            sender="office",
            body="Λάβαμε το μήνυμα",
            sender_name="Γραφείο",
        )
        msgs = store.list_messages(tenant_id="t1", driver_id="d1")
        self.assertEqual(len(msgs), 2)
        counts = store.unread_counts(tenant_id="t1", driver_id="d1")
        self.assertEqual(counts["office"], 1)
        self.assertEqual(counts["driver"], 1)

        store.mark_thread_read(tenant_id="t1", driver_id="d1", reader="office")
        counts = store.unread_counts(tenant_id="t1", driver_id="d1")
        self.assertEqual(counts["office"], 0)
        self.assertEqual(counts["driver"], 1)

        threads = store.list_threads(tenant_id="t1")
        self.assertEqual(len(threads), 1)
        self.assertEqual(threads[0]["last_sender"], "office")


if __name__ == "__main__":
    unittest.main()
