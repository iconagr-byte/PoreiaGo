"""Password utils — iterations in hash + legacy verify."""

from __future__ import annotations

import unittest

from ticketing.password_utils import (
    DEFAULT_PBKDF2_ITERATIONS,
    DRIVER_PBKDF2_ITERATIONS,
    hash_password,
    verify_password,
)


class PasswordUtilsTests(unittest.TestCase):
    def test_new_hash_embeds_iterations(self) -> None:
        stored = hash_password("hello", iterations=DRIVER_PBKDF2_ITERATIONS)
        parts = stored.split("$")
        self.assertEqual(parts[0], "pbkdf2_sha256")
        self.assertEqual(parts[1], str(DRIVER_PBKDF2_ITERATIONS))
        self.assertTrue(verify_password("hello", stored))
        self.assertFalse(verify_password("nope", stored))

    def test_legacy_three_part_hash_still_verifies(self) -> None:
        import hashlib
        import secrets

        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            b"legacy-pass",
            salt.encode(),
            DEFAULT_PBKDF2_ITERATIONS,
        )
        legacy = f"pbkdf2_sha256${salt}${digest.hex()}"
        self.assertTrue(verify_password("legacy-pass", legacy))
        self.assertFalse(verify_password("wrong", legacy))


if __name__ == "__main__":
    unittest.main()
