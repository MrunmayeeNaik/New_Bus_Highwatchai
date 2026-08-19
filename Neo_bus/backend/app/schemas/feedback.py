from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class ReviewCreate(BaseModel):
    booking_id: UUID
    rating_bus: float = Field(..., ge=1.0, le=5.0)
    rating_staff: float = Field(..., ge=1.0, le=5.0)
    rating_punctuality: float = Field(..., ge=1.0, le=5.0)
    comment: Optional[str] = None

class ReviewOut(ReviewCreate):
    id: UUID
    user_id: UUID
    trip_id: UUID
    operator_id: UUID
    is_moderated: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationOut(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
