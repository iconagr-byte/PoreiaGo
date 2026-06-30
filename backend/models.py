"""
Legacy sync models (Integer PKs) — prefer `app/models/` for new SaaS work.

Canonical multi-tenant schema: backend/app/models/ + Alembic migrations.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class Booking(Base):
    __tablename__ = 'bookings'
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, index=True, nullable=False) # Multi-tenancy isolation
    trip_id = Column(Integer, nullable=False)
    customer_id = Column(Integer, nullable=False)
    seat_number = Column(String(10), nullable=False)
    status = Column(String(20), default="PENDING") # PENDING, CONFIRMED, CANCELLED
    price = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    aade_mark = Column(String(100), nullable=True) # AADE Registration Number

class StopFeedback(Base):
    __tablename__ = 'stop_feedback'
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey('bookings.id'))
    stop_id = Column(Integer, nullable=False)
    rating = Column(Integer, nullable=False) # 1 to 5
    metadata_tags = Column(JSON, nullable=True) # e.g. ["Expensive", "Slow Service"]
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
