"""Native rent demo mints a JWT sealed to IconaRent."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

AUTH_PY = Path(__file__).resolve().parents[1] / "api" / "customer_auth.py"


class NativeRentDemoAuthTests(unittest.TestCase):
    def test_endpoint_exists_and_targets_iconarent(self):
        source = AUTH_PY.read_text(encoding="utf-8")
        self.assertIn('"/native-rent-demo"', source)
        self.assertIn("demo-rent@poreiago.local", source)
        self.assertIn("ensure_starter_rent_fleet", source)
        tree = ast.parse(source)
        names = {
            n.name
            for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        self.assertIn("native_rent_demo_session", names)


if __name__ == "__main__":
    unittest.main()
