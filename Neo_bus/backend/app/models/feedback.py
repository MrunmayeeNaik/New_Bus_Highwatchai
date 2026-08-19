from sqlalchemy import Column, String, Boolean, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import AuditModel

class Review(AuditModel):
    __tablename__ = "reviews"
    
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id", ondelete="CASCADE"), nullable=False)
    
    rating_bus = Column(Float, nullable=False)
    rating_staff = Column(Float, nullable=False)
    rating_punctuality = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    is_moderated = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    booking = relationship("Booking", back_populates="review")
    user = relationship("User")
    trip = relationship("Trip")
    operator = relationship("Operator")

class Notification(AuditModel):
    __tablename__ = "notifications"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), nullable=False)  # email, sms, push
    status = Column(String(20), default="pending", nullable=False)  # pending, sent, failed
    
    # Relationships
    user = relationship("User")
