from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class BookingBase(BaseModel):
    trip_id: int
    customer_id: int
    seat_number: str
    price: float

class BookingCreate(BookingBase):
    pass

class BookingUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(PENDING|CONFIRMED|CANCELLED)$")

class BookingReassignSeat(BaseModel):
    booking_id: int
    new_seat_number: str

class BookingResponse(BookingBase):
    id: int
    tenant_id: int
    status: str
    aade_mark: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

class PaginatedBookings(BaseModel):
    total: int
    page: int
    size: int
    items: List[BookingResponse]
