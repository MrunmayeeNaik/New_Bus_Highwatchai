from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class CountryCreate(BaseModel):
    name: str
    code: str

class CountryOut(CountryCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class BusTypeCreate(BaseModel):
    name: str
    code: str

class BusTypeOut(BusTypeCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class SeatTypeCreate(BaseModel):
    name: str
    code: str

class SeatTypeOut(SeatTypeCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class VehicleCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class VehicleCategoryOut(VehicleCategoryCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class TaxCreate(BaseModel):
    name: str
    percentage: float
    is_active: Optional[bool] = True

class TaxOut(TaxCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class CancellationPolicyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    charge_percentage: float
    hours_before_departure: int

class CancellationPolicyOut(CancellationPolicyCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class RefundRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    refund_percentage: float

class RefundRuleOut(RefundRuleCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True
