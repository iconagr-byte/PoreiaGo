"""Create-office must not roll back the outer txn when detail counts fail."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ProvisionTenantCreateSafeTests(unittest.TestCase):
    def test_tenant_detail_uses_savepoint_not_full_rollback(self):
        src = (ROOT / "app/services/platform_admin_service.py").read_text(encoding="utf-8")
        self.assertIn("begin_nested()", src)
        # Counts failure must not call session.rollback() inside _tenant_detail_async.
        tree = ast.parse(src)
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "PlatformAdminService":
                for item in node.body:
                    if isinstance(item, ast.AsyncFunctionDef) and item.name == "_tenant_detail_async":
                        text = ast.get_source_segment(src, item) or ""
                        self.assertIn("begin_nested", text)
                        self.assertNotIn("await self._session.rollback()", text)
                        return
        self.fail("_tenant_detail_async not found")

    def test_create_tenant_endpoint_builds_local_summary(self):
        src = (ROOT / "app/api/platform.py").read_text(encoding="utf-8")
        self.assertIn("Prefer in-memory summary", src)
        self.assertIn("svc._tenant_detail(tenant", src)

    def test_provision_heals_legacy_name(self):
        src = (ROOT / "app/services/platform_admin_service.py").read_text(encoding="utf-8")
        self.assertIn("_heal_legacy_tenant_name_column", src)
        self.assertIn("UPDATE tenants SET name", src)


if __name__ == "__main__":
    unittest.main()
