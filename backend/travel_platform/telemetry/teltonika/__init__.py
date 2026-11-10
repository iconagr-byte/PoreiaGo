"""Teltonika GPS tracker ingest (Codec 8 TCP + IMEI bindings)."""

from travel_platform.telemetry.teltonika.device_store import (
    ACHILLIO_DEFAULT_TRACKERS,
    delete_device,
    ensure_office_default_trackers,
    get_device_by_imei,
    get_enabled_device_by_vehicle_code,
    list_devices,
    normalize_imei,
    rebind_device_to_tenant,
    touch_device,
    upsert_device,
)
from travel_platform.telemetry.teltonika.tcp_server import (
    get_teltonika_status,
    is_imei_tcp_connected,
    start_teltonika_tcp_server,
    stop_teltonika_tcp_server,
)

__all__ = [
    "ACHILLIO_DEFAULT_TRACKERS",
    "delete_device",
    "ensure_office_default_trackers",
    "get_device_by_imei",
    "get_enabled_device_by_vehicle_code",
    "get_teltonika_status",
    "is_imei_tcp_connected",
    "list_devices",
    "normalize_imei",
    "rebind_device_to_tenant",
    "start_teltonika_tcp_server",
    "stop_teltonika_tcp_server",
    "touch_device",
    "upsert_device",
]
