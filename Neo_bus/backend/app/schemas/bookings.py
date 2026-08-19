from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.buses import TripOut, SeatOut

class SeatLockRequest(BaseModel):
    trip_id: UUID
    seat_ids: List[UUID]

class SeatLockOut(BaseModel):
    id: UUID
    trip_id: UUID
    seat_id: UUID
    user_id: UUID
    locked_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True

class TripPointOut(BaseModel):
    id: UUID
    trip_id: UUID
    point_name: str
    point_type: str
    time: datetime
    landmark: Optional[str] = None
    gps_coordinates: Optional[str] = None
    pickup_instructions: Optional[str] = None

    class Config:
        from_attributes = True

class BookingPassengerCreate(BaseModel):
    seat_id: UUID
    passenger_name: str
    passenger_age: int
    passenger_gender: str  # male, female, other
    mobile: Optional[str] = None
    email: Optional[str] = None
    id_proof: Optional[str] = None
    emergency_contact: Optional[str] = None

class BookingPassengerOut(BaseModel):
    id: UUID
    passenger_name: str
    passenger_age: int
    passenger_gender: str
    ticket_number: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    id_proof: Optional[str] = None
    emergency_contact: Optional[str] = None
    seat: Optional[SeatOut] = None

    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    trip_id: UUID
    passengers: List[BookingPassengerCreate]
    coupon_code: Optional[str] = None
    use_wallet: Optional[bool] = False
    boarding_point_id: Optional[UUID] = None
    dropping_point_id: Optional[UUID] = None

class BookingOut(BaseModel):
    id: UUID
    user_id: UUID
    trip_id: UUID
    coupon_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    boarding_point_id: Optional[UUID] = None
    dropping_point_id: Optional[UUID] = None
    booking_number: str
    journey_date: Optional[datetime] = None
    passenger_count: int
    base_fare: float
    tax: float
    discount: float
    wallet_used: float
    total_amount: float
    discount_amount: float
    final_amount: float
    status: str  # pending, confirmed, cancelled, failed
    payment_status: str  # pending, paid, refunded
    ticket_status: str
    pnr: str
    created_at: datetime
    passengers: List[BookingPassengerOut] = []
    trip: Optional[TripOut] = None
    boarding_point: Optional[TripPointOut] = None
    dropping_point: Optional[TripPointOut] = None

    class Config:
        from_attributes = True

class CouponCreate(BaseModel):
    code: str
    discount_type: str  # percentage, flat
    discount_value: float
    min_booking_amount: float
    max_discount: float
    expires_at: datetime

class CouponOut(CouponCreate):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True

class PaymentRequest(BaseModel):
    booking_id: UUID
    payment_gateway: str  # stripe, razorpay, wallet
    transaction_id: str
    amount: float
    status: Optional[str] = "success"

class PaymentOut(BaseModel):
    id: UUID
    booking_id: UUID
    transaction_id: str
    payment_gateway: str
    amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class CancellationRequest(BaseModel):
    booking_id: UUID
    passenger_ids: Optional[List[UUID]] = None  # null/empty means cancel full booking
