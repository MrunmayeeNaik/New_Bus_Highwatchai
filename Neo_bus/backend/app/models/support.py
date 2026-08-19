from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import AuditModel

class SupportTicket(AuditModel):
    __tablename__ = "support_tickets"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    subject = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    status = Column(String(20), default="open", nullable=False)  # open, in_progress, resolved, closed
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])

class AuditLog(AuditModel):
    __tablename__ = "audit_logs"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # create, update, delete, login, logout
    table_name = Column(String(50), nullable=True)
    record_id = Column(UUID(as_uuid=True), nullable=True)
    old_values = Column(Text, nullable=True)  # JSON representation of old record
    new_values = Column(Text, nullable=True)  # JSON representation of new record
    ip_address = Column(String(45), nullable=True)
    
    # Relationships
    user = relationship("User")
