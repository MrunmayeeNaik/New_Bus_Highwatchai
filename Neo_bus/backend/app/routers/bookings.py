from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import asyncio

from app.core.database import get_db
from app.schemas.bookings import (
    SeatLockRequest, SeatLockOut, BookingCreate, BookingOut, PaymentRequest, CancellationRequest, CouponOut, TripPointOut
)
from app.models.bookings import Booking
from app.schemas.buses import TripOut
from app.services.bookings import booking_service
from app.services.auth import get_current_active_user
from app.models.auth import User
from app.repositories import booking_repo, coupon_repo

class SSEManager:
    def __init__(self):
        self.connections = []

    def subscribe(self, queue: asyncio.Queue):
        self.connections.append(queue)

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.connections:
            self.connections.remove(queue)

    async def broadcast(self, message: str):
        # Notify all active SSE listeners
        for queue in self.connections:
            await queue.put(message)

sse_manager = SSEManager()

router = APIRouter(prefix="/bookings", tags=["Bookings & Seats Engine"])

@router.get("/search", response_model=List[TripOut])
def search_trips(
    source_city_id: UUID,
    destination_city_id: UUID,
    journey_date: str,  # format YYYY-MM-DD
    bus_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    departure_period: Optional[str] = None,
    arrival_period: Optional[str] = None,
    min_rating: Optional[float] = None,
    amenities: Optional[str] = None, # Comma-separated list of amenity names
    operator_name: Optional[str] = None,
    min_available_seats: Optional[int] = None,
    sort_by: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    if source_city_id == destination_city_id:
        raise HTTPException(status_code=400, detail="Source and destination cities cannot be the same.")
        
    try:
        parsed_date = datetime.strptime(journey_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
    now = datetime.now(timezone.utc)
    journey_date_min = datetime.combine(parsed_date.date(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_min = datetime.combine(now.date(), datetime.min.time()).replace(tzinfo=timezone.utc)
    if journey_date_min < today_min:
        raise HTTPException(status_code=400, detail="Journey date cannot be in the past.")
        
    if min_price is not None and min_price < 0:
        raise HTTPException(status_code=400, detail="Minimum price cannot be negative.")
    if max_price is not None and max_price < 0:
        raise HTTPException(status_code=400, detail="Maximum price cannot be negative.")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=400, detail="Minimum price cannot be greater than maximum price.")
        
    amenities_list = None
    if amenities:
        amenities_list = [a.strip() for a in amenities.split(",") if a.strip()]
        
    return booking_service.search_trips(
        db,
        source_city_id=source_city_id,
        destination_city_id=destination_city_id,
        journey_date=parsed_date,
        bus_type=bus_type,
        min_price=min_price,
        max_price=max_price,
        departure_period=departure_period,
        arrival_period=arrival_period,
        min_rating=min_rating,
        amenities=amenities_list,
        operator_name=operator_name,
        min_available_seats=min_available_seats,
        sort_by=sort_by,
        limit=limit,
        offset=offset
    )

@router.get("/seats/layout/{trip_id}")
def get_seat_layout(trip_id: UUID, db: Session = Depends(get_db)):
    return booking_service.get_trip_seat_layout(db, trip_id)

@router.get("/seats/live")
async def live_seat_status():
    queue = asyncio.Queue()
    sse_manager.subscribe(queue)
    
    async def event_generator():
        try:
            # Yield initial SSE connection success trigger
            yield "data: connected\n\n"
            while True:
                message = await queue.get()
                yield f"data: {message}\n\n"
        except asyncio.CancelledError:
            sse_manager.unsubscribe(queue)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/seats/lock", response_model=List[SeatLockOut])
def lock_seats(
    req: SeatLockRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return booking_service.lock_seats(db, current_user.id, req.trip_id, req.seat_ids)

@router.post("/seats/unlock", status_code=status.HTTP_200_OK)
def unlock_seats(
    req: SeatLockRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    booking_service.unlock_seats(db, current_user.id, req.trip_id, req.seat_ids)
    return {"detail": "Seats unlocked successfully"}

@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking_in: BookingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return booking_service.create_booking(db, current_user.id, booking_in)

@router.post("/payment", response_model=BookingOut)
def verify_payment(
    req: PaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return booking_service.process_booking_payment(db, current_user.id, req)

@router.get("/history", response_model=List[BookingOut])
def get_booking_history(
    booking_id: Optional[UUID] = None,
    pnr: Optional[str] = None,
    journey_date: Optional[str] = None,
    route_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(Booking).filter(Booking.user_id == current_user.id)
    if booking_id:
        query = query.filter(Booking.id == booking_id)
    if pnr:
        query = query.filter(Booking.pnr.ilike(f"%{pnr}%"))
    if route_id:
        from app.models.buses import Trip
        query = query.join(Trip).filter(Trip.route_id == route_id)
    if journey_date:
        try:
            parsed_date = datetime.strptime(journey_date, "%Y-%m-%d").date()
            from sqlalchemy import func
            query = query.filter(func.date(Booking.journey_date) == parsed_date)
        except ValueError:
            pass
    return query.order_by(Booking.created_at.desc()).all()

@router.get("/trips/{trip_id}/points", response_model=List[TripPointOut])
def get_trip_points(trip_id: UUID, db: Session = Depends(get_db)):
    from app.models.buses import TripPoint
    return db.query(TripPoint).filter(TripPoint.trip_id == trip_id).all()

@router.post("/{booking_id}/retry")
def retry_booking_payment(
    booking_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return booking_service.retry_payment(db, current_user.id, booking_id)

@router.get("/{booking_id}/ticket")
def download_ticket(
    booking_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    from app.services.pdf_generator import PDFGenerator
    pdf_bytes = PDFGenerator.generate_ticket_pdf(booking)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=ticket_{booking.booking_number}.pdf"
    })

@router.get("/{booking_id}/invoice")
def download_invoice(
    booking_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    from app.services.pdf_generator import PDFGenerator
    pdf_bytes = PDFGenerator.generate_invoice_pdf(booking)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=invoice_{booking.booking_number}.pdf"
    })

@router.post("/cancel", response_model=BookingOut)
def cancel_ticket(
    req: CancellationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return booking_service.cancel_ticket(db, current_user.id, req)

@router.get("/coupon/{code}", response_model=CouponOut)
def validate_coupon(code: str, db: Session = Depends(get_db)):
    coupon = coupon_repo.get_by_code(db, code)
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid or expired coupon code.")
    return coupon
