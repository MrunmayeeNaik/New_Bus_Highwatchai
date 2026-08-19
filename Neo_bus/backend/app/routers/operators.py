from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.schemas.buses import BusCreate, BusOut, TripCreate, TripOut
from app.schemas.auth import OperatorRegisterRequest
from app.services.bookings import booking_service
from app.services.auth import require_roles
from app.models.auth import User, Role
from app.models.buses import Bus, Trip, Seat, Operator, OperatorStaff
from app.models.bookings import Booking, BookingPassenger
from app.core.security import get_password_hash

router = APIRouter(prefix="/operator", tags=["Bus Operator Operations"])

@router.get("/my-operator")
def get_my_operator(
    current_user: User = Depends(require_roles(["operator", "operator_staff"])),
    db: Session = Depends(get_db)
):
    staff = db.query(OperatorStaff).filter(OperatorStaff.user_id == current_user.id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="No operator association found for this user.")
    return {
        "operator_id": staff.operator_id,
        "designation": staff.designation,
        "operator_name": staff.operator.name if staff.operator else "Unknown"
    }

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_operator(req: OperatorRegisterRequest, db: Session = Depends(get_db)):
    # 1. Check if user already exists
    existing_user = db.query(User).filter((User.email == req.email) | (User.phone == req.phone)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email or phone number already exists.")
        
    # 2. Check if operator email already exists
    existing_op = db.query(Operator).filter((Operator.email == req.company_email) | (Operator.phone == req.company_phone)).first()
    if existing_op:
        raise HTTPException(status_code=400, detail="Operator with this email or phone number already exists.")
        
    # 3. Create operator role if not exists
    op_role = db.query(Role).filter(Role.name == "operator").first()
    if not op_role:
        op_role = Role(name="operator", description="Operator Role")
        db.add(op_role)
        db.flush()
        
    # 4. Create User
    new_user = User(
        email=req.email,
        phone=req.phone,
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
        role_id=op_role.id,
        is_active=True,
        is_verified=True
    )
    db.add(new_user)
    db.flush()
    
    # 5. Create Operator Profile
    new_operator = Operator(
        name=req.company_name,
        email=req.company_email,
        phone=req.company_phone,
        logo_url=req.logo_url,
        rating=5.0,
        is_active=True
    )
    db.add(new_operator)
    db.flush()
    
    # 6. Map User to Operator as Manager
    staff_map = OperatorStaff(
        user_id=new_user.id,
        operator_id=new_operator.id,
        designation="manager"
    )
    db.add(staff_map)
    db.commit()
    
    return {"detail": "Operator registered successfully. You can now login."}

@router.post("/buses", response_model=BusOut, status_code=status.HTTP_201_CREATED)
def create_bus(
    bus_in: BusCreate,
    current_user: User = Depends(require_roles(["operator", "operator_staff"])),
    db: Session = Depends(get_db)
):
    return booking_service.create_bus(
        db=db,
        operator_id=bus_in.operator_id,
        bus_number=bus_in.bus_number,
        bus_type=bus_in.bus_type,
        capacity=bus_in.capacity,
        amenity_ids=bus_in.amenity_ids,
        rc_number=bus_in.rc_number,
        insurance_number=bus_in.insurance_number,
        insurance_expiry=bus_in.insurance_expiry,
        fitness_expiry=bus_in.fitness_expiry,
        permit_number=bus_in.permit_number,
        permit_expiry=bus_in.permit_expiry,
        seats_in=bus_in.seats
    )

@router.get("/buses", response_model=List[BusOut])
def list_operator_buses(
    operator_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return db.query(Bus).filter(Bus.operator_id == operator_id, Bus.deleted_at.is_(None)).all()

@router.post("/trips", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip(
    trip_in: TripCreate,
    current_user: User = Depends(require_roles(["operator", "operator_staff"])),
    db: Session = Depends(get_db)
):
    trip = Trip(
        bus_id=trip_in.bus_id,
        operator_id=trip_in.operator_id,
        route_id=trip_in.route_id,
        departure_time=trip_in.departure_time,
        arrival_time=trip_in.arrival_time,
        price=trip_in.price,
        discount_price=trip_in.discount_price,
        status="scheduled",
        use_dynamic_pricing=trip_in.use_dynamic_pricing if trip_in.use_dynamic_pricing is not None else False,
        dynamic_pricing_type=trip_in.dynamic_pricing_type if trip_in.dynamic_pricing_type is not None else "occupancy"
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip

@router.get("/trips", response_model=List[TripOut])
def list_operator_trips(
    operator_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return db.query(Trip).filter(Trip.operator_id == operator_id, Trip.deleted_at.is_(None)).all()

@router.delete("/trips/{trip_id}", status_code=status.HTTP_200_OK)
def cancel_trip(
    trip_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff"])),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.deleted_at.is_(None)).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
    
    # Check user maps to the same operator
    staff = db.query(OperatorStaff).filter(OperatorStaff.user_id == current_user.id).first()
    if not staff or staff.operator_id != trip.operator_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel trips for this operator.")
        
    trip.status = "cancelled"
    db.commit()
    return {"detail": "Trip cancelled successfully."}

@router.post("/seats/{seat_id}/block")
def toggle_seat_blocking(
    seat_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff"])),
    db: Session = Depends(get_db)
):
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found.")
        
    # Verify operator ownership
    staff = db.query(OperatorStaff).filter(OperatorStaff.user_id == current_user.id).first()
    if not staff or staff.operator_id != seat.bus.operator_id:
        raise HTTPException(status_code=403, detail="Not authorized to block seats on this bus.")
        
    seat.is_blocked = not seat.is_blocked
    db.commit()
    return {"detail": f"Seat {'blocked' if seat.is_blocked else 'unblocked'} successfully.", "is_blocked": seat.is_blocked}

@router.get("/reports")
def get_operator_reports(
    operator_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    # Calculate statistics
    total_buses = db.query(Bus).filter(Bus.operator_id == operator_id, Bus.deleted_at.is_(None)).count()
    
    trips = db.query(Trip).filter(Trip.operator_id == operator_id, Trip.deleted_at.is_(None)).all()
    total_trips = len(trips)
    trip_ids = [t.id for t in trips]
    
    total_bookings = 0
    total_revenue = 0.0
    confirmed_passengers = 0
    total_seats_capacity = 0
    cancelled_bookings = 0
    
    if trip_ids:
        # Bookings count
        bookings = db.query(Booking).filter(Booking.trip_id.in_(trip_ids)).all()
        total_bookings = len(bookings)
        
        confirmed_bookings = [b for b in bookings if b.status == "confirmed"]
        cancelled_bookings = sum(1 for b in bookings if b.status == "cancelled")
        
        total_revenue = sum(b.final_amount for b in confirmed_bookings)
        
        # Occupancy
        confirmed_passengers = db.query(BookingPassenger).join(Booking).filter(
            Booking.trip_id.in_(trip_ids),
            Booking.status == "confirmed"
        ).count()
        
        # Total seats of active scheduled trips
        total_seats_capacity = db.query(func.sum(Bus.capacity)).select_from(Trip).join(Bus).filter(
            Trip.id.in_(trip_ids),
            Trip.status == "scheduled"
        ).scalar() or 0
        
    occupancy_pct = (confirmed_passengers / total_seats_capacity * 100) if total_seats_capacity > 0 else 0.0
    cancellation_pct = (cancelled_bookings / total_bookings * 100) if total_bookings > 0 else 0.0
    
    return {
        "total_buses": total_buses,
        "total_trips": total_trips,
        "total_bookings": total_bookings,
        "total_revenue": total_revenue,
        "occupancy_rate": round(occupancy_pct, 2),
        "cancellation_rate": round(cancellation_pct, 2)
    }

class StaffCreateRequest(BaseModel):
    operator_id: UUID
    full_name: str
    email: str
    phone: str
    password: str
    designation: str # driver, conductor, manager

@router.get("/staff")
def list_operator_staff(
    operator_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    staff_list = db.query(OperatorStaff).filter(OperatorStaff.operator_id == operator_id).all()
    result = []
    for s in staff_list:
        user = db.query(User).filter(User.id == s.user_id).first()
        if user:
            result.append({
                "id": s.id,
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "designation": s.designation,
                "is_active": user.is_active
            })
    return result

@router.post("/staff", status_code=status.HTTP_201_CREATED)
def create_operator_staff(
    req: StaffCreateRequest,
    current_user: User = Depends(require_roles(["operator"])),
    db: Session = Depends(get_db)
):
    owner_staff = db.query(OperatorStaff).filter(OperatorStaff.user_id == current_user.id).first()
    if not owner_staff or owner_staff.operator_id != req.operator_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage staff for this operator.")
        
    existing_user = db.query(User).filter((User.email == req.email) | (User.phone == req.phone)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email or phone number already exists.")
        
    staff_role = db.query(Role).filter(Role.name == "operator_staff").first()
    if not staff_role:
        staff_role = Role(name="operator_staff", description="Operator Staff Role")
        db.add(staff_role)
        db.flush()
        
    new_user = User(
        email=req.email,
        phone=req.phone,
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
        role_id=staff_role.id,
        is_active=True,
        is_verified=True
    )
    db.add(new_user)
    db.flush()
    
    new_staff = OperatorStaff(
        user_id=new_user.id,
        operator_id=req.operator_id,
        designation=req.designation.lower()
    )
    db.add(new_staff)
    db.commit()
    return {"detail": f"Staff member '{req.full_name}' registered successfully."}

@router.delete("/staff/{staff_id}")
def delete_operator_staff(
    staff_id: UUID,
    current_user: User = Depends(require_roles(["operator"])),
    db: Session = Depends(get_db)
):
    staff = db.query(OperatorStaff).filter(OperatorStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found.")
        
    owner_staff = db.query(OperatorStaff).filter(OperatorStaff.user_id == current_user.id).first()
    if not owner_staff or owner_staff.operator_id != staff.operator_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage staff for this operator.")
        
    user = db.query(User).filter(User.id == staff.user_id).first()
    if user:
        db.delete(user)
    db.delete(staff)
    db.commit()
    return {"detail": "Staff member removed successfully."}

@router.post("/seats/{seat_id}/block", status_code=status.HTTP_200_OK)
def toggle_seat_block(
    seat_id: UUID,
    current_user: User = Depends(require_roles(["operator", "operator_staff", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found.")
        
    seat.is_blocked = not seat.is_blocked
    db.add(seat)
    db.commit()
    db.refresh(seat)
    
    # Broadcast SSE update
    import asyncio
    try:
        from app.routers.bookings import sse_manager
        loop = asyncio.get_running_loop()
        loop.create_task(sse_manager.broadcast("status_update"))
    except Exception:
        pass
        
    return {"id": seat.id, "is_blocked": seat.is_blocked}
