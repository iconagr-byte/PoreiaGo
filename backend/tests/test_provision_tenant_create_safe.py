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

    def test_provision_prepares_contabo_schema_and_inserts_name(self):
        src = (ROOT / "app/services/platform_admin_service.py").read_text(encoding="utf-8")
        self.assertIn("prepare_contabo_tenant_write", src)
        self.assertIn("INSERT INTO tenants", src)
        self.assertIn("tenant_plan_db_token", src)
        # merge(load=False) rejects transient instances — Core insert + holder only.
        self.assertNotIn("merge(tenant, load=False)", src)
        self.assertIn("use_core_tenant", src)
        mods = (ROOT / "app/services/tenant_modules.py").read_text(encoding="utf-8")
        self.assertIn("async def prepare_contabo_tenant_write", mods)
        self.assertIn("detect_tenant_plan_persist_style", mods)

    def test_tenant_plan_db_token_name_vs_value(self):
        from app.models.tenant import TenantPlan
        from app.services.tenant_modules import tenant_plan_db_token, tenant_plan_sql_expr

        self.assertEqual(tenant_plan_db_token(TenantPlan.STARTER, "name"), "STARTER")
        self.assertEqual(tenant_plan_db_token(TenantPlan.RENT, "name"), "RENT")
        self.assertEqual(tenant_plan_db_token(TenantPlan.STARTER, "value"), "starter")
        self.assertEqual(tenant_plan_db_token(TenantPlan.RENT, "value"), "rent")
        # Contabo VARCHAR: never CAST when the PG type is missing.
        self.assertEqual(tenant_plan_sql_expr(has_plan_enum=False), ":plan")
        self.assertEqual(
            tenant_plan_sql_expr(has_plan_enum=True),
            "CAST(:plan AS tenant_plan)",
        )

    def test_prepare_flags_include_has_plan_enum(self):
        mods = (ROOT / "app/services/tenant_modules.py").read_text(encoding="utf-8")
        self.assertIn("pg_tenant_plan_type_exists", mods)
        self.assertIn('"has_plan_enum"', mods)
        self.assertIn("base_amount_cents", mods)
        self.assertIn("build_subscription_insert_sql", mods)
        src = (ROOT / "app/services/platform_admin_service.py").read_text(encoding="utf-8")
        self.assertIn("tenant_plan_sql_expr", src)
        self.assertIn("has_plan_enum", src)
        self.assertIn("build_subscription_insert_sql", src)

    def test_build_subscription_insert_omits_missing_columns(self):
        from app.services.tenant_modules import build_subscription_insert_sql

        sql, binds = build_subscription_insert_sql(
            columns={"id", "tenant_id", "plan", "status"},
            plan_sql=":plan",
        )
        self.assertIn("INSERT INTO subscriptions", sql)
        self.assertIn("plan", sql)
        self.assertIn("status", sql)
        self.assertNotIn("base_amount_cents", sql)
        self.assertEqual(binds, ["id", "tenant_id", "plan", "status"])

        sql_full, binds_full = build_subscription_insert_sql(
            columns={
                "id",
                "tenant_id",
                "plan",
                "status",
                "base_amount_cents",
                "trial_ends_at",
                "cancel_at_period_end",
                "metered_buses",
                "metered_trips",
            },
            plan_sql="CAST(:plan AS tenant_plan)",
        )
        self.assertIn("base_amount_cents", sql_full)
        self.assertIn("trial_ends_at", sql_full)
        self.assertIn("base_amount_cents", binds_full)


if __name__ == "__main__":
    unittest.main()
