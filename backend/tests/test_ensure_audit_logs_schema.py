"""Unit checks for audit_logs schema drift detection."""

from __future__ import annotations

import unittest

from app.services.ensure_audit_logs_schema import is_audit_logs_schema_drift_error


class EnsureAuditLogsSchemaTests(unittest.TestCase):
    def test_detects_missing_created_at(self):
        exc = Exception(
            '(psycopg.errors.UndefinedColumn) column audit_logs.created_at does not exist'
        )
        self.assertTrue(is_audit_logs_schema_drift_error(exc))

    def test_detects_missing_table(self):
        exc = Exception("UndefinedTable: relation \"audit_logs\" does not exist")
        self.assertTrue(is_audit_logs_schema_drift_error(exc))

    def test_ignores_unrelated(self):
        self.assertFalse(is_audit_logs_schema_drift_error(Exception("connection refused")))


if __name__ == "__main__":
    unittest.main()
