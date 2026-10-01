"""
Live fleet state — latest positions for admin map + heatmap aggregation.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from travel_platform.telemetry.domain import LiveVehicleState, TelemetryUpdate


class LiveFleetService:
    """In-memory latest state (sync from DB in production).

    Vehicles are keyed by UUID. A secondary index maps `{tenant}:{vehicle_code}` → UUID
    so registry + GPS updates stay on the same record (required for list_active / snapshots).
    """

    _vehicles: dict[str, dict[str, Any]] = {}
    _code_index: dict[str, str] = {}
    _heat_points: dict[str, list[tuple[float, float]]] = defaultdict(list)

    def upsert_vehicle_registry(
        self,
        tenant_id: UUID,
        vehicle_code: str,
        trip_id: int | None = None,
    ) -> UUID:
        from travel_platform.telemetry.tracker_priority import (
            normalize_vehicle_plate,
            plate_display,
        )

        code = normalize_vehicle_plate(vehicle_code) or "UNKNOWN"
        display = plate_display(vehicle_code) or code
        key = f"{tenant_id}:{code}"
        existing = self._code_index.get(key)
        if existing and existing in self._vehicles:
            meta = self._vehicles[existing]
            meta["tenant_id"] = str(tenant_id)
            meta["vehicle_code"] = display
            meta["bus_plate"] = meta.get("bus_plate") or display
            if trip_id is not None:
                meta["trip_id"] = trip_id
            return UUID(existing)

        # Reuse an existing in-memory row for the same plate (case/spacing variants).
        tid = str(tenant_id)
        for candidate, meta in self._vehicles.items():
            if str(meta.get("tenant_id") or "") != tid:
                continue
            plate = normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate"))
            if plate == code:
                self._code_index[key] = candidate
                meta["vehicle_code"] = display
                meta["bus_plate"] = meta.get("bus_plate") or display
                if trip_id is not None:
                    meta["trip_id"] = trip_id
                return UUID(candidate)

        vid = str(uuid4())
        self._code_index[key] = vid
        self._vehicles[vid] = {
            "vehicle_id": vid,
            "tenant_id": tid,
            "vehicle_code": display,
            "trip_id": trip_id,
            "bus_plate": display,
        }
        return UUID(vid)

    def apply_update(
        self,
        vehicle_id: UUID,
        update: TelemetryUpdate,
        idle_seconds: int = 0,
    ) -> LiveVehicleState:
        vid = str(vehicle_id)
        prev = self._vehicles.get(vid, {})
        state = LiveVehicleState(
            vehicle_id=vid,
            vehicle_code=update.vehicle_code,
            trip_id=update.trip_id,
            lat=update.latitude,
            lng=update.longitude,
            speed_kmh=update.speed_kmh,
            engine_on=update.engine_on,
            fuel_level_pct=update.fuel_level_pct,
            idle_seconds_trip=idle_seconds,
            updated_at=update.recorded_at,
        )
        merged = {
            **prev,
            **state.__dict__,
            "vehicle_id": vid,
            "tenant_id": str(update.tenant_id),
            "vehicle_code": update.vehicle_code,
        }
        raw = update.raw or {}
        if raw.get("driver_name"):
            merged["driver_name"] = raw["driver_name"]
        plate = raw.get("bus_plate") or raw.get("vehicle_code") or update.vehicle_code
        if plate:
            merged["bus_plate"] = plate
        if raw.get("heading_deg") is not None:
            merged["heading_deg"] = raw.get("heading_deg")
        if raw.get("source"):
            merged["source"] = str(raw.get("source"))
        if raw.get("imei"):
            merged["imei"] = str(raw.get("imei"))

        # Hardware tracker owns the pin. Do not keep a prior smartphone
        # driver_id — otherwise end-shift / stale-GPS wipe also deletes Teltonika.
        source_l = str(raw.get("source") or merged.get("source") or "").strip().lower()
        is_tracker = source_l.startswith("teltonika") or source_l in {
            "tracker",
            "test_ping",
            "teltonika_test_ping",
        }
        if is_tracker:
            if raw.get("driver_id"):
                merged["driver_id"] = raw["driver_id"]
            else:
                merged.pop("driver_id", None)
            # Real Codec packet vs parked-store hydrate.
            if raw.get("hydrated_from_store"):
                merged["hydrated_from_store"] = True
                if raw.get("tracker_signal_at"):
                    merged["tracker_signal_at"] = str(raw.get("tracker_signal_at"))
            else:
                from datetime import datetime, timezone

                merged.pop("hydrated_from_store", None)
                # Server receive time keeps the pin on the map even when the
                # device GPS clock is skewed/old (common on Teltonika).
                now_dt = datetime.now(timezone.utc)
                now_iso = now_dt.isoformat()
                signal = raw.get("tracker_signal_at") or now_iso
                merged["tracker_signal_at"] = str(signal)
                merged["updated_at"] = now_iso
                if raw.get("gps_recorded_at"):
                    merged["gps_recorded_at"] = str(raw.get("gps_recorded_at"))
                try:
                    state.updated_at = now_dt
                except Exception:
                    pass
        elif raw.get("driver_id"):
            merged["driver_id"] = raw["driver_id"]
        trip_title = raw.get("trip_title") or raw.get("tripTitle") or raw.get("excursion_name")
        if trip_title:
            merged["trip_title"] = str(trip_title).strip()
        elif update.trip_id is not None and not merged.get("trip_title"):
            from travel_platform.telemetry.trip_title_resolve import resolve_trip_title_sync

            merged["trip_title"] = resolve_trip_title_sync(update.trip_id)

        from travel_platform.telemetry.tracker_priority import (
            normalize_vehicle_plate,
            plate_display,
        )

        plate_key = normalize_vehicle_plate(update.vehicle_code or merged.get("bus_plate"))
        display = plate_display(
            raw.get("bus_plate") or update.vehicle_code or merged.get("bus_plate")
        )
        if plate_key:
            # Keep hyphens in the label; aggressive key is only for the index/dedupe.
            merged["vehicle_code"] = display or plate_key
            merged["bus_plate"] = display or plate_key
        self._vehicles[vid] = merged
        # Keep code index in sync (normalized plate — one pin per bus).
        if plate_key:
            self._code_index[f"{update.tenant_id}:{plate_key}"] = vid

        tenant = str(update.tenant_id)
        self._heat_points[tenant].append((update.latitude, update.longitude))
        if len(self._heat_points[tenant]) > 10_000:
            self._heat_points[tenant] = self._heat_points[tenant][-5000:]
        return state

    def find_vehicle_id(self, tenant_id: str, vehicle_code: str) -> str | None:
        from travel_platform.telemetry.tracker_priority import normalize_vehicle_plate

        plate = normalize_vehicle_plate(vehicle_code)
        if not plate:
            return None
        key = f"{tenant_id}:{plate}"
        vid = self._code_index.get(key)
        if vid and vid in self._vehicles:
            return vid
        for candidate, meta in self._vehicles.items():
            if str(meta.get("tenant_id") or "") != str(tenant_id):
                continue
            if normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate")) == plate:
                self._code_index[key] = candidate
                return candidate
        return None

    def _meta_to_state(self, meta: dict[str, Any], *, stale_seconds: int, now: datetime) -> LiveVehicleState | None:
        if meta.get("lat") is None or meta.get("lng") is None:
            return None
        from travel_platform.telemetry.live_fleet_redis import parse_updated_at

        updated = parse_updated_at(meta.get("updated_at"))
        if updated and (now - updated).total_seconds() > stale_seconds:
            return None
        return LiveVehicleState(
            vehicle_id=str(meta.get("vehicle_id") or ""),
            vehicle_code=meta.get("vehicle_code", ""),
            trip_id=meta.get("trip_id"),
            lat=float(meta["lat"]),
            lng=float(meta["lng"]),
            speed_kmh=float(meta.get("speed_kmh") or 0),
            engine_on=bool(meta.get("engine_on", False)),
            fuel_level_pct=meta.get("fuel_level_pct"),
            idle_seconds_trip=int(meta.get("idle_seconds_trip") or 0),
            updated_at=updated or now,
        )

    def _dedupe_states_by_plate(
        self,
        states: list[LiveVehicleState],
        *,
        tenant_id: str,
        now: datetime,
        max_age_sec: int,
    ) -> list[LiveVehicleState]:
        """One pin per plate — fresh Teltonika beats leftover phone GPS."""
        from travel_platform.telemetry.tracker_priority import (
            merge_app_signal_into_meta,
            meta_plate,
            normalize_vehicle_plate,
            prefer_meta_for_plate,
        )

        winners: dict[str, tuple[LiveVehicleState, dict[str, Any]]] = {}
        orphans: list[LiveVehicleState] = []
        for state in states or []:
            meta = dict(self._vehicles.get(str(state.vehicle_id), {}) or {})
            meta.setdefault("vehicle_id", state.vehicle_id)
            meta.setdefault("vehicle_code", state.vehicle_code)
            meta.setdefault("bus_plate", state.vehicle_code)
            meta.setdefault("source", meta.get("source"))
            meta.setdefault("updated_at", state.updated_at.isoformat() if state.updated_at else None)
            meta.setdefault("lat", state.lat)
            meta.setdefault("lng", state.lng)
            plate = meta_plate(meta) or normalize_vehicle_plate(state.vehicle_code)
            if not plate:
                orphans.append(state)
                continue
            prev = winners.get(plate)
            if not prev:
                winners[plate] = (state, meta)
                continue
            chosen = prefer_meta_for_plate(prev[1], meta, max_age_sec=max_age_sec, now=now)
            if chosen is meta:
                merged = merge_app_signal_into_meta(
                    meta, prev[1], max_age_sec=max_age_sec, now=now
                )
                winners[plate] = (state, merged)
            else:
                merged = merge_app_signal_into_meta(
                    prev[1], meta, max_age_sec=max_age_sec, now=now
                )
                winners[plate] = (prev[0], merged)
            # Point the plate index at the winning vehicle id + stamp dual sources.
            keep_state, keep_meta = winners[plate]
            keep_vid = str(keep_state.vehicle_id or keep_meta.get("vehicle_id") or "")
            if keep_vid:
                self._code_index[f"{tenant_id}:{plate}"] = keep_vid
                self._vehicles[keep_vid] = {
                    **self._vehicles.get(keep_vid, {}),
                    **keep_meta,
                }
        return [pair[0] for pair in winners.values()] + orphans

    def list_active(self, tenant_id: UUID) -> list[LiveVehicleState]:
        from travel_platform.telemetry.settings_store import get_telemetry_settings
        from travel_platform.telemetry.tracker_priority import resolve_tracker_alive_seconds

        tid = str(tenant_id)
        stale_seconds = get_telemetry_settings(tid).driver_stale_seconds
        now = datetime.now(timezone.utc)
        out = []
        for meta in self._vehicles.values():
            if meta.get("tenant_id") != tid:
                continue
            state = self._meta_to_state(meta, stale_seconds=stale_seconds, now=now)
            if state:
                out.append(state)
        return self._dedupe_states_by_plate(
            out,
            tenant_id=tid,
            now=now,
            max_age_sec=resolve_tracker_alive_seconds(tid),
        )

    async def list_active_async(self, tenant_id: UUID) -> list[LiveVehicleState]:
        """Memory + Redis (needed when WS is down and HTTP poll hits another worker)."""
        from travel_platform.telemetry.live_fleet_redis import load_live_vehicles
        from travel_platform.telemetry.settings_store import get_telemetry_settings
        from travel_platform.telemetry.tracker_priority import (
            normalize_vehicle_plate,
            resolve_tracker_alive_seconds,
        )

        tid = str(tenant_id)
        stale_seconds = get_telemetry_settings(tid).driver_stale_seconds
        now = datetime.now(timezone.utc)
        by_id: dict[str, LiveVehicleState] = {}

        # Use raw memory scan here (pre-dedupe) so Redis merges can still win.
        for meta in self._vehicles.values():
            if meta.get("tenant_id") != tid:
                continue
            state = self._meta_to_state(meta, stale_seconds=stale_seconds, now=now)
            if state and state.vehicle_id:
                by_id[state.vehicle_id] = state

        for meta in await load_live_vehicles(tid):
            # Hydrate local cache so subsequent meta lookups work.
            vid = str(meta.get("vehicle_id") or "")
            if vid:
                self._vehicles[vid] = {**self._vehicles.get(vid, {}), **meta}
                code = normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate"))
                if code:
                    self._code_index[f"{tid}:{code}"] = vid
            state = self._meta_to_state(meta, stale_seconds=stale_seconds, now=now)
            if not state or not state.vehicle_id:
                continue
            prev = by_id.get(state.vehicle_id)
            if not prev or state.updated_at >= prev.updated_at:
                by_id[state.vehicle_id] = state
        # Detect same-plate duplicates before collapse — only then purge Redis.
        plate_counts: dict[str, int] = {}
        for state in by_id.values():
            meta = self._vehicles.get(str(state.vehicle_id), {}) or {}
            from travel_platform.telemetry.tracker_priority import meta_plate as _meta_plate

            plate = _meta_plate(meta) or normalize_vehicle_plate(state.vehicle_code)
            if plate:
                plate_counts[plate] = plate_counts.get(plate, 0) + 1

        deduped = self._dedupe_states_by_plate(
            list(by_id.values()),
            tenant_id=tid,
            now=now,
            max_age_sec=resolve_tracker_alive_seconds(tid),
        )
        dup_plates = {p for p, n in plate_counts.items() if n > 1}
        if dup_plates:
            try:
                from travel_platform.telemetry.tracker_priority import (
                    is_tracker_source,
                    meta_plate,
                )

                for state in deduped:
                    meta = self._vehicles.get(str(state.vehicle_id), {}) or {}
                    plate = meta_plate(meta) or normalize_vehicle_plate(state.vehicle_code)
                    if plate not in dup_plates:
                        continue
                    if not is_tracker_source(meta.get("source")) and not meta.get("imei"):
                        continue
                    await self.purge_phone_siblings_for_plate(
                        tid,
                        plate,
                        keep_vehicle_id=str(state.vehicle_id),
                    )
            except Exception:
                pass
        return deduped

    async def purge_phone_siblings_for_plate(
        self,
        tenant_id: str,
        vehicle_code: str | None,
        *,
        keep_vehicle_id: str | None = None,
    ) -> list[str]:
        """
        Drop leftover phone/app pins for a plate when Teltonika owns the map.

        Multi-worker Redis often leaves both UUIDs alive for the same bus.
        """
        from travel_platform.telemetry.live_fleet_redis import (
            delete_live_vehicle,
            load_live_vehicles,
        )
        from travel_platform.telemetry.tracker_priority import (
            is_phone_source,
            is_tracker_source,
            normalize_vehicle_plate,
        )

        tid = str(tenant_id or "").strip()
        plate = normalize_vehicle_plate(vehicle_code)
        if not tid or not plate:
            return []

        def _is_hardware(meta: dict[str, Any] | None) -> bool:
            src = (meta or {}).get("source")
            if is_tracker_source(src):
                return True
            if (meta or {}).get("imei") and not is_phone_source(src):
                return True
            return False

        keep = str(keep_vehicle_id or "").strip()
        if not keep or not _is_hardware(self._vehicles.get(keep)):
            # Prefer an existing Teltonika/hardware UUID for this plate.
            for vid, meta in self._vehicles.items():
                if str(meta.get("tenant_id") or "") != tid:
                    continue
                if normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate")) != plate:
                    continue
                if _is_hardware(meta):
                    keep = str(vid)
                    break
        if not keep:
            keep = str(self.find_vehicle_id(tid, plate) or "").strip()

        removed: list[str] = []
        seen: set[str] = set()

        async def _drop(vid: str, meta: dict[str, Any]) -> None:
            if not vid or vid in seen:
                return
            if keep and vid == keep:
                return
            # Never delete hardware pins; only phone/app leftovers.
            if _is_hardware(meta):
                return
            seen.add(vid)
            self._vehicles.pop(vid, None)
            for idx_key, idx_vid in list(self._code_index.items()):
                if idx_vid == vid:
                    self._code_index.pop(idx_key, None)
            try:
                await delete_live_vehicle(tid, vid)
            except Exception:
                pass
            removed.append(vid)

        for vid, meta in list(self._vehicles.items()):
            if str(meta.get("tenant_id") or "") != tid:
                continue
            row_plate = normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate"))
            if row_plate != plate:
                continue
            await _drop(vid, meta)

        try:
            remote_rows = await load_live_vehicles(tid)
        except Exception:
            remote_rows = []
        for meta in remote_rows:
            row_plate = normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate"))
            if row_plate != plate:
                continue
            await _drop(str(meta.get("vehicle_id") or ""), meta)

        if keep:
            self._code_index[f"{tid}:{plate}"] = keep
        return removed

    async def mark_app_heartbeat_for_plate(
        self,
        tenant_id: str,
        vehicle_code: str | None,
        *,
        driver_id: str | None = None,
        driver_name: str | None = None,
        recorded_at: str | None = None,
    ) -> dict[str, Any] | None:
        """
        Soft-ack: keep Teltonika coords, stamp that the driver app is also live.

        Used so the map shows one pin with both Teltonika + App badges.
        """
        from travel_platform.telemetry.live_fleet_redis import save_live_vehicle
        from travel_platform.telemetry.tracker_priority import (
            normalize_vehicle_plate,
            resolve_live_gps_sources,
            resolve_tracker_alive_seconds,
        )

        tid = str(tenant_id or "").strip()
        plate = normalize_vehicle_plate(vehicle_code)
        if not tid or not plate:
            return None

        vid = self.find_vehicle_id(tid, plate)
        if not vid:
            return None
        meta = dict(self._vehicles.get(vid) or {})
        if not meta:
            return None

        now_iso = recorded_at or datetime.now(timezone.utc).isoformat()
        meta["app_seen_at"] = now_iso
        if driver_id:
            meta["app_driver_id"] = str(driver_id)
        if driver_name and not meta.get("driver_name"):
            meta["driver_name"] = str(driver_name)
        sources = resolve_live_gps_sources(
            meta,
            max_age_sec=resolve_tracker_alive_seconds(tid),
        )
        if "app" not in sources:
            sources = [*sources, "app"]
        meta["gps_sources"] = sources
        meta["tenant_id"] = tid
        meta["vehicle_id"] = vid
        self._vehicles[vid] = meta
        self._code_index[f"{tid}:{plate}"] = vid
        try:
            await save_live_vehicle(meta)
        except Exception:
            pass
        # Light WS refresh so the dual badge appears without waiting for poll.
        try:
            from travel_platform.telemetry.fleet_pubsub import publish_fleet_location
            from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub

            egress = {
                "type": "fleet_location",
                "tenant_id": tid,
                "vehicle_id": vid,
                "vehicle_code": meta.get("vehicle_code") or plate,
                "bus_plate": meta.get("bus_plate") or plate,
                "driver_name": meta.get("driver_name"),
                "driver_id": meta.get("driver_id") or meta.get("app_driver_id"),
                "trip_id": meta.get("trip_id"),
                "trip_title": meta.get("trip_title"),
                "lat": meta.get("lat"),
                "lng": meta.get("lng"),
                "speed": meta.get("speed_kmh") or 0,
                "heading": meta.get("heading_deg"),
                "timestamp": meta.get("updated_at") or now_iso,
                "source": meta.get("source") or "teltonika",
                "imei": meta.get("imei"),
                "app_seen_at": now_iso,
                "gps_sources": sources,
            }
            await publish_fleet_location(tid, egress)
            await get_fleet_egress_hub().broadcast(tid, egress)
        except Exception:
            pass
        return meta

    def _merge_admin_fleets(
        self,
        primary: list[LiveVehicleState],
        *extras: list[LiveVehicleState],
    ) -> list[LiveVehicleState]:
        seen_ids = {v.vehicle_id for v in primary if v.vehicle_id}
        seen_codes = {v.vehicle_code for v in primary if v.vehicle_code}
        merged = list(primary)
        for group in extras:
            for v in group or []:
                if v.vehicle_id and v.vehicle_id in seen_ids:
                    continue
                if v.vehicle_code and v.vehicle_code in seen_codes:
                    continue
                merged.append(v)
                if v.vehicle_id:
                    seen_ids.add(v.vehicle_id)
                if v.vehicle_code:
                    seen_codes.add(v.vehicle_code)
        return merged

    def _legacy_merge_allowed(self) -> bool:
        import os

        return os.getenv("ALLOW_CROSS_TENANT_FLEET_MERGE", "").lower() in (
            "1",
            "true",
            "yes",
        )

    def list_active_for_admin(self, tenant_id: UUID) -> list[LiveVehicleState]:
        """
        Active vehicles for the admin map.

        Cross-tenant demo/platform merge is OFF by default (tenant isolation).
        When ALLOW_CROSS_TENANT_FLEET_MERGE=1, only the platform/Achillio office
        (and DEMO JWT) may merge DEMO↔platform GPS — never PoreiaGo / other
        SaaS offices (that was the dual-office pin bleed).
        """
        import os

        primary = self.list_active(tenant_id)
        if not self._legacy_merge_allowed():
            return primary

        from travel_platform.operations.master_qr_local import DEFAULT_TENANT

        demo = str(DEFAULT_TENANT)
        tid = str(tenant_id)
        platform_raw = (
            os.getenv("SAAS_DEFAULT_TENANT_ID")
            or os.getenv("DEFAULT_TENANT_ID")
            or ""
        ).strip()

        # PoreiaGo / customer offices must never inherit Achillio or DEMO pins.
        if tid != demo and (not platform_raw or tid != platform_raw):
            return primary

        extras: list[list[LiveVehicleState]] = []
        if tid == platform_raw and tid != demo:
            extras.append(self.list_active(UUID(demo)))
        elif tid == demo and platform_raw and platform_raw != demo:
            extras.append(self.list_active(UUID(platform_raw)))

        return self._merge_admin_fleets(primary, *extras)

    async def list_active_for_admin_async(self, tenant_id: UUID) -> list[LiveVehicleState]:
        primary = await self.list_active_async(tenant_id)
        if not self._legacy_merge_allowed():
            return primary

        from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
        from travel_platform.operations.master_qr_local import DEFAULT_TENANT

        demo = str(DEFAULT_TENANT)
        tid = str(tenant_id)
        platform = ""
        try:
            platform = str(await resolve_platform_tenant_id() or "").strip()
        except Exception:
            pass

        # PoreiaGo / customer offices must never inherit Achillio or DEMO pins.
        if tid != demo and (not platform or tid != platform):
            return primary

        extras: list[list[LiveVehicleState]] = []
        seen = {tid}
        if tid == platform and demo not in seen:
            extras.append(await self.list_active_async(UUID(demo)))
            seen.add(demo)
        elif tid == demo and platform and platform not in seen:
            extras.append(await self.list_active_async(UUID(platform)))
            seen.add(platform)

        return self._merge_admin_fleets(primary, *extras)

    def vehicle_meta(self, tenant_id: UUID, vehicle_id: str) -> dict:
        from travel_platform.operations.master_qr_local import DEFAULT_TENANT

        meta = self._vehicles.get(vehicle_id, {})
        meta_tid = str(meta.get("tenant_id") or "")
        want = str(tenant_id)
        if meta_tid == want:
            return meta
        # Only when legacy merge is on: allow DEMO ↔ same vehicle enrichment.
        # Never return a pin belonging to an unrelated SaaS office.
        if self._legacy_merge_allowed():
            if meta_tid == DEFAULT_TENANT and want != DEFAULT_TENANT:
                return meta
            if want == DEFAULT_TENANT and meta_tid and meta_tid != DEFAULT_TENANT:
                return meta
        return {}

    async def vehicle_meta_async(self, tenant_id: UUID, vehicle_id: str) -> dict:
        local = self.vehicle_meta(tenant_id, vehicle_id)
        if local.get("lat") is not None:
            return local
        from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
        from travel_platform.operations.master_qr_local import DEFAULT_TENANT
        from travel_platform.telemetry.live_fleet_redis import load_live_vehicle

        candidates = [str(tenant_id)]
        if self._legacy_merge_allowed():
            if str(tenant_id) != DEFAULT_TENANT:
                candidates.append(DEFAULT_TENANT)
            else:
                try:
                    platform = str(await resolve_platform_tenant_id())
                    if platform and platform not in candidates:
                        candidates.append(platform)
                except Exception:
                    pass

        remote: dict = {}
        for tid in candidates:
            remote = await load_live_vehicle(tid, vehicle_id)
            if remote.get("lat") is not None:
                break
        if remote:
            self._vehicles[vehicle_id] = {**self._vehicles.get(vehicle_id, {}), **remote}
        return remote or local

    async def _broadcast_tracker_pin(self, tenant_id: str, meta: dict[str, Any]) -> None:
        """Push a Teltonika pin to admin maps after shift-end handoff."""
        if meta.get("lat") is None or meta.get("lng") is None:
            return
        try:
            from travel_platform.telemetry.fleet_pubsub import publish_fleet_location
            from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
        except Exception:
            return

        egress = {
            "type": "fleet_location",
            "tenant_id": str(tenant_id),
            "trip_id": meta.get("trip_id"),
            "trip_title": meta.get("trip_title"),
            "driver_id": None,
            "driver_name": meta.get("driver_name"),
            "bus_plate": meta.get("bus_plate") or meta.get("vehicle_code"),
            "vehicle_code": meta.get("vehicle_code"),
            "vehicle_id": meta.get("vehicle_id"),
            "lat": float(meta["lat"]),
            "lng": float(meta["lng"]),
            "speed": float(meta.get("speed_kmh") or meta.get("speed") or 0),
            "heading": meta.get("heading_deg") if meta.get("heading_deg") is not None else meta.get("heading"),
            "timestamp": meta.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            "source": "teltonika",
            "imei": meta.get("imei"),
        }
        await publish_fleet_location(str(tenant_id), egress)
        await get_fleet_egress_hub().broadcast(str(tenant_id), egress)

    async def remove_driver_vehicles(
        self,
        tenant_id: str,
        driver_id: str,
        *,
        extra_tenant_ids: list[str] | None = None,
    ) -> list[str]:
        """
        Drop live vehicles for a driver (end shift).

        Clears memory + Redis for the primary tenant and any extras (demo /
        obsolete seed slug). GPS briefly landed on the wrong Achillio tenant;
        end-shift must wipe every mirror or the admin map keeps showing the pin.

        Teltonika / alive-tracker pins are kept (or handed off from phone GPS).
        """
        from travel_platform.telemetry.live_fleet_redis import (
            delete_live_vehicle,
            load_live_vehicles,
        )

        did = str(driver_id or "").strip()
        if not did:
            return []

        tenants: set[str] = set()
        for raw in [tenant_id, *(extra_tenant_ids or [])]:
            tid = str(raw or "").strip()
            if tid:
                tenants.add(tid)
        if not tenants:
            return []

        removed: list[str] = []
        handed_off: list[str] = []
        seen: set[tuple[str, str]] = set()

        def _is_hardware_pin(meta: dict[str, Any] | None) -> bool:
            """Teltonika / tracker pins survive driver shift-end and stale wipe."""
            src = str((meta or {}).get("source") or "").strip().lower()
            if src.startswith("teltonika") or src in {
                "tracker",
                "test_ping",
                "teltonika_test_ping",
            }:
                return True
            # Bound IMEI with no phone source → treat as hardware.
            if (meta or {}).get("imei") and src not in {"driver_pwa", "app"}:
                return True
            return False

        def _handoff_to_teltonika(tid: str, meta: dict[str, Any]) -> dict[str, Any] | None:
            """
            If this plate has a live Teltonika binding, keep the pin and retag
            it as hardware instead of deleting when the driver app ends.
            """
            try:
                from travel_platform.telemetry.tracker_priority import (
                    is_tracker_binding_alive,
                    resolve_tracker_alive_seconds,
                )
                from travel_platform.telemetry.teltonika.device_store import (
                    get_enabled_device_by_vehicle_code,
                )
            except Exception:
                return None

            plate = str(meta.get("vehicle_code") or meta.get("bus_plate") or "").strip()
            if not plate:
                return None
            tracker = get_enabled_device_by_vehicle_code(tid, plate)
            if not tracker or not is_tracker_binding_alive(
                tracker,
                max_age_sec=resolve_tracker_alive_seconds(tid),
            ):
                return None

            handed = {**meta}
            handed.pop("driver_id", None)
            handed["source"] = "teltonika"
            handed["imei"] = tracker.get("imei") or handed.get("imei")
            handed["driver_name"] = tracker.get("label") or handed.get("driver_name") or plate
            handed["bus_plate"] = handed.get("bus_plate") or plate
            handed["vehicle_code"] = handed.get("vehicle_code") or plate
            # Prefer last hardware fix when phone had overwritten coords.
            if tracker.get("last_lat") is not None and tracker.get("last_lng") is not None:
                handed["lat"] = float(tracker["last_lat"])
                handed["lng"] = float(tracker["last_lng"])
            if tracker.get("last_speed_kmh") is not None:
                handed["speed_kmh"] = float(tracker["last_speed_kmh"])
            if tracker.get("last_seen_at"):
                handed["updated_at"] = tracker["last_seen_at"]
            return handed

        async def _drop(tid: str, vid: str, meta: dict[str, Any] | None = None) -> None:
            from travel_platform.telemetry.live_fleet_redis import save_live_vehicle

            key = (tid, vid)
            if not vid or key in seen:
                return
            row = dict(meta or self._vehicles.get(vid) or {})
            if _is_hardware_pin(row):
                # Still strip phone driver_id so future sweeps ignore this pin.
                cleaned = {**self._vehicles.get(vid, {}), **row}
                cleaned.pop("driver_id", None)
                cleaned["tenant_id"] = tid
                cleaned["vehicle_id"] = vid
                cleaned["source"] = cleaned.get("source") or "teltonika"
                self._vehicles[vid] = cleaned
                try:
                    await save_live_vehicle(cleaned)
                except Exception:
                    pass
                try:
                    await self._broadcast_tracker_pin(tid, cleaned)
                except Exception:
                    pass
                seen.add(key)
                return

            handed = _handoff_to_teltonika(tid, row)
            if handed:
                cleaned = {**self._vehicles.get(vid, {}), **handed}
                cleaned.pop("driver_id", None)
                cleaned["tenant_id"] = tid
                cleaned["vehicle_id"] = vid
                cleaned["source"] = "teltonika"
                self._vehicles[vid] = cleaned
                code = cleaned.get("vehicle_code")
                if code:
                    self._code_index[f"{tid}:{code}"] = vid
                try:
                    await save_live_vehicle(cleaned)
                except Exception:
                    pass
                try:
                    await self._broadcast_tracker_pin(tid, cleaned)
                except Exception:
                    pass
                handed_off.append(vid)
                seen.add(key)
                return

            seen.add(key)
            code = row.get("vehicle_code") or self._vehicles.get(vid, {}).get("vehicle_code")
            self._vehicles.pop(vid, None)
            if code:
                self._code_index.pop(f"{tid}:{code}", None)
            await delete_live_vehicle(tid, vid)
            removed.append(vid)

        for tid in tenants:
            for vid, meta in list(self._vehicles.items()):
                if str(meta.get("tenant_id") or "") != tid:
                    continue
                if str(meta.get("driver_id") or "") != did:
                    continue
                await _drop(tid, vid, meta)

            try:
                remote_rows = await load_live_vehicles(tid)
            except Exception:
                remote_rows = []
            for meta in remote_rows:
                if str(meta.get("driver_id") or "") != did:
                    continue
                vid = str(meta.get("vehicle_id") or "")
                await _drop(tid, vid, meta)

        return removed

    def heatmap_grid(self, tenant_id: UUID, cell_size: float = 0.01) -> list[dict]:
        """Aggregate frequent stopping points for heatmap layer."""
        points = self._heat_points.get(str(tenant_id), [])
        grid: dict[tuple[int, int], int] = defaultdict(int)
        for lat, lng in points:
            cell = (int(lat / cell_size), int(lng / cell_size))
            grid[cell] += 1
        result = []
        for (clat, clng), weight in sorted(grid.items(), key=lambda x: -x[1])[:500]:
            if weight < 3:
                continue
            result.append(
                {
                    "lat": (clat + 0.5) * cell_size,
                    "lng": (clng + 0.5) * cell_size,
                    "weight": weight,
                }
            )
        return result
