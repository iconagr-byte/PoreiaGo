"""Εξαγωγή διαδρομής σε GPX / KML."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from html import escape
from typing import Any


def _route_name(trip_id: int, label: str | None = None) -> str:
    base = label or f"Trip {trip_id}"
    return escape(str(base))


def build_gpx(trip_id: int, points: list[dict[str, Any]], *, name: str | None = None) -> str:
    gpx_ns = "http://www.topografix.com/GPX/1/1"
    ET.register_namespace("", gpx_ns)
    root = ET.Element(f"{{{gpx_ns}}}gpx", attrib={"version": "1.1", "creator": "OLYMPUS Fleet Telemetry"})
    trk = ET.SubElement(root, f"{{{gpx_ns}}}trk")
    ET.SubElement(trk, f"{{{gpx_ns}}}name").text = name or f"Trip {trip_id}"
    seg = ET.SubElement(trk, f"{{{gpx_ns}}}trkseg")

    for pt in points:
        trkpt = ET.SubElement(
            seg,
            f"{{{gpx_ns}}}trkpt",
            attrib={"lat": f"{float(pt['lat']):.7f}", "lon": f"{float(pt['lng']):.7f}"},
        )
        recorded = pt.get("recorded_at")
        if recorded:
            ET.SubElement(trkpt, f"{{{gpx_ns}}}time").text = str(recorded).replace(" ", "T")
        speed = pt.get("speed_kmh")
        if speed is not None:
            try:
                ET.SubElement(trkpt, f"{{{gpx_ns}}}speed").text = f"{float(speed) / 3.6:.2f}"
            except (TypeError, ValueError):
                pass

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


def build_kml(trip_id: int, points: list[dict[str, Any]], *, name: str | None = None) -> str:
    kml_ns = "http://www.opengis.net/kml/2.2"
    ET.register_namespace("", kml_ns)
    root = ET.Element(f"{{{kml_ns}}}kml")
    doc = ET.SubElement(root, f"{{{kml_ns}}}Document")
    ET.SubElement(doc, f"{{{kml_ns}}}name").text = name or f"Trip {trip_id}"

    coords = " ".join(f"{float(pt['lng']):.7f},{float(pt['lat']):.7f},0" for pt in points)
    placemark = ET.SubElement(doc, f"{{{kml_ns}}}Placemark")
    ET.SubElement(placemark, f"{{{kml_ns}}}name").text = f"Route trip {trip_id}"
    line = ET.SubElement(placemark, f"{{{kml_ns}}}LineString")
    ET.SubElement(line, f"{{{kml_ns}}}tessellate").text = "1"
    ET.SubElement(line, f"{{{kml_ns}}}coordinates").text = coords

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


def export_route_document(
    trip_id: int,
    points: list[dict[str, Any]],
    *,
    fmt: str,
    name: str | None = None,
) -> tuple[str, str, str]:
    """Επιστρέφει (content, media_type, filename)."""
    normalized = fmt.lower().strip()
    if normalized == "gpx":
        return (
            build_gpx(trip_id, points, name=name),
            "application/gpx+xml",
            f"trip-{trip_id}.gpx",
        )
    if normalized == "kml":
        return (
            build_kml(trip_id, points, name=name),
            "application/vnd.google-earth.kml+xml",
            f"trip-{trip_id}.kml",
        )
    raise ValueError(f"Unsupported format: {fmt}")
