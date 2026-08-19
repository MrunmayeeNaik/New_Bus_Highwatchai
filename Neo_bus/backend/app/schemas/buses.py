from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, time

class OperatorCreate(BaseModel):
    name: str
    email: str
    phone: str
    logo_url: Optional[str] = None

class OperatorOut(OperatorCreate):
    id: UUID
    rating: float
    is_active: bool
    review_count: int = 0

    class Config:
        from_attributes = True

class OperatorStaffCreate(BaseModel):
    user_id: UUID
    operator_id: UUID
    designation: str

class OperatorStaffOut(OperatorStaffCreate):
    id: UUID

    class Config:
        from_attributes = True

class AmenityCreate(BaseModel):
    name: str
    icon_class: Optional[str] = None

class AmenityOut(AmenityCreate):
    id: UUID

    class Config:
        from_attributes = True

class SeatCreate(BaseModel):
    seat_number: str
    row: int
    column: int
    seat_type: str  # seater, sleeper
    is_ladies: Optional[bool] = False
    category: Optional[str] = "normal"
    deck: Optional[str] = "lower"

class SeatOut(SeatCreate):
    id: UUID
    bus_id: UUID
    is_blocked: bool

    class Config:
        from_attributes = True

class BusCreate(BaseModel):
    operator_id: UUID
    bus_number: str
    bus_type: str  # AC_Sleeper, AC_Seater, Non_AC_Sleeper, Non_AC_Seater
    capacity: int
    amenity_ids: Optional[List[UUID]] = []
    
    # Custom seats from Layout Builder
    seats: Optional[List[SeatCreate]] = None
    
    # Documents
    rc_number: Optional[str] = None
    insurance_number: Optional[str] = None
    insurance_expiry: Optional[datetime] = None
    fitness_expiry: Optional[datetime] = None
    permit_number: Optional[str] = None
    permit_expiry: Optional[datetime] = None

class BusOut(BaseModel):
    id: UUID
    operator_id: UUID
    bus_number: str
    bus_type: str
    capacity: int
    rating: float
    is_active: bool
    amenities: Optional[List[AmenityOut]] = []
    operator: Optional[OperatorOut] = None
    
    # Documents
    rc_number: Optional[str] = None
    insurance_number: Optional[str] = None
    insurance_expiry: Optional[datetime] = None
    fitness_expiry: Optional[datetime] = None
    permit_number: Optional[str] = None
    permit_expiry: Optional[datetime] = None

    class Config:
        from_attributes = True

class TripCreate(BaseModel):
    bus_id: UUID
    operator_id: UUID
    route_id: UUID
    departure_time: datetime
    arrival_time: datetime
    price: float
    discount_price: Optional[float] = None
    
    # Dynamic Pricing Config
    use_dynamic_pricing: Optional[bool] = False
    dynamic_pricing_type: Optional[str] = "occupancy"

class TripOut(BaseModel):
    id: UUID
    bus_id: UUID
    operator_id: UUID
    route_id: UUID
    departure_time: datetime
    arrival_time: datetime
    price: float
    discount_price: Optional[float] = None
    status: str
    bus: Optional[BusOut] = None
    operator: Optional[OperatorOut] = None
    available_seats_count: Optional[int] = None
    
    # Dynamic Pricing Config
    use_dynamic_pricing: bool
    dynamic_pricing_type: str

    class Config:
        from_attributes = True

class TripSearchFilter(BaseModel):
    source_city_id: UUID
    destination_city_id: UUID
    journey_date: datetime  # we will match start and end of this date
    bus_type: Optional[str] = None
    max_price: Optional[float] = None
    min_rating: Optional[float] = None
    departure_time_bucket: Optional[str] = None  # morning, afternoon, evening, night
