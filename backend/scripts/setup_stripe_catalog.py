#!/usr/bin/env python3
"""
Create PoreiaGo SaaS products/prices in Stripe and print .env.prod lines.

Usage (from backend/):
  STRIPE_SECRET_KEY=sk_test_... python -m scripts.setup_stripe_catalog
  STRIPE_SECRET_KEY=sk_live_... python -m scripts.setup_stripe_catalog --live
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND))

import stripe

CATALOG = [
    ("starter", "PoreiaGo Starter", 9900),
    ("professional", "PoreiaGo Professional", 29900),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Create Stripe catalog for PoreiaGo SaaS billing")
    parser.add_argument("--live", action="store_true", help="Confirm live mode (sk_live_ key)")
    args = parser.parse_args()

    key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not key:
        print("ERROR: set STRIPE_SECRET_KEY", file=sys.stderr)
        return 1
    if args.live and not key.startswith("sk_live_"):
        print("ERROR: --live requires sk_live_ key", file=sys.stderr)
        return 1

    stripe.api_key = key
    env_lines: list[str] = [f"STRIPE_SECRET_KEY={key}"]

    for plan_id, name, monthly_cents in CATALOG:
        product = stripe.Product.create(
            name=name,
            metadata={"poreiago_plan": plan_id},
        )
        monthly = stripe.Price.create(
            product=product.id,
            unit_amount=monthly_cents,
            currency="eur",
            recurring={"interval": "month"},
            metadata={"poreiago_plan": plan_id, "billing_interval": "month"},
        )
        yearly = stripe.Price.create(
            product=product.id,
            unit_amount=monthly_cents * 10,
            currency="eur",
            recurring={"interval": "year"},
            metadata={"poreiago_plan": plan_id, "billing_interval": "year"},
        )
        env_lines.append(f"STRIPE_PRICE_{plan_id.upper()}={monthly.id}")
        env_lines.append(f"STRIPE_PRICE_{plan_id.upper()}_YEARLY={yearly.id}")
        print(f"  {name}: monthly={monthly.id} yearly={yearly.id}")

    print("\n# Paste into deploy/.env.prod on the VM:")
    print("\n".join(env_lines))
    print("\n# Also set:")
    print("STRIPE_WEBHOOK_SECRET=whsec_...  # from Stripe → Webhooks → api.poreiago.com/api/v1/billing/webhook")
    print("BILLING_SUCCESS_URL=https://www.poreiago.com/admin?billing=success")
    print("BILLING_CANCEL_URL=https://www.poreiago.com/admin?billing=cancel")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
