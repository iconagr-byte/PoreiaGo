import redis.asyncio as aioredis
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models import Booking
from fastapi import HTTPException

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
LOCK_TTL = 600 # 10 minutes

async def lock_seats_temporarily(trip_id: int, seat_ids: list[int], wp_user_id: int):
    """Phase 1: Fast Redis In-Memory Lock (10 minutes)"""
    pipeline = redis_client.pipeline()
    keys = [f"seat_lock:{trip_id}:{seat_id}" for seat_id in seat_ids]
    
    existing_locks = await redis_client.mget(keys)
    if any(existing_locks):
        raise HTTPException(status_code=409, detail="One or more seats are currently locked.")
    
    for key in keys:
        pipeline.setex(key, LOCK_TTL, wp_user_id)
    await pipeline.execute()
    return {"message": "Seats locked for 10 minutes.", "locked_seats": seat_ids}

async def confirm_booking_db(db: AsyncSession, trip_id: int, seat_ids: list[int], user_id: int):
    """Phase 2: Atomic DB Transaction with Pessimistic Locking"""
    try:
        stmt = select(Booking).where(
            Booking.trip_id == trip_id, 
            Booking.seat_id.in_(seat_ids)
        ).with_for_update(nowait=True)
        
        result = await db.execute(stmt)
        existing = result.scalars().all()
        if existing:
            raise Exception("Race condition avoided: Seat already booked in DB.")
        
        for seat_id in seat_ids:
            booking = Booking(trip_id=trip_id, user_id=user_id, seat_id=seat_id)
            db.add(booking)
            
        await db.commit()
        
        keys = [f"seat_lock:{trip_id}:{s_id}" for s_id in seat_ids]
        await redis_client.delete(*keys)
        
        return {"status": "success", "message": "Booking confirmed successfully."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
