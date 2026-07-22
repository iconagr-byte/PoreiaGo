"""Tests for driver ↔ office chat store (delivery + read receipts)."""

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

    def test_imessage_delivery_and_read_receipts(self):
        sent = store.append_message(
            tenant_id="t1",
            driver_id="d1",
            sender="driver",
            body="SOS μικρό",
        )
        self.assertEqual(sent["receipt_driver"], "sent")
        self.assertEqual(sent["receipt"], "sent")
        self.assertIsNone(sent.get("delivered_to_office_at"))

        # Office opens thread → delivered
        office_view = store.list_messages(
            tenant_id="t1",
            driver_id="d1",
            viewer="office",
        )
        self.assertEqual(office_view[0]["delivered_to_office_at"] is not None, True)
        # Driver polls again → sees Παραδόθηκε
        driver_view = store.list_messages(
            tenant_id="t1",
            driver_id="d1",
            viewer="driver",
        )
        self.assertEqual(driver_view[0]["receipt"], "delivered")

        store.mark_thread_read(tenant_id="t1", driver_id="d1", reader="office")
        driver_view = store.list_messages(
            tenant_id="t1",
            driver_id="d1",
            viewer="driver",
        )
        self.assertEqual(driver_view[0]["receipt"], "read")

        # Office → driver direction
        office_msg = store.append_message(
            tenant_id="t1",
            driver_id="d1",
            sender="office",
            body="Είσαι ΟΚ;",
        )
        self.assertEqual(office_msg["receipt_office"], "sent")
        store.list_messages(tenant_id="t1", driver_id="d1", viewer="driver")
        office_view = store.list_messages(tenant_id="t1", driver_id="d1", viewer="office")
        last = office_view[-1]
        self.assertEqual(last["receipt"], "delivered")
        store.mark_thread_read(tenant_id="t1", driver_id="d1", reader="driver")
        office_view = store.list_messages(tenant_id="t1", driver_id="d1", viewer="office")
        self.assertEqual(office_view[-1]["receipt"], "read")


if __name__ == "__main__":
    unittest.main()
