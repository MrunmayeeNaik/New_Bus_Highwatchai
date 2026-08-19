from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Table, DateTime, Time, Date, Index, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import AuditModel
from app.core.database import Base

# Association table for Many-to-Many between Bus and Amenity
bus_amenities = Table(
    "bus_amenities",
    Base.metadata,
    Column("bus_id", UUID(as_uuid=True), ForeignKey("buses.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", UUID(as_uuid=True), ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)

class Operator(AuditModel):
    __tablename__ = "operators"
    
    name = Column(String(100), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    logo_url = Column(String(255), nullable=True)
    rating = Column(Float, default=5.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    staff = relationship("OperatorStaff", back_populates="operator", cascade="all, delete-orphan")
    buses = relationship("Bus", back_populates="operator", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="operator", cascade="all, delete-orphan")

class OperatorStaff(AuditModel):
    __tablename__ = "operator_staff"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id", ondelete="CASCADE"), nullable=False)
    designation = Column(String(50), nullable=False)  # manager, driver, conductor
    
    # Relationships
    user = relationship("User", back_populates="staff_member")
    operator = relationship("Operator", back_populates="staff")

class State(AuditModel):
    __tablename__ = "states"
    
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)
    
    # Relationships
    cities = relationship("City", back_populates="state", cascade="all, delete-orphan")

class City(AuditModel):
    __tablename__ = "cities"
    
    state_id = Column(UUID(as_uuid=True), ForeignKey("states.id"), nullable=False)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    state = relationship("State", back_populates="cities")
    stops = relationship("Stop", back_populates="city", cascade="all, delete-orphan")

class Route(AuditModel):
    __tablename__ = "routes"
    
    __table_args__ = (
        Index("idx_routes_search_composite", "source_city_id", "destination_city_id", "is_active"),
    )
    
    source_city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id"), nullable=False)
    destination_city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    source_city = relationship("City", foreign_keys=[source_city_id])
    destination_city = relationship("City", foreign_keys=[destination_city_id])
    stops = relationship("Stop", back_populates="route", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="route", cascade="all, delete-orphan")

class Stop(AuditModel):
    __tablename__ = "stops"
    
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id"), nullable=False)
    stop_name = Column(String(100), nullable=False)
    landmark = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    sequence_number = Column(Integer, nullable=False)
    duration_from_start = Column(Integer, nullable=False)  # minutes from departure
    
    # Relationships
    route = relationship("Route", back_populates="stops")
    city = relationship("City", back_populates="stops")

class Bus(AuditModel):
    __tablename__ = "buses"
    
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id", ondelete="CASCADE"), nullable=False)
    bus_number = Column(String(50), unique=True, nullable=False, index=True)
    bus_type = Column(String(50), nullable=False)  # AC_Sleeper, AC_Seater, Non_AC_Sleeper, Non_AC_Seater
    capacity = Column(Integer, nullable=False)
    rating = Column(Float, default=5.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Bus Documents
    rc_number = Column(String(50), nullable=True)
    insurance_number = Column(String(50), nullable=True)
    insurance_expiry = Column(DateTime, nullable=True)
    fitness_expiry = Column(DateTime, nullable=True)
    permit_number = Column(String(50), nullable=True)
    permit_expiry = Column(DateTime, nullable=True)
    
    # Relationships
    operator = relationship("Operator", back_populates="buses")
    amenities = relationship("Amenity", secondary=bus_amenities, back_populates="buses")
    seats = relationship("Seat", back_populates="bus", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="bus", cascade="all, delete-orphan")

class Amenity(AuditModel):
    __tablename__ = "amenities"
    
    name = Column(String(50), unique=True, nullable=False, index=True)
    icon_class = Column(String(50), nullable=True)
    
    # Relationships
    buses = relationship("Bus", secondary=bus_amenities, back_populates="amenities")

class Seat(AuditModel):
    __tablename__ = "seats"
    
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id", ondelete="CASCADE"), nullable=False)
    seat_number = Column(String(10), nullable=False)
    row = Column(Integer, nullable=False)
    column = Column(Integer, nullable=False)
    seat_type = Column(String(20), default="seater", nullable=False)  # seater, sleeper
    is_ladies = Column(Boolean, default=False, nullable=False)
    is_blocked = Column(Boolean, default=False, nullable=False)
    category = Column(String(30), default="normal", nullable=False)  # normal, premium, luxury, sleeper, semi_sleeper, ladies, vip, emergency, wheelchair
    deck = Column(String(10), default="lower", nullable=False)  # lower, upper
    
    # Relationships
    bus = relationship("Bus", back_populates="seats")
    booking_passengers = relationship("BookingPassenger", back_populates="seat")

class Trip(AuditModel):
    __tablename__ = "trips"
    
    __table_args__ = (
        Index("idx_trips_search_composite", "route_id", "departure_time", "status", "deleted_at"),
    )
    
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id", ondelete="CASCADE"), nullable=False)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id", ondelete="CASCADE"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    departure_time = Column(DateTime(timezone=True), nullable=False)
    arrival_time = Column(DateTime(timezone=True), nullable=False)
    price = Column(Float, nullable=False)
    discount_price = Column(Float, nullable=True)
    status = Column(String(20), default="scheduled", nullable=False)  # scheduled, active, completed, cancelled
    
    # Dynamic Pricing Config
    use_dynamic_pricing = Column(Boolean, default=False, nullable=False)
    dynamic_pricing_type = Column(String(20), default="occupancy", nullable=False)
    
    # Relationships
    bus = relationship("Bus", back_populates="trips")
    operator = relationship("Operator", back_populates="trips")
    route = relationship("Route", back_populates="trips")
    bookings = relationship("Booking", back_populates="trip")
    seat_locks = relationship("SeatLock", back_populates="trip", cascade="all, delete-orphan")
    trip_points = relationship("TripPoint", back_populates="trip", cascade="all, delete-orphan")

class Schedule(AuditModel):
    __tablename__ = "schedules"
    
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    days_of_week = Column(String(50), nullable=False)  # "Mon,Tue,Wed"

class SeatLock(AuditModel):
    __tablename__ = "seat_locks"
    
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    seat_id = Column(UUID(as_uuid=True), ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    locked_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    trip = relationship("Trip", back_populates="seat_locks")
    seat = relationship("Seat")
    user = relationship("User")

class TripPoint(AuditModel):
    __tablename__ = "trip_points"
    
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    point_name = Column(String(100), nullable=False)
    point_type = Column(String(20), nullable=False)  # boarding, dropping
    time = Column(DateTime(timezone=True), nullable=False)
    landmark = Column(String(100), nullable=True)
    gps_coordinates = Column(String(100), nullable=True)
    pickup_instructions = Column(Text, nullable=True)
    
    # Relationships
    trip = relationship("Trip", back_populates="trip_points")
