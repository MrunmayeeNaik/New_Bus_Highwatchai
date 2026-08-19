import uuid
from sqlalchemy import Column, String, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import AuditModel

class SavedPassenger(AuditModel):
    __tablename__ = "saved_passengers"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    
    # Relationships
    user = relationship("User")

class FavoriteRoute(AuditModel):
    __tablename__ = "favorite_routes"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    user = relationship("User")
    route = relationship("Route")

class SearchHistory(AuditModel):
    __tablename__ = "search_histories"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    destination_city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    user = relationship("User")
    source_city = relationship("City", foreign_keys=[source_city_id])
    destination_city = relationship("City", foreign_keys=[destination_city_id])
