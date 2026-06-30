#!/usr/bin/env python3
"""
AADE myDATA sandbox E2E — posts one retail receipt to the dev API.

Mock E2E (no credentials, CI-safe):
  cd backend && python -m unittest tests.test_fiscal_aade_e2e.FiscalTransmissionAadeE2ETests -v

Live sandbox (requires AADE test credentials):
  cd backend && python -m scripts.fiscal_aade_e2e --live

Environment (live):
  AADE_E2E_LIVE=1
  AADE_USER_ID=...
  AADE_SUBSCRIPTION_KEY=...
  AADE_VAT_NUMBER=802963132          # registered test issuer VAT
  AADE_DEV_API_URL=...               # optional, defaults to mydataapidev
  AADE_E2E_SERIAL=123456             # optional unique serial (aa)
  AADE_E2E_AMOUNT=1.00               # optional gross EUR
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def run_mock_self_check() -> int:
    import unittest

    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName("tests.test_fiscal_aade_e2e.FiscalTransmissionAadeE2ETests")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


async def run_live() -> int:
    from travel_platform.compliance.fiscal_models import BookingFiscalData, FiscalDocumentCategory
    from travel_platform.compliance.native_aade_strategy import NativeAADEStrategy

    user_id = os.getenv("AADE_USER_ID", "").strip()
    sub_key = os.getenv("AADE_SUBSCRIPTION_KEY", "").strip()
    if not user_id or not sub_key:
        print("ERROR: set AADE_USER_ID and AADE_SUBSCRIPTION_KEY", file=sys.stderr)
        return 2

    issuer_vat = os.getenv("AADE_VAT_NUMBER", "802963132").strip()
    serial = int(os.getenv("AADE_E2E_SERIAL", str(uuid4().int % 900_000 + 100_000)))
    amount = Decimal(os.getenv("AADE_E2E_AMOUNT", "1.00"))
    series = os.getenv("AADE_E2E_SERIES", "ΑΠΥ")

    data = BookingFiscalData(
        issuer_vat=issuer_vat,
        series=series,
        serial_number=serial,
        issue_date=date.today(),
        document_category=FiscalDocumentCategory.RETAIL_RECEIPT,
        gross_amount=amount,
        line_description="AeroStride fiscal_aade_e2e sandbox",
        booking_reference=f"E2E-{serial}",
    )

    print(f"Posting retail receipt to AADE dev — VAT={issuer_vat} series={series} aa={serial} gross=€{amount}")
    strategy = NativeAADEStrategy()
    try:
        result = await strategy.transmit(
            data,
            {"aade_user_id": user_id, "aade_subscription_key": sub_key},
        )
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    print(f"OK — MARK={result.invoice_mark} UID={result.invoice_uid}")
    return 0


def main() -> int:
    load_env_file(BACKEND_ROOT / ".env")
    parser = argparse.ArgumentParser(description="AADE myDATA E2E (mock or live sandbox)")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Post to mydataapidev.aade.gr (requires credentials)",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run in-process mock HTTP E2E tests (default)",
    )
    args = parser.parse_args()

    if args.live:
        os.environ["AADE_E2E_LIVE"] = "1"
        return asyncio.run(run_live())
    return run_mock_self_check()


if __name__ == "__main__":
    raise SystemExit(main())
