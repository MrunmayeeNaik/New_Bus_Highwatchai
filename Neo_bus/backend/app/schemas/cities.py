from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class StateCreate(BaseModel):
    name: str
    code: str

class StateOut(StateCreate):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class CityCreate(BaseModel):
    name: str
    code: str
    state_id: UUID

class CityOut(BaseModel):
    id: UUID
    name: str
    code: str
    state_id: UUID
    is_active: bool
    state: Optional[StateOut] = None

    class Config:
        from_attributes = True

class StopCreate(BaseModel):
    city_id: UUID
    stop_name: str
    landmark: Optional[str] = None
    address: Optional[str] = None
    sequence_number: int
    duration_from_start: int

class StopOut(StopCreate):
    id: UUID
    city: Optional[CityOut] = None

    class Config:
        from_attributes = True

class RouteCreate(BaseModel):
    source_city_id: UUID
    destination_city_id: UUID
    distance_km: float
    duration_minutes: int

class RouteOut(RouteCreate):
    id: UUID
    is_active: bool
    source_city: Optional[CityOut] = None
    destination_city: Optional[CityOut] = None
    stops: Optional[List[StopOut]] = None

    class Config:
        from_attributes = True
