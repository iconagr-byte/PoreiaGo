"""Unit tests for scoped backup metadata (no live Postgres required)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.settings import backup_service as bs


class BackupServiceMetaTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self._tmpdir.name)
        self._patcher = patch.object(bs, "BACKUP_DIR", self.root)
        self._patcher.start()

    def tearDown(self):
        self._patcher.stop()
        self._tmpdir.cleanup()

    def test_platform_backup_lists_with_scope(self):
        with (
            patch.object(bs, "get_platform_config", return_value=type("C", (), {"__dict__": {"a": 1}})()),
            patch.object(bs, "get_telemetry_settings", return_value=type("T", (), {"__dict__": {"b": 2}})()),
            patch.object(bs, "users_for_export", return_value=[]),
            patch.object(bs, "drivers_for_export", return_value=[]),
        ):
            meta = bs.create_platform_backup()
        self.assertEqual(meta["scope"], "platform")
        self.assertTrue(meta["filename"].endswith(".json"))
        listed = bs.list_backups()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["scope"], "platform")
        self.assertTrue(listed[0]["restorable"])

    def test_database_meta_listed_as_download_only(self):
        dump = self.root / "database-test-1.sql.gz"
        dump.write_bytes(b"gzipfake")
        meta_path = self.root / "database-test-1.meta.json"
        meta_path.write_text(
            json.dumps(
                {
                    "scope": "database",
                    "created_at": "2026-09-21T10:00:00+00:00",
                    "includes": ["postgres_dump"],
                }
            ),
            encoding="utf-8",
        )
        listed = bs.list_backups()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["scope"], "database")
        self.assertFalse(listed[0]["restorable"])
        self.assertEqual(listed[0]["kind"], "database")

    def test_resolve_rejects_path_traversal(self):
        with self.assertRaises(FileNotFoundError):
            bs.resolve_backup_path("../etc/passwd")

    def test_office_includes_constant(self):
        for key in (
            "tenant",
            "appearance",
            "admin_ui",
            "customers",
            "drivers",
            "trip_catalog",
            "payment_settings",
            "seat_pricing",
            "bookings",
        ):
            self.assertIn(key, bs.OFFICE_INCLUDES)


if __name__ == "__main__":
    unittest.main()
