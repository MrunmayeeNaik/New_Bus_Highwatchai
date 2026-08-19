from typing import List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.support import SupportTicket, AuditLog

class SupportTicketRepository(BaseRepository[SupportTicket]):
    def get_by_status(self, db: Session, status: str) -> List[SupportTicket]:
        return db.query(self.model).filter(SupportTicket.status == status).all()

    def get_user_tickets(self, db: Session, user_id: str) -> List[SupportTicket]:
        return db.query(self.model).filter(SupportTicket.user_id == user_id).all()

class AuditLogRepository(BaseRepository[AuditLog]):
    def get_recent(self, db: Session, limit: int = 100) -> List[AuditLog]:
        return db.query(self.model).order_by(AuditLog.created_at.desc()).limit(limit).all()

ticket_repo = SupportTicketRepository(SupportTicket)
audit_repo = AuditLogRepository(AuditLog)
