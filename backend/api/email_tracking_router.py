"""Public tracking — open pixel, click redirect, unsubscribe."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, Response

from email_client.store import record_click, record_open, unsubscribe_by_token

router = APIRouter(tags=["Email Tracking"])

_PIXEL = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!"
    b"\x0c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


@router.get("/api/track/open/{token}.gif")
async def track_open(token: str):
    await record_open(token)
    return Response(content=_PIXEL, media_type="image/gif")


@router.get("/api/track/click/{token}")
async def track_click(token: str, url: str = ""):
    await record_click(token)
    if url and url.startswith(("http://", "https://")):
        return RedirectResponse(url=url, status_code=302)
    raise HTTPException(status_code=400, detail="Missing or invalid url")


@router.get("/api/unsubscribe/{token}")
async def unsubscribe(token: str):
    ok = await unsubscribe_by_token(token)
    html = (
        "<html><body style='font-family:sans-serif;padding:40px;text-align:center'>"
        + (
            "<h2>Η διαγραφή ολοκληρώθηκε</h2><p>Δεν θα λαμβάνετε πλέον marketing emails.</p>"
            if ok
            else "<h2>Μη έγκυρος σύνδεσμος</h2>"
        )
        + "</body></html>"
    )
    return Response(content=html, media_type="text/html; charset=utf-8")
