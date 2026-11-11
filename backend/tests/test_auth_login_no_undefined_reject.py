"""Regression: office /login must not NameError after a valid password."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

AUTH_PY = Path(__file__).resolve().parents[1] / "app" / "api" / "auth.py"


class AuthLoginRejectFlagTests(unittest.TestCase):
    def test_login_does_not_reference_removed_reject_flag(self):
        """
        A bad merge left ``if reject_achillio_on_platform:`` without defining
        the name. Correct password → NameError → bare Internal Server Error;
        wrong password still 401'd earlier. Host affinity + mirror replace it.
        """
        tree = ast.parse(AUTH_PY.read_text(encoding="utf-8"))
        login_fn = None
        for node in tree.body:
            if isinstance(node, ast.AsyncFunctionDef) and node.name == "login":
                login_fn = node
                break
        self.assertIsNotNone(login_fn)
        names = {n.id for n in ast.walk(login_fn) if isinstance(n, ast.Name)}
        self.assertNotIn("reject_achillio_on_platform", names)
        self.assertIn("mirror_missing_user", names)


if __name__ == "__main__":
    unittest.main()
