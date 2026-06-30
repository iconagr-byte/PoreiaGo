"""
Idling analytics — alert when speed=0, engine=ON, duration > 5 minutes.
Idle cost = (fuel_liters_per_hour_idle) * (duration_hours).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from core.config import get_platform_settings
from travel_platform.telemetry.domain import IdleAlert, TelemetryUpdate

logger = logging.getLogger(__name__)

IDLE_SPEED_THRESHOLD_KMH = 3.0
DEFAULT_IDLE_ALERT_SECONDS = 300
DEFAULT_FUEL_LPH_IDLE = 2.5  # liters per hour at idle
DEFAULT_FUEL_PRICE_EUR = 1.85


@dataclass
class ActiveIdleState:
    started_at: datetime
    alert_sent: bool = False


class IdlingAnalyticsService:
    """Stateful per-vehicle idle tracking (in-memory; persist via idle_sessions on end)."""

    _active: dict[str, ActiveIdleState] = {}

    def __init__(
        self,
        alert_threshold_seconds: int | None = None,
        fuel_liters_per_hour: float | None = None,
        fuel_price_eur_per_liter: float | None = None,
    ):
        settings = get_platform_settings()
        self._threshold = alert_threshold_seconds or getattr(
            settings, "idle_alert_seconds", DEFAULT_IDLE_ALERT_SECONDS
        )
        self._fuel_lph = fuel_liters_per_hour or getattr(
            settings, "idle_fuel_liters_per_hour", DEFAULT_FUEL_LPH_IDLE
        )
        self._fuel_price = fuel_price_eur_per_liter or getattr(
            settings, "fuel_price_eur_per_liter", DEFAULT_FUEL_PRICE_EUR
        )

    def is_idling(self, update: TelemetryUpdate) -> bool:
        return update.engine_on and update.speed_kmh < IDLE_SPEED_THRESHOLD_KMH

    def process_point(
        self,
        vehicle_id: UUID,
        update: TelemetryUpdate,
    ) -> IdleAlert | None:
        key = str(vehicle_id)
        now = update.recorded_at
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        if not self.is_idling(update):
            ended = self._active.pop(key, None)
            if ended:
                return self._finalize_session(vehicle_id, update, ended, now)
            return None

        state = self._active.get(key)
        if not state:
            self._active[key] = ActiveIdleState(started_at=now)
            return None

        duration = int((now - state.started_at).total_seconds())
        if duration >= self._threshold and not state.alert_sent:
            state.alert_sent = True
            liters, cost = self.calculate_idle_cost(duration)
            return IdleAlert(
                vehicle_id=vehicle_id,
                trip_id=update.trip_id,
                duration_seconds=duration,
                fuel_wasted_liters=liters,
                idle_cost_eur=cost,
                message=(
                    f"Vehicle idling {duration // 60} min — "
                    f"est. waste €{cost:.2f} ({liters:.2f}L)"
                ),
            )
        return None

    def calculate_idle_cost(self, duration_seconds: int) -> tuple[float, float]:
        hours = duration_seconds / 3600.0
        liters = hours * self._fuel_lph
        cost = liters * self._fuel_price
        return round(liters, 3), round(cost, 2)

    def trip_idle_seconds(self, vehicle_id: UUID) -> int:
        key = str(vehicle_id)
        state = self._active.get(key)
        if not state:
            return 0
        now = datetime.now(timezone.utc)
        return int((now - state.started_at).total_seconds())

    def estimated_fuel_saved_liters(self, idle_seconds: int, baseline_idle_seconds: int = 600) -> float:
        """Gamification: savings vs 10 min baseline idle per trip."""
        if idle_seconds >= baseline_idle_seconds:
            return 0.0
        saved_seconds = baseline_idle_seconds - idle_seconds
        return round((saved_seconds / 3600.0) * self._fuel_lph, 2)

    def _finalize_session(
        self,
        vehicle_id: UUID,
        update: TelemetryUpdate,
        state: ActiveIdleState,
        ended: datetime,
    ) -> None:
        duration = int((ended - state.started_at).total_seconds())
        if duration < 60:
            return None
        liters, cost = self.calculate_idle_cost(duration)
        logger.info(
            "Idle session ended vehicle=%s duration=%ss cost=€%.2f",
            vehicle_id,
            duration,
            cost,
        )
        return None
