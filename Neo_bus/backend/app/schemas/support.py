from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class SupportTicketCreate(BaseModel):
    subject: str
    description: str
    priority: Optional[str] = "medium"  # low, medium, high

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None  # open, in_progress, resolved, closed
    assigned_to_user_id: Optional[UUID] = None

class SupportTicketOut(BaseModel):
    id: UUID
    user_id: UUID
    assigned_to_user_id: Optional[UUID] = None
    subject: str
    description: str
    priority: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    table_name: Optional[str] = None
    record_id: Optional[UUID] = None
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
