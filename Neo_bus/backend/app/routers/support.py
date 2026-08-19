from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.schemas.support import SupportTicketCreate, SupportTicketUpdate, SupportTicketOut
from app.services.auth import get_current_active_user, require_roles
from app.models.auth import User
from app.models.support import SupportTicket
from app.repositories import ticket_repo

router = APIRouter(prefix="/support", tags=["Support & Ticketing"])

@router.post("/tickets", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket_in: SupportTicketCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    ticket_data = {
        "user_id": current_user.id,
        "subject": ticket_in.subject,
        "description": ticket_in.description,
        "priority": ticket_in.priority,
        "status": "open"
    }
    return ticket_repo.create(db, obj_in=ticket_data)

@router.get("/tickets", response_model=List[SupportTicketOut])
def get_my_tickets(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return ticket_repo.get_user_tickets(db, current_user.id)

@router.get("/tickets/all", response_model=List[SupportTicketOut])
def get_all_tickets(
    current_user: User = Depends(require_roles(["support", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return ticket_repo.get_multi(db)

@router.put("/tickets/{ticket_id}", response_model=SupportTicketOut)
def update_ticket(
    ticket_id: UUID,
    ticket_in: SupportTicketUpdate,
    current_user: User = Depends(require_roles(["support", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    ticket = ticket_repo.get(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
        
    updated = ticket_repo.update(db, db_obj=ticket, obj_in=ticket_in)
    return updated
