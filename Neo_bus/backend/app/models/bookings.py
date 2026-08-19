from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import AuditModel

class Booking(AuditModel):
    __tablename__ = "bookings"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=True)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=True)
    boarding_point_id = Column(UUID(as_uuid=True), ForeignKey("trip_points.id"), nullable=True)
    dropping_point_id = Column(UUID(as_uuid=True), ForeignKey("trip_points.id"), nullable=True)
    
    booking_number = Column(String(50), unique=True, nullable=False, index=True)
    journey_date = Column(DateTime(timezone=True), nullable=True)
    passenger_count = Column(Integer, default=1, nullable=False)
    base_fare = Column(Float, default=0.0, nullable=False)
    tax = Column(Float, default=0.0, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)
    wallet_used = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    final_amount = Column(Float, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, confirmed, cancelled, failed
    payment_status = Column(String(20), default="pending", nullable=False)  # pending, paid, refunded
    ticket_status = Column(String(20), default="active", nullable=False)  # active, cancelled
    pnr = Column(String(20), unique=True, nullable=False, index=True)
    
    # Relationships
    user = relationship("User")
    trip = relationship("Trip", back_populates="bookings")
    coupon = relationship("Coupon")
    operator = relationship("Operator")
    boarding_point = relationship("TripPoint", foreign_keys=[boarding_point_id])
    dropping_point = relationship("TripPoint", foreign_keys=[dropping_point_id])
    passengers = relationship("BookingPassenger", back_populates="booking", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")
    review = relationship("Review", back_populates="booking", uselist=False, cascade="all, delete-orphan")
    refunds = relationship("Refund", back_populates="booking", cascade="all, delete-orphan")

class BookingPassenger(AuditModel):
    __tablename__ = "booking_passengers"
    
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    seat_id = Column(UUID(as_uuid=True), ForeignKey("seats.id"), nullable=False)
    passenger_name = Column(String(100), nullable=False)
    passenger_age = Column(Integer, nullable=False)
    passenger_gender = Column(String(10), nullable=False)  # male, female, other
    ticket_number = Column(String(50), unique=True, nullable=False, index=True)
    
    mobile = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    id_proof = Column(String(100), nullable=True)
    emergency_contact = Column(String(20), nullable=True)
    
    # Relationships
    booking = relationship("Booking", back_populates="passengers")
    seat = relationship("Seat", back_populates="booking_passengers")

class Payment(AuditModel):
    __tablename__ = "payments"
    
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)
    payment_gateway = Column(String(50), nullable=False)  # razorpay, stripe, wallet, upi, netbanking, creditcard, debitcard
    amount = Column(Float, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, success, failed
    payload = Column(Text, nullable=True)  # JSON raw response string
    
    # Relationships
    booking = relationship("Booking", back_populates="payments")

class Coupon(AuditModel):
    __tablename__ = "coupons"
    
    code = Column(String(50), unique=True, nullable=False, index=True)
    discount_type = Column(String(20), nullable=False)  # percentage, flat
    discount_value = Column(Float, nullable=False)
    min_booking_amount = Column(Float, default=0.0, nullable=False)
    max_discount = Column(Float, default=0.0, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    is_first_booking = Column(Boolean, default=False, nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=True)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=True)
    usage_limit = Column(Integer, default=0, nullable=False)
    used_count = Column(Integer, default=0, nullable=False)

class Refund(AuditModel):
    __tablename__ = "refunds"
    
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=True)
    refund_amount = Column(Float, nullable=False)
    refund_type = Column(String(20), nullable=False)  # wallet, original_payment
    status = Column(String(20), default="pending", nullable=False)  # pending, success, failed
    refund_id = Column(String(100), nullable=True)
    
    booking = relationship("Booking", back_populates="refunds")
