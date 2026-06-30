"""Celery application — broker Redis, beat schedules for platform tasks."""

import os

from celery import Celery
from celery.schedules import crontab

from core.config import platform_settings

_fiscal_digest_hour = int(os.getenv("FISCAL_ALERT_DIGEST_HOUR", "8"))
_fleet_digest_hour = int(os.getenv("FLEET_DIGEST_HOUR", "19"))

celery_app = Celery(
    "aerostride",
    broker=platform_settings.celery_broker_url,
    backend=platform_settings.celery_result_backend,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Athens",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "pre-departure-sms": {
        "task": "workers.tasks.scan_pre_departure_sms",
        "schedule": crontab(minute="*/5"),
    },
    "abandoned-file-carts-recovery": {
        "task": "workers.tasks.scan_abandoned_file_carts",
        "schedule": crontab(minute="*/15"),
    },
    "abandoned-booking-recovery-postgres": {
        "task": "workers.tasks.scan_abandoned_bookings_all_tenants",
        "schedule": crontab(minute="5,35"),
    },
    "driver-stats-cache-refresh": {
        "task": "workers.tasks.refresh_all_driver_stats",
        "schedule": crontab(hour="*/6", minute=0),
    },
    "driver-document-expiry-alerts": {
        "task": "workers.tasks.alert_driver_document_expiry",
        "schedule": crontab(hour=8, minute=0),
    },
    "stripe-usage-metering": {
        "task": "workers.tasks.report_stripe_usage_all_tenants",
        "schedule": crontab(
            hour=platform_settings.usage_metering_cron_hour,
            minute=platform_settings.usage_metering_cron_minute,
        ),
    },
    "fiscal-failed-auto-retry": {
        "task": "workers.tasks.retry_failed_fiscal_receipts",
        "schedule": crontab(minute="10,25,40,55"),
    },
    "fiscal-stuck-recovery": {
        "task": "workers.tasks.recover_stuck_fiscal_receipts",
        "schedule": crontab(minute="*/10"),
    },
    "fiscal-pipeline-digest": {
        "task": "workers.tasks.send_fiscal_pipeline_alert_task",
        "schedule": crontab(hour=_fiscal_digest_hour, minute=0),
        "kwargs": {"kind": "digest"},
    },
    "fleet-daily-digest": {
        "task": "workers.tasks.send_fleet_digest_task",
        "schedule": crontab(hour=_fleet_digest_hour, minute=30),
    },
}
