from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from typing import Annotated, Optional

from core.dependencies import get_tenant_id
from ..schemas import BookingReassignSeat, BookingUpdateStatus
from ..services.aade import transmit_invoice_to_aade

router = APIRouter(prefix="/api/v1/admin/bookings", tags=["bookings"])

# Mock Redis connection
class MockRedis:
    def __init__(self):
        self.store = {}

    async def setex(self, key: str, seconds: int, value: str):
        self.store[key] = value
        # In reality, Redis handles TTL automatically.

    async def get(self, key: str):
        return self.store.get(key)

redis_client = MockRedis()

@router.get("/")
async def get_bookings(
    page: int = 1, 
    size: int = 10, 
    status: Optional[str] = None,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    """
    Fetch paginated bookings.
    tenant_id από JWT (TenantContextMiddleware) — κάθε query πρέπει να φιλτράρεται.
    """
    return {
        "total": 0,
        "page": page,
        "size": size,
        "items": []
    }

@router.patch("/{booking_id}")
async def update_booking_status(
    booking_id: int, 
    update_data: BookingUpdateStatus,
    background_tasks: BackgroundTasks,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    """
    Update a booking's status.
    If status becomes CONFIRMED/PAID, trigger async AADE transmission.
    """
    if update_data.status == "CONFIRMED":
        # Offload AADE integration to a background task so we don't block the API response
        background_tasks.add_task(transmit_invoice_to_aade, str(tenant_id), booking_id, 150.00)
    
    return {"message": f"Booking {booking_id} status updated to {update_data.status}"}

@router.post("/hold-seat")
async def hold_seat(
    trip_id: int, 
    seat_id: str, 
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    """
    Implements Reservation Expiry using Redis TTL.
    Holds a seat for 15 minutes (900 seconds).
    """
    lock_key = f"tenant:{tenant_id}:trip:{trip_id}:seat:{seat_id}:lock"
    
    # Check if seat is already held
    existing_hold = await redis_client.get(lock_key)
    if existing_hold:
        raise HTTPException(status_code=409, detail="Seat is currently held by another user.")
    
    # Hold the seat with a 15 minute TTL
    await redis_client.setex(lock_key, 900, "held")
    return {"message": "Seat held for 15 minutes."}

@router.post("/reassign-seat")
async def reassign_seat(
    reassign_data: BookingReassignSeat,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    return {"message": f"Seat reassigned to {reassign_data.new_seat_number} for booking {reassign_data.booking_id}"}
