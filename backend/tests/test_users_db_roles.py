"""Unit tests for Postgres platform user role mapping."""

from __future__ import annotations

import unittest

from travel_platform.settings.users_db import db_roles_from_ui, ui_role_from_db


class UsersDbRoleMappingTests(unittest.TestCase):
    def test_ui_from_superadmin(self):
        self.assertEqual(ui_role_from_db(["superadmin", "tenant_admin"]), "admin")

    def test_ui_from_dispatcher(self):
        self.assertEqual(ui_role_from_db(["dispatcher"]), "agent")

    def test_db_admin_preserves_superadmin(self):
        roles = db_roles_from_ui("admin", preserve_superadmin=True)
        self.assertIn("superadmin", roles)
        self.assertIn("tenant_admin", roles)

    def test_db_admin_without_superadmin(self):
        roles = db_roles_from_ui("admin", preserve_superadmin=False)
        self.assertNotIn("superadmin", roles)
        self.assertEqual(roles[0], "tenant_admin")


if __name__ == "__main__":
    unittest.main()
