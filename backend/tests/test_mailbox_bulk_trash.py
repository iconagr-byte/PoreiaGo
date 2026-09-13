"""Bulk trash mailbox messages."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from email_client.schemas import BulkTrashBody


class BulkTrashSchemaTests(unittest.TestCase):
    def test_requires_at_least_one_id(self):
        with self.assertRaises(Exception):
            BulkTrashBody(ids=[])

    def test_accepts_ids(self):
        body = BulkTrashBody(ids=["a", "b"])
        self.assertEqual(body.ids, ["a", "b"])


class BulkTrashRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_bulk_trash_counts_moved(self):
        from api.email_mailbox_router import bulk_trash_mailbox_messages

        async def fake_move(mid: str):
            if mid == "missing":
                return None
            return {"id": mid, "folder": "Trash"}

        with patch("api.email_mailbox_router.move_to_trash", new=AsyncMock(side_effect=fake_move)):
            result = await bulk_trash_mailbox_messages(
                BulkTrashBody(ids=["1", "missing", "2"])
            )
        self.assertTrue(result["ok"])
        self.assertEqual(result["moved"], 2)
        self.assertEqual(result["missing"], ["missing"])


if __name__ == "__main__":
    unittest.main()
