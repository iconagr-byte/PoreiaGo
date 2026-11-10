"""Unit tests for customer account email rename."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class ChangeAccountEmailTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "wallet.sqlite"
        self._env = patch.dict(
            "os.environ",
            {"TICKETING_DB_PATH": str(db_path), "POREIAGO_DATA_DIR": self._tmpdir.name},
            clear=False,
        )
        self._env.start()
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        ticketing_config.settings.sqlite_path = str(db_path)
        await ticketing_db.close_ticketing_db()
        await ticketing_db.init_ticketing_db()

    async def asyncTearDown(self):
        from ticketing import db as ticketing_db

        await ticketing_db.close_ticketing_db()
        self._env.stop()
        self._tmpdir.cleanup()

    async def test_change_email_moves_account(self):
        from ticketing.customer_accounts import (
            change_account_email,
            get_account,
            register_account,
        )

        await register_account("old.wallet@example.com", "secret12", "Test User")
        with self.assertRaises(ValueError):
            await change_account_email(
                "old.wallet@example.com", "new.wallet@example.com", "wrong"
            )

        updated = await change_account_email(
            "old.wallet@example.com", "new.wallet@example.com", "secret12"
        )
        self.assertEqual(updated["email"], "new.wallet@example.com")
        self.assertIsNone(await get_account("old.wallet@example.com"))
        self.assertIsNotNone(await get_account("new.wallet@example.com"))


if __name__ == "__main__":
    unittest.main()
