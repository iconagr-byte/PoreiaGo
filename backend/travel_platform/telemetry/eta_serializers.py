"""Serialize ETA snapshots for REST + WebSocket."""

from __future__ import annotations

from travel_platform.telemetry.eta_intelligence import TripEtaSnapshot


def format_eta_display(seconds: int) -> str:
    if seconds < 60:
        return f"Άφιξη σε {seconds} δευτ." if seconds != 1 else "Άφιξη σε 1 δευτ."
    mins = max(1, round(seconds / 60))
    return f"Άφιξη σε {mins} λεπτά"


def snapshot_to_payload(snap: TripEtaSnapshot, *, sync_interval_sec: int = 30) -> dict:
    return {
        "type": "eta_update",
        "trip_id": snap.trip_id,
        "next_stop_name": snap.next_stop_name,
        "eta_seconds": snap.eta_seconds,
        "eta_display": format_eta_display(snap.eta_seconds),
        "distance_m": snap.distance_m,
        "traffic_level": snap.traffic_level,
        "traffic_label": snap.traffic_label,
        "vehicle_lat": snap.vehicle_lat,
        "vehicle_lng": snap.vehicle_lng,
        "computed_at": snap.computed_at.isoformat(),
        "server_sync_interval_sec": sync_interval_sec,
    }
