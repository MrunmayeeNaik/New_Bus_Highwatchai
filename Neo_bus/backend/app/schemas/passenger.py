from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class SavedPassengerCreate(BaseModel):
    name: str
    age: int
    gender: str

class SavedPassengerOut(SavedPassengerCreate):
    id: UUID
    user_id: UUID
    
    class Config:
        from_attributes = True

class FavoriteRouteCreate(BaseModel):
    route_id: UUID

class FavoriteRouteOut(BaseModel):
    id: UUID
    user_id: UUID
    route_id: UUID
    
    class Config:
        from_attributes = True

class SearchHistoryCreate(BaseModel):
    source_city_id: UUID
    destination_city_id: UUID

class SearchHistoryOut(BaseModel):
    id: UUID
    user_id: UUID
    source_city_id: UUID
    destination_city_id: UUID
    source_city_name: Optional[str] = None
    destination_city_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class EmergencyContactUpdate(BaseModel):
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relation: str

class PassengerProfileOut(BaseModel):
    id: UUID
    email: str
    phone: str
    full_name: str
    reward_points: int
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    wallet_balance: Optional[float] = 0.0
    
    class Config:
        from_attributes = True
