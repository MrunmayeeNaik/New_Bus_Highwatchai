from sqlalchemy import Column, String, Boolean, Float, Integer
from app.models.base import AuditModel

class Country(AuditModel):
    __tablename__ = "countries"
    
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)

class BusType(AuditModel):
    __tablename__ = "bus_types"
    
    name = Column(String(50), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)

class SeatType(AuditModel):
    __tablename__ = "seat_types"
    
    name = Column(String(50), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)

class VehicleCategory(AuditModel):
    __tablename__ = "vehicle_categories"
    
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

class Tax(AuditModel):
    __tablename__ = "taxes"
    
    name = Column(String(50), unique=True, nullable=False, index=True)
    percentage = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

class CancellationPolicy(AuditModel):
    __tablename__ = "cancellation_policies"
    
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    charge_percentage = Column(Float, nullable=False)
    hours_before_departure = Column(Integer, nullable=False)

class RefundRule(AuditModel):
    __tablename__ = "refund_rules"
    
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    refund_percentage = Column(Float, nullable=False)
