"""Prometheus metrics for the fiscal receipt pipeline."""

from __future__ import annotations

import os
from typing import Any

from prometheus_client import Counter, Gauge, Histogram

_ENABLED: bool | None = None


class _NoopMetric:
    def labels(self, *args: Any, **kwargs: Any) -> _NoopMetric:
        return self

    def inc(self, amount: float = 1) -> None:
        return None

    def observe(self, value: float) -> None:
        return None

    def set(self, value: float) -> None:
        return None


def metrics_enabled() -> bool:
    global _ENABLED
    if _ENABLED is None:
        _ENABLED = os.getenv("METRICS_ENABLED", "true").lower() not in ("0", "false", "no")
    return _ENABLED


def _gauge(name: str, documentation: str, labelnames: tuple[str, ...] = ()) -> Gauge | _NoopMetric:
    if not metrics_enabled():
        return _NoopMetric()
    return Gauge(name, documentation, labelnames)


def _counter(name: str, documentation: str, labelnames: tuple[str, ...] = ()) -> Counter | _NoopMetric:
    if not metrics_enabled():
        return _NoopMetric()
    return Counter(name, documentation, labelnames)


def _histogram(name: str, documentation: str, labelnames: tuple[str, ...], buckets: tuple[float, ...]) -> Histogram | _NoopMetric:
    if not metrics_enabled():
        return _NoopMetric()
    return Histogram(name, documentation, labelnames, buckets=buckets)


FISCAL_INVOICES = _gauge(
    "fiscal_invoices",
    "Current fiscal invoice count by status",
    ("status",),
)

FISCAL_STUCK_CANDIDATES = _gauge(
    "fiscal_stuck_candidates",
    "Pending/queued fiscal invoices older than stuck threshold",
)

FISCAL_OPEN = _gauge(
    "fiscal_open_invoices",
    "Pending + queued + failed fiscal invoices",
)

FISCAL_DISPATCH_TOTAL = _counter(
    "fiscal_dispatch_total",
    "Fiscal receipt jobs scheduled after payment capture",
    ("transport",),
)

FISCAL_PROCESSING_TOTAL = _counter(
    "fiscal_processing_total",
    "Fiscal receipt worker outcomes",
    ("outcome", "provider", "invoice_kind"),
)

FISCAL_PROVIDER_DURATION = _histogram(
    "fiscal_provider_duration_seconds",
    "Fiscal provider API call duration",
    ("provider",),
    (0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)

FISCAL_PROVIDER_ERRORS = _counter(
    "fiscal_provider_errors_total",
    "Fiscal provider transmission failures",
    ("provider",),
)

FISCAL_STUCK_RECOVERY_TOTAL = _counter(
    "fiscal_stuck_recovery_redispatched_total",
    "Invoices re-dispatched by stuck recovery beat task",
)

FISCAL_AUTO_RETRY_TOTAL = _counter(
    "fiscal_auto_retry_total",
    "Failed invoices retried by auto-retry beat task",
)


def apply_fiscal_snapshot(snapshot: dict[str, Any]) -> None:
    """Update gauges from platform health / fiscal snapshot."""
    if not metrics_enabled():
        return

    for status in ("pending", "queued", "issued", "failed"):
        value = float(snapshot.get(status, 0) or 0)
        FISCAL_INVOICES.labels(status=status).set(value)

    FISCAL_STUCK_CANDIDATES.set(float(snapshot.get("stuck_candidates", 0) or 0))
    FISCAL_OPEN.set(float(snapshot.get("open", 0) or 0))


def record_fiscal_dispatch(transport: str) -> None:
    FISCAL_DISPATCH_TOTAL.labels(transport=transport or "unknown").inc()


def record_fiscal_processing(
    *,
    outcome: str,
    provider: str = "unknown",
    invoice_kind: str = "unknown",
) -> None:
    FISCAL_PROCESSING_TOTAL.labels(
        outcome=outcome or "unknown",
        provider=provider or "unknown",
        invoice_kind=invoice_kind or "unknown",
    ).inc()


def record_provider_call(*, provider: str, duration_seconds: float, success: bool) -> None:
    provider_label = provider or "unknown"
    FISCAL_PROVIDER_DURATION.labels(provider=provider_label).observe(max(0.0, duration_seconds))
    if not success:
        FISCAL_PROVIDER_ERRORS.labels(provider=provider_label).inc()


def record_stuck_recovery(redispatched: int) -> None:
    if redispatched > 0:
        FISCAL_STUCK_RECOVERY_TOTAL.inc(redispatched)


def record_auto_retry(retried: int) -> None:
    if retried > 0:
        FISCAL_AUTO_RETRY_TOTAL.inc(retried)
