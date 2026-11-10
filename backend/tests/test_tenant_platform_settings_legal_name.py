"""Contract: platform settings prefer tenant legal_name over PoreiaGo defaults."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TenantPlatformSettingsLegalNameContract(unittest.TestCase):
    def test_get_settings_prefers_legal_name(self):
        src = (ROOT / "app/services/tenant_platform_settings_service.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("legal_name", src)
        self.assertIn('merged["company_name"] = legal', src)
        self.assertIn("DEFAULT_PLATFORM_SETTINGS", src)


if __name__ == "__main__":
    unittest.main()
