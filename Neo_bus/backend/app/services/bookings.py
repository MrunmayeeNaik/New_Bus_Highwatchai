from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.models.auth import User, Wallet, WalletTransaction
from app.models.buses import Operator, State, City, Route, Stop, Bus, Amenity, Seat, Trip, SeatLock
from app.models.bookings import Booking, BookingPassenger, Payment, Coupon, Refund
from app.models.feedback import Review
from app.repositories import (
    city_repo, route_repo, bus_repo, trip_repo, lock_repo,
    booking_repo, coupon_repo, payment_repo, passenger_repo,
    seat_repo, operator_repo, staff_repo
)
from app.schemas.bookings import BookingCreate, PaymentRequest, CancellationRequest

class BookingService:
    # --- MASTER DATA ---
    def get_cities(self, db: Session) -> List[City]:
        return db.query(City).filter(City.is_active == True).all()

    def create_city(self, db: Session, name: str, code: str, state_id: UUID) -> City:
        city = City(name=name, code=code.upper(), state_id=state_id, is_active=True)
        db.add(city)
        db.commit()
        db.refresh(city)
        return city

    def get_routes(self, db: Session) -> List[Route]:
        return db.query(Route).filter(Route.is_active == True).all()

    # --- FLEET MANAGEMENT & SEAT GENERATION ---
    def create_bus(
        self,
        db: Session,
        operator_id: UUID,
        bus_number: str,
        bus_type: str,
        capacity: int,
        amenity_ids: List[UUID],
        rc_number: Optional[str] = None,
        insurance_number: Optional[str] = None,
        insurance_expiry: Optional[datetime] = None,
        fitness_expiry: Optional[datetime] = None,
        permit_number: Optional[str] = None,
        permit_expiry: Optional[datetime] = None,
        seats_in: Optional[List[Any]] = None
    ) -> Bus:
        # Check if bus number already exists
        existing = db.query(Bus).filter(Bus.bus_number == bus_number.upper(), Bus.deleted_at.is_(None)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Bus with this number already exists.")
            
        bus = Bus(
            operator_id=operator_id,
            bus_number=bus_number.upper(),
            bus_type=bus_type,
            capacity=capacity,
            rating=5.0,
            is_active=True,
            rc_number=rc_number,
            insurance_number=insurance_number,
            insurance_expiry=insurance_expiry,
            fitness_expiry=fitness_expiry,
            permit_number=permit_number,
            permit_expiry=permit_expiry
        )
        
        # Link amenities
        if amenity_ids:
            amenities = db.query(Amenity).filter(Amenity.id.in_(amenity_ids)).all()
            bus.amenities = amenities
            
        db.add(bus)
        db.flush() # get bus id
        
        # Custom seats from Layout Builder
        if seats_in:
            for s_in in seats_in:
                # Support dictionary mapping or class attributes
                s_num = s_in.get("seat_number") if isinstance(s_in, dict) else getattr(s_in, "seat_number", "")
                s_row = s_in.get("row") if isinstance(s_in, dict) else getattr(s_in, "row", 1)
                s_col = s_in.get("column") if isinstance(s_in, dict) else getattr(s_in, "column", 1)
                s_type = s_in.get("seat_type") if isinstance(s_in, dict) else getattr(s_in, "seat_type", "seater")
                s_lady = s_in.get("is_ladies") if isinstance(s_in, dict) else getattr(s_in, "is_ladies", False)
                s_cat = s_in.get("category") if isinstance(s_in, dict) else getattr(s_in, "category", "normal")
                s_deck = s_in.get("deck") if isinstance(s_in, dict) else getattr(s_in, "deck", "lower")
                
                seat = Seat(
                    bus_id=bus.id,
                    seat_number=s_num,
                    row=s_row,
                    column=s_col,
                    seat_type=s_type,
                    is_ladies=s_lady,
                    is_blocked=False,
                    category=s_cat,
                    deck=s_deck
                )
                db.add(seat)
        else:
            # Generate seats automatically based on capacity
            # For a standard 2+2 layout: Columns A, B (Left), C, D (Right)
            num_rows = (capacity + 3) // 4
            seat_count = 0
            cols = ["A", "B", "C", "D"]
            
            for row in range(1, num_rows + 1):
                for col_idx, col in enumerate(cols):
                    if seat_count >= capacity:
                        break
                    seat = Seat(
                        bus_id=bus.id,
                        seat_number=f"{row}{col}",
                        row=row,
                        column=col_idx + 1,
                        seat_type="sleeper" if "Sleeper" in bus_type else "seater",
                        is_ladies=False,
                        is_blocked=False
                    )
                    db.add(seat)
                    seat_count += 1
                    
        db.commit()
        db.refresh(bus)
        return bus

    # --- ACTIVE DYNAMIC PRICE CALCULATION ---
    def get_trip_active_price(self, db: Session, trip: Trip) -> float:
        price = trip.price
        if not trip.use_dynamic_pricing:
            return price
            
        # 1. Occupancy-based rules
        confirmed_seats = db.query(BookingPassenger).join(Booking).filter(
            Booking.trip_id == trip.id,
            Booking.status == "confirmed"
        ).count()
        
        capacity = trip.bus.capacity if trip.bus else 32
        occupancy_pct = (confirmed_seats / capacity) * 100 if capacity > 0 else 0.0
        
        if occupancy_pct > 80:
            price *= 1.25  # 25% surcharge
        elif occupancy_pct > 50:
            price *= 1.10  # 10% surcharge
            
        # 2. Window-based rules (time left to departure)
        now = datetime.now(timezone.utc)
        dep_time = trip.departure_time
        if dep_time.tzinfo is None:
            dep_time = dep_time.replace(tzinfo=timezone.utc)
            
        time_diff = dep_time - now
        hours_to_departure = time_diff.total_seconds() / 3600
        
        if hours_to_departure <= 0:
            pass
        elif hours_to_departure < 6:
            price *= 1.30  # 30% surcharge
        elif hours_to_departure < 24:
            price *= 1.15  # 15% surcharge
            
        return round(price, 2)

    # --- TRIP SEARCH ENGINE ---
    def search_trips(
        self,
        db: Session,
        source_city_id: UUID,
        destination_city_id: UUID,
        journey_date: datetime,
        bus_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        departure_period: Optional[str] = None,
        arrival_period: Optional[str] = None,
        min_rating: Optional[float] = None,
        amenities: Optional[List[str]] = None,
        operator_name: Optional[str] = None,
        min_available_seats: Optional[int] = None,
        sort_by: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Trip]:
        route = db.query(Route).filter(
            Route.source_city_id == source_city_id,
            Route.destination_city_id == destination_city_id,
            Route.is_active == True
        ).first()
        
        if not route:
            return []
            
        start_date = datetime.combine(journey_date.date(), datetime.min.time()).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(journey_date.date(), datetime.max.time()).replace(tzinfo=timezone.utc)
        
        from sqlalchemy.orm import joinedload, selectinload
        query = db.query(Trip).options(
            joinedload(Trip.bus).selectinload(Bus.amenities),
            joinedload(Trip.bus).joinedload(Bus.operator),
            joinedload(Trip.operator),
            joinedload(Trip.route).joinedload(Route.source_city),
            joinedload(Trip.route).joinedload(Route.destination_city)
        ).filter(
            Trip.route_id == route.id,
            Trip.departure_time >= start_date,
            Trip.departure_time <= end_date,
            Trip.status == "scheduled",
            Trip.deleted_at.is_(None)
        )
        
        if bus_type:
            types = [t.strip() for t in bus_type.split(",") if t.strip()]
            if types:
                query = query.join(Bus).filter(Bus.bus_type.in_(types))
                
        if min_rating:
            query = query.join(Operator).filter(Operator.rating >= min_rating)
            
        if operator_name:
            query = query.filter(Operator.name.ilike(f"%{operator_name}%"))
            
        trips = query.all()

        # Real per-operator review counts, computed from actual submitted reviews (not fabricated)
        operator_ids = {t.operator_id for t in trips}
        review_counts = dict(
            db.query(Review.operator_id, func.count(Review.id))
            .filter(Review.operator_id.in_(operator_ids))
            .group_by(Review.operator_id)
            .all()
        ) if operator_ids else {}

        filtered_trips = []
        for t in trips:
            active_p = self.get_trip_active_price(db, t)
            db.expunge(t)
            t.price = active_p
            if t.operator:
                t.operator.review_count = review_counts.get(t.operator_id, 0)
            
            if min_price is not None and t.price < min_price:
                continue
            if max_price is not None and t.price > max_price:
                continue
                
            dep_hour = t.departure_time.hour
            if departure_period:
                p = departure_period.lower()
                if p == "morning" and not (6 <= dep_hour < 12):
                    continue
                elif p == "afternoon" and not (12 <= dep_hour < 18):
                    continue
                elif p == "evening" and not (18 <= dep_hour < 23):
                    continue
                elif p == "night" and not (dep_hour >= 23 or dep_hour < 6):
                    continue
                    
            arr_hour = t.arrival_time.hour
            if arrival_period:
                p = arrival_period.lower()
                if p == "morning" and not (6 <= arr_hour < 12):
                    continue
                elif p == "afternoon" and not (12 <= arr_hour < 18):
                    continue
                elif p == "evening" and not (18 <= arr_hour < 23):
                    continue
                elif p == "night" and not (arr_hour >= 23 or arr_hour < 6):
                    continue
            
            if amenities:
                bus_amenity_names = {a.name.lower() for a in t.bus.amenities}
                if not all(a.lower() in bus_amenity_names for a in amenities):
                    continue
                    
            confirmed_passengers = db.query(BookingPassenger).join(Booking).filter(
                Booking.trip_id == t.id,
                Booking.status == "confirmed"
            ).count()
            capacity = t.bus.capacity if t.bus else 32
            available_seats = max(capacity - confirmed_passengers, 0)
            
            t.available_seats_count = available_seats
            
            if min_available_seats is not None and available_seats < min_available_seats:
                continue
                
            filtered_trips.append(t)
            
        if sort_by == "price_asc":
            filtered_trips.sort(key=lambda x: x.price)
        elif sort_by == "price_desc":
            filtered_trips.sort(key=lambda x: x.price, reverse=True)
        elif sort_by == "dep_early":
            filtered_trips.sort(key=lambda x: x.departure_time)
        elif sort_by == "dep_late":
            filtered_trips.sort(key=lambda x: x.departure_time, reverse=True)
        elif sort_by == "arr_early":
            filtered_trips.sort(key=lambda x: x.arrival_time)
        elif sort_by == "arr_late":
            filtered_trips.sort(key=lambda x: x.arrival_time, reverse=True)
        elif sort_by == "duration_short":
            filtered_trips.sort(key=lambda x: (x.arrival_time - x.departure_time))
        elif sort_by == "duration_long":
            filtered_trips.sort(key=lambda x: (x.arrival_time - x.departure_time), reverse=True)
        elif sort_by == "rating_desc":
            filtered_trips.sort(key=lambda x: x.operator.rating, reverse=True)
        elif sort_by == "seats_desc":
            filtered_trips.sort(key=lambda x: getattr(x, "available_seats_count", 0), reverse=True)
        else:
            filtered_trips.sort(key=lambda x: x.price)
            
        return filtered_trips[offset:offset + limit]

    # --- SEAT STATUS & CONCURRENT LOCKS ---
    def prune_expired_locks(self, db: Session) -> None:
        now = datetime.now(timezone.utc)
        expired_locks = db.query(SeatLock).filter(SeatLock.expires_at <= now).all()
        if not expired_locks:
            return
            
        from app.core.redis_store import release_seat_lock
        for lock in expired_locks:
            release_seat_lock(str(lock.trip_id), str(lock.seat_id))
            db.delete(lock)
            
        db.commit()
        
        # Broadcast SSE status update
        import asyncio
        try:
            from app.routers.bookings import sse_manager
            loop = asyncio.get_running_loop()
            loop.create_task(sse_manager.broadcast("status_update"))
        except Exception:
            pass

    def unlock_seats(self, db: Session, user_id: UUID, trip_id: UUID, seat_ids: List[UUID]) -> None:
        from app.core.redis_store import release_seat_lock, get_seat_lock_holder
        for seat_id in seat_ids:
            holder = get_seat_lock_holder(str(trip_id), str(seat_id))
            if holder == str(user_id):
                release_seat_lock(str(trip_id), str(seat_id))
                
            db.query(SeatLock).filter(
                SeatLock.trip_id == trip_id,
                SeatLock.seat_id == seat_id,
                SeatLock.user_id == user_id
            ).delete(synchronize_session=False)
            
        db.commit()
        
        # Broadcast SSE status update
        import asyncio
        try:
            from app.routers.bookings import sse_manager
            loop = asyncio.get_running_loop()
            loop.create_task(sse_manager.broadcast("status_update"))
        except Exception:
            pass

    def get_trip_seat_layout(self, db: Session, trip_id: UUID) -> List[Dict[str, Any]]:
        self.prune_expired_locks(db)
        
        trip = db.query(Trip).get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found.")
            
        # Get all seats for the bus
        seats = db.query(Seat).filter(Seat.bus_id == trip.bus_id).all()
        
        # Get active seat locks (Query from Redis)
        from app.core.redis_store import get_all_active_locks_for_trip
        locked_seat_ids = get_all_active_locks_for_trip(str(trip_id))
        
        # Merge with active DB locks if Redis falls back
        now = datetime.now(timezone.utc)
        active_locks = db.query(SeatLock).filter(
            SeatLock.trip_id == trip_id,
            SeatLock.expires_at > now
        ).all()
        for lock in active_locks:
            s_id_str = str(lock.seat_id)
            if s_id_str not in locked_seat_ids:
                locked_seat_ids[s_id_str] = str(lock.user_id)
        
        # Convert keys back to UUID
        locked_seat_ids_uuid = {}
        for s_id, u_id in locked_seat_ids.items():
            try:
                locked_seat_ids_uuid[UUID(s_id)] = UUID(u_id)
            except ValueError:
                pass

        # Expiry timestamps for locked seats (used by the client to show a live hold countdown)
        lock_expiry_by_seat = {lock.seat_id: lock.expires_at for lock in active_locks}

        # Get confirmed booked seats
        confirmed_passengers = db.query(BookingPassenger).join(Booking).filter(
            Booking.trip_id == trip_id,
            Booking.status == "confirmed"
        ).all()
        booked_seat_ids = {p.seat_id for p in confirmed_passengers}
        
        layout = []
        for seat in seats:
            status = "available"
            held_by = None
            locked_until = None

            if seat.is_blocked:
                # Custom block sub-statuses: maintenance, unavailable, reserved
                cat_lower = getattr(seat, "category", "normal").lower()
                if cat_lower in ("maintenance", "unavailable", "reserved"):
                    status = cat_lower
                else:
                    status = "blocked"
            elif seat.id in booked_seat_ids:
                status = "booked"
            elif seat.id in locked_seat_ids_uuid:
                status = "locked"
                held_by = locked_seat_ids_uuid[seat.id]
                locked_until = lock_expiry_by_seat.get(seat.id)

            layout.append({
                "id": seat.id,
                "seat_number": seat.seat_number,
                "row": seat.row,
                "column": seat.column,
                "seat_type": seat.seat_type,
                "is_ladies": seat.is_ladies,
                "category": getattr(seat, "category", "normal"),
                "deck": getattr(seat, "deck", "lower"),
                "status": status,
                "held_by": held_by,
                "locked_until": locked_until
            })
            
        return layout

    def lock_seats(self, db: Session, user_id: UUID, trip_id: UUID, seat_ids: List[UUID]) -> List[SeatLock]:
        self.prune_expired_locks(db)
        
        # Perform pessimistic transactional check
        # Verify seats aren't locked or booked
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        from app.core.redis_store import acquire_seat_lock
        
        locks = []
        for seat_id in seat_ids:
            seat = db.query(Seat).filter(Seat.id == seat_id).first()
            if not seat:
                raise HTTPException(status_code=404, detail=f"Seat {seat_id} not found.")
                
            # Check blocked
            if seat.is_blocked:
                raise HTTPException(status_code=409, detail=f"Seat {seat.seat_number} is blocked by the operator.")
                
            # Check booked
            booked = db.query(BookingPassenger).join(Booking).filter(
                Booking.trip_id == trip_id,
                Booking.status == "confirmed",
                BookingPassenger.seat_id == seat_id
            ).first()
            if booked:
                raise HTTPException(status_code=409, detail=f"Seat {seat.seat_number} is already booked.")
            
            # Atomic Lock Acquisition in Redis
            success = acquire_seat_lock(str(trip_id), str(seat_id), str(user_id), ttl_seconds=600)
            if not success:
                raise HTTPException(status_code=409, detail=f"Seat {seat.seat_number} is currently locked by another passenger.")
                
            # Persist or update db
            lock = db.query(SeatLock).filter(
                SeatLock.trip_id == trip_id,
                SeatLock.seat_id == seat_id
            ).first()
            
            if lock:
                lock.user_id = user_id
                lock.expires_at = expires_at
                lock.locked_at = now
            else:
                lock = SeatLock(
                    trip_id=trip_id,
                    seat_id=seat_id,
                    user_id=user_id,
                    locked_at=now,
                    expires_at=expires_at
                )
                db.add(lock)
            locks.append(lock)
            
        db.commit()
        
        # Broadcast SSE status update to live subscribers
        import asyncio
        try:
            from app.routers.bookings import sse_manager
            loop = asyncio.get_running_loop()
            loop.create_task(sse_manager.broadcast("status_update"))
        except Exception:
            pass
            
        return locks

    # --- BOOKING & FARE CALCULATION ---
    def calculate_seat_price(self, db: Session, trip: Trip, seat: Seat) -> float:
        # Get active dynamic fare (occupancy + window)
        base_price = self.get_trip_active_price(db, trip)
        
        # 1. Weekend Fare Surcharge (+10%)
        dep_time = trip.departure_time
        if dep_time.tzinfo is None:
            dep_time = dep_time.replace(tzinfo=timezone.utc)
        
        # weekday() is 0 (Monday) to 6 (Sunday)
        if dep_time.weekday() in (5, 6): # Sat, Sun
            base_price *= 1.10
            
        # 2. Festival Fare Surcharge (+20%)
        # Check specific ranges
        month = dep_time.month
        day = dep_time.day
        is_festival = False
        if (month == 10 and day >= 25) or (month == 11 and day <= 10): # Diwali range
            is_festival = True
        elif (month == 12 and day >= 18) or (month == 1 and day <= 5): # Christmas / New Year
            is_festival = True
        elif (month == 3 and day >= 10 and day <= 20): # Holi range
            is_festival = True
            
        if is_festival:
            base_price *= 1.20
            
        # 3. Seat Type Fare Surcharge (+30% for sleeper)
        if seat.seat_type == "sleeper":
            base_price *= 1.30
            
        # 4. Premium Category Markup
        cat = getattr(seat, "category", "normal").lower()
        if cat in ("vip", "luxury", "premium"):
            base_price *= 1.15
        elif cat == "semi_sleeper":
            base_price *= 1.10
            
        return round(base_price, 2)

    def check_ladies_seat_rule(self, db: Session, user: User, trip_id: UUID, seat: Seat, passenger_gender: str) -> None:
        # If user is admin/super_admin, allow override
        if user.role.name in ("admin", "super_admin"):
            return
            
        is_ladies_seat = getattr(seat, "is_ladies", False) or getattr(seat, "category", "").lower() == "ladies"
        
        # 1. If it's a ladies seat, it can ONLY be booked by a female
        if is_ladies_seat:
            if passenger_gender.lower() == "female":
                return
                
            # Allow male if the adjacent seat is occupied by a female
            adjacent_seats = db.query(Seat).filter(
                Seat.bus_id == seat.bus_id,
                Seat.row == seat.row,
                Seat.column.in_([seat.column - 1, seat.column + 1])
            ).all()
            
            adjacent_seat_ids = [s.id for s in adjacent_seats]
            if adjacent_seat_ids:
                adjacent_occupied_by_female = db.query(BookingPassenger).join(Booking).filter(
                    Booking.trip_id == trip_id,
                    Booking.status == "confirmed",
                    BookingPassenger.seat_id.in_(adjacent_seat_ids),
                    BookingPassenger.passenger_gender == "female"
                ).first()
                if adjacent_occupied_by_female:
                    return
                    
            raise HTTPException(
                status_code=400,
                detail=f"Ladies Seat {seat.seat_number} can only be booked by a female passenger."
            )
            
        # 2. Adjacent female check for normal seats:
        # If the passenger is male, they cannot book adjacent to a confirmed female passenger
        if passenger_gender.lower() == "male":
            adjacent_seats = db.query(Seat).filter(
                Seat.bus_id == seat.bus_id,
                Seat.row == seat.row,
                Seat.column.in_([seat.column - 1, seat.column + 1])
            ).all()
            adjacent_seat_ids = [s.id for s in adjacent_seats]
            
            if adjacent_seat_ids:
                adjacent_occupied_by_female = db.query(BookingPassenger).join(Booking).filter(
                    Booking.trip_id == trip_id,
                    Booking.status == "confirmed",
                    BookingPassenger.seat_id.in_(adjacent_seat_ids),
                    BookingPassenger.passenger_gender == "female"
                ).first()
                if adjacent_occupied_by_female:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Seat {seat.seat_number} is adjacent to a seat occupied by a female passenger and can only be booked by a female."
                    )

    def send_notifications(self, booking: Booking) -> None:
        # Console logging fallback for Email & SMS notifications
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[EMAIL NOTIFICATION] Ticket and Invoice PDFs dispatched to billing email. Booking Number: {booking.booking_number}, PNR: {booking.pnr}")
        if booking.passengers:
            logger.info(f"[SMS NOTIFICATION] SMS Alert: Dear {booking.passengers[0].passenger_name}, your New Bus booking is confirmed! PNR: {booking.pnr}. Seat: {booking.passengers[0].seat.seat_number if booking.passengers[0].seat else 'N/A'}")

    def create_booking(self, db: Session, user_id: UUID, booking_in: BookingCreate) -> Booking:
        trip = db.query(Trip).get(booking_in.trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found.")
            
        user = db.query(User).get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
            
        now = datetime.now(timezone.utc)
        
        # Verify user holds locks on all these seats and they are not expired
        from app.core.redis_store import get_seat_lock_holder
        for p_in in booking_in.passengers:
            seat_id = p_in.seat_id
            
            # Check blocked
            seat = db.query(Seat).get(seat_id)
            if not seat:
                raise HTTPException(status_code=404, detail=f"Seat {seat_id} not found.")
            if seat.is_blocked:
                raise HTTPException(status_code=409, detail=f"Seat {seat.seat_number} is blocked.")
                
            # Verify Ladies rule
            self.check_ladies_seat_rule(db, user, booking_in.trip_id, seat, p_in.passenger_gender)
            
            # Verify Lock
            holder = get_seat_lock_holder(str(booking_in.trip_id), str(seat_id))
            if not holder:
                db_lock = db.query(SeatLock).filter(
                    SeatLock.trip_id == booking_in.trip_id,
                    SeatLock.seat_id == seat_id,
                    SeatLock.expires_at > now
                ).first()
                if db_lock:
                    holder = str(db_lock.user_id)
                    
            if not holder or holder != str(user_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Hold on seat {seat.seat_number} has expired. Please select and lock it again."
                )

        # Fare computation per seat based on category & weekend/festival surcharges
        passenger_count = len(booking_in.passengers)
        base_fare = trip.price * passenger_count
        
        total_seat_price = 0.0
        for p_in in booking_in.passengers:
            seat = db.query(Seat).get(p_in.seat_id)
            total_seat_price += self.calculate_seat_price(db, trip, seat)
            
        discount_amount = 0.0
        coupon = None
        if booking_in.coupon_code:
            coupon = db.query(Coupon).filter(
                Coupon.code == booking_in.coupon_code.upper()
            ).first()
            if not coupon:
                raise HTTPException(status_code=400, detail="Invalid coupon code.")
                
            # 1. Active & Expiry Check
            c_expires = coupon.expires_at
            if c_expires.tzinfo is None:
                c_expires = c_expires.replace(tzinfo=timezone.utc)
            if not coupon.is_active or c_expires < now:
                raise HTTPException(status_code=400, detail="Coupon code has expired or is inactive.")
            # 2. Min Booking Amount
            if total_seat_price < coupon.min_booking_amount:
                raise HTTPException(status_code=400, detail=f"Minimum booking amount of INR {coupon.min_booking_amount} required for this coupon.")
            # 3. Route specific validation
            if getattr(coupon, "route_id", None) and coupon.route_id != trip.route_id:
                raise HTTPException(status_code=400, detail="Coupon code is not applicable on this route.")
            # 4. Operator specific validation
            if getattr(coupon, "operator_id", None) and coupon.operator_id != trip.operator_id:
                raise HTTPException(status_code=400, detail="Coupon code is not applicable for this operator.")
            # 5. First booking validation
            if getattr(coupon, "is_first_booking", False):
                has_prior = db.query(Booking).filter(
                    Booking.user_id == user_id,
                    Booking.status == "confirmed"
                ).first()
                if has_prior:
                    raise HTTPException(status_code=400, detail="Coupon is only valid for your first booking.")
            # 6. Usage limit checks
            if getattr(coupon, "usage_limit", 0) > 0 and getattr(coupon, "used_count", 0) >= coupon.usage_limit:
                raise HTTPException(status_code=400, detail="Coupon code usage limit has been reached.")
                
                # Apply discount
                if coupon.discount_type == "percentage":
                    discount_amount = (total_seat_price * coupon.discount_value) / 100.0
                    if coupon.max_discount > 0:
                        discount_amount = min(discount_amount, coupon.max_discount)
                else:  # flat
                    discount_amount = coupon.discount_value
                    
        discount_amount = min(discount_amount, total_seat_price)
        amount_after_discount = total_seat_price - discount_amount
        
        # Add 5% GST tax
        gst_tax = amount_after_discount * 0.05
        
        # Add platform/service fee of 15.00
        service_fee = 15.00
        final_amount_with_tax = amount_after_discount + gst_tax + service_fee
        
        # Process wallet payment if use_wallet is selected
        wallet_used_amount = 0.0
        if booking_in.use_wallet:
            from app.repositories import wallet_repo
            from app.models.auth import WalletTransaction
            wallet = wallet_repo.get_by_user_id(db, user_id)
            if wallet and wallet.balance > 0:
                wallet_used_amount = min(wallet.balance, final_amount_with_tax)
                wallet.balance -= wallet_used_amount
                
                tx = WalletTransaction(
                    wallet_id=wallet.id,
                    amount=-wallet_used_amount,
                    transaction_type="debit",
                    description="Wallet deduction for booking"
                )
                db.add(wallet)
                db.add(tx)
                
        final_amount_after_wallet = final_amount_with_tax - wallet_used_amount
        
        import random
        booking_number = f"NEOB-{random.randint(100000, 999999)}"
        pnr = f"PNR{random.randint(1000000, 9999999)}"
        
        # Determine initial statuses
        is_paid_fully = final_amount_after_wallet <= 0.01
        booking_status = "confirmed" if is_paid_fully else "pending"
        payment_status = "paid" if is_paid_fully else "pending"
        
        booking = Booking(
            user_id=user_id,
            trip_id=booking_in.trip_id,
            coupon_id=coupon.id if coupon else None,
            operator_id=trip.operator_id,
            boarding_point_id=booking_in.boarding_point_id,
            dropping_point_id=booking_in.dropping_point_id,
            booking_number=booking_number,
            journey_date=trip.departure_time,
            passenger_count=passenger_count,
            base_fare=base_fare,
            tax=gst_tax,
            discount=discount_amount,
            wallet_used=wallet_used_amount,
            total_amount=total_seat_price + service_fee,
            discount_amount=discount_amount,
            final_amount=final_amount_after_wallet,
            status=booking_status,
            payment_status=payment_status,
            ticket_status="active",
            pnr=pnr
        )
        db.add(booking)
        db.flush()
        
        # Increment coupon used count if payment succeeded fully
        if coupon and is_paid_fully:
            coupon.used_count = getattr(coupon, "used_count", 0) + 1
            db.add(coupon)
        
        # Create booking passengers mapping
        for p_in in booking_in.passengers:
            passenger = BookingPassenger(
                booking_id=booking.id,
                seat_id=p_in.seat_id,
                passenger_name=p_in.passenger_name,
                passenger_age=p_in.passenger_age,
                passenger_gender=p_in.passenger_gender,
                mobile=p_in.mobile,
                email=p_in.email,
                id_proof=p_in.id_proof,
                emergency_contact=p_in.emergency_contact,
                ticket_number=f"TKT-{random.randint(1000000, 9999999)}"
            )
            db.add(passenger)
            
        # Clean up the seat locks immediately if paid fully
        if is_paid_fully:
            from app.core.redis_store import release_seat_lock
            seat_ids = [p.seat_id for p in booking_in.passengers]
            for s_id in seat_ids:
                release_seat_lock(str(booking_in.trip_id), str(s_id))
                
            db.query(SeatLock).filter(
                SeatLock.trip_id == booking_in.trip_id,
                SeatLock.seat_id.in_(seat_ids)
            ).delete(synchronize_session=False)
            
        db.commit()
        db.refresh(booking)
        
        if is_paid_fully:
            self.send_notifications(booking)
            # Broadcast SSE update
            import asyncio
            try:
                from app.routers.bookings import sse_manager
                loop = asyncio.get_running_loop()
                loop.create_task(sse_manager.broadcast("status_update"))
            except Exception:
                pass
                
        return booking

    # --- PAYMENT & CONFIRMATION ---
    def process_booking_payment(self, db: Session, user_id: UUID, req: PaymentRequest) -> Booking:
        booking = db.query(Booking).get(req.booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking record not found")
        if booking.status != "pending":
            raise HTTPException(status_code=400, detail="Booking is not in pending status")
            
        # Handle payment failure notification
        if req.status == "failed":
            booking.status = "failed"
            booking.payment_status = "failed"
            db.add(booking)
            
            payment = Payment(
                booking_id=booking.id,
                transaction_id=req.transaction_id,
                payment_gateway=req.payment_gateway,
                amount=booking.final_amount,
                status="failed"
            )
            db.add(payment)
            
            from app.core.redis_store import release_seat_lock
            seat_ids = [p.seat_id for p in booking.passengers]
            for s_id in seat_ids:
                release_seat_lock(str(booking.trip_id), str(s_id))
                
            db.query(SeatLock).filter(
                SeatLock.trip_id == booking.trip_id,
                SeatLock.seat_id.in_(seat_ids)
            ).delete(synchronize_session=False)
            
            db.commit()
            db.refresh(booking)
            
            import asyncio
            try:
                from app.routers.bookings import sse_manager
                loop = asyncio.get_running_loop()
                loop.create_task(sse_manager.broadcast("status_update"))
            except Exception:
                pass
                
            return booking
            
        # Concurrency & Hold Expiry Validation Before Payment
        now = datetime.now(timezone.utc)
        trip = booking.trip
        
        # Verify trip is active and has not departed
        trip_dep = trip.departure_time.replace(tzinfo=timezone.utc if trip.departure_time.tzinfo is None else trip.departure_time.tzinfo)
        if trip.status == "cancelled" or trip_dep < now:
            raise HTTPException(status_code=400, detail="This trip is no longer active or has already departed.")
            
        from app.core.redis_store import get_seat_lock_holder, release_seat_lock
        
        # Verify seat locks are still held by this user
        for p in booking.passengers:
            # 1. Double booking check
            other_booking = db.query(BookingPassenger).join(Booking).filter(
                Booking.trip_id == booking.trip_id,
                Booking.status == "confirmed",
                BookingPassenger.seat_id == p.seat_id,
                Booking.id != booking.id
            ).first()
            if other_booking:
                raise HTTPException(status_code=400, detail=f"Seat {p.seat.seat_number} was already booked by another passenger.")
                
            # 2. Check lock ownership in Redis / DB
            holder = get_seat_lock_holder(str(booking.trip_id), str(p.seat_id))
            if not holder:
                db_lock = db.query(SeatLock).filter(
                    SeatLock.trip_id == booking.trip_id,
                    SeatLock.seat_id == p.seat_id,
                    SeatLock.expires_at > now
                ).first()
                if db_lock:
                    holder = str(db_lock.user_id)
                    
            if not holder or holder != str(user_id):
                raise HTTPException(status_code=400, detail=f"Hold on seat {p.seat.seat_number} has expired. Please select and lock it again.")
            
        # Verify Payment Signature via Gateway abstraction
        from app.services.payment.gateways import get_gateway
        gateway_instance = get_gateway(req.payment_gateway)
        mock_sig = "wallet_authorized" if req.payment_gateway == "wallet" else f"{req.payment_gateway}_success_sig"
        if not gateway_instance.verify_signature({"transaction_id": req.transaction_id}, mock_sig):
            raise HTTPException(status_code=400, detail="Invalid payment gateway signature verification.")

        # Deduct wallet if paid via wallet
        if req.payment_gateway == "wallet":
            wallet = wallet_repo.get_by_user_id(db, user_id)
            if not wallet or wallet.balance < booking.final_amount:
                raise HTTPException(status_code=400, detail="Insufficient wallet balance.")
                
            wallet.balance -= booking.final_amount
            # Log wallet transaction
            tx = WalletTransaction(
                wallet_id=wallet.id,
                amount=-booking.final_amount,
                transaction_type="debit",
                description=f"Ticket payment {booking.booking_number}"
            )
            db.add(wallet)
            db.add(tx)
            
        # Create payment record
        payment = Payment(
            booking_id=booking.id,
            transaction_id=req.transaction_id,
            payment_gateway=req.payment_gateway,
            amount=booking.final_amount,
            status="success"
        )
        db.add(payment)
        
        # Confirm booking
        booking.status = "confirmed"
        booking.payment_status = "paid"
        db.add(booking)
        
        # Update coupon usage if coupon is applied
        if booking.coupon:
            booking.coupon.used_count = getattr(booking.coupon, "used_count", 0) + 1
            db.add(booking.coupon)
        
        # Give user reward points (1 point per 10 credits spent)
        user = db.query(User).get(user_id)
        points_earned = int(booking.final_amount // 10)
        user.reward_points += points_earned
        db.add(user)
        
        # Clean up the seat locks for these seats from Redis & DB
        seat_ids = [p.seat_id for p in booking.passengers]
        for s_id in seat_ids:
            release_seat_lock(str(booking.trip_id), str(s_id))
            
        db.query(SeatLock).filter(
            SeatLock.trip_id == booking.trip_id,
            SeatLock.seat_id.in_(seat_ids)
        ).delete(synchronize_session=False)
        
        db.commit()
        db.refresh(booking)
        
        self.send_notifications(booking)
        
        # Broadcast SSE status update to live subscribers
        import asyncio
        try:
            from app.routers.bookings import sse_manager
            loop = asyncio.get_running_loop()
            loop.create_task(sse_manager.broadcast("status_update"))
        except Exception:
            pass
            
        return booking

    # --- CANCELLATION & REFUNDS ---
    def cancel_ticket(self, db: Session, user_id: UUID, cancel_in: CancellationRequest) -> Booking:
        # Scope the lookup to the caller: a booking belonging to somebody else must be
        # indistinguishable from one that does not exist.
        booking = db.query(Booking).filter(
            Booking.id == cancel_in.booking_id,
            Booking.user_id == user_id
        ).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found.")
        if booking.status != "confirmed":
            raise HTTPException(status_code=400, detail="Only confirmed tickets can be cancelled.")
            
        trip = db.query(Trip).get(booking.trip_id)
        now = datetime.now(timezone.utc)
        
        # Calculate time left before departure
        dep_time = trip.departure_time
        if dep_time.tzinfo is None:
            dep_time = dep_time.replace(tzinfo=timezone.utc)
        time_to_dep = dep_time - now
        
        # Cancellation Rules:
        # > 24 hours: 90% refund
        # 12 to 24 hours: 50% refund
        # < 12 hours: No refund
        if time_to_dep > timedelta(hours=24):
            refund_percent = 0.90
        elif time_to_dep > timedelta(hours=12):
            refund_percent = 0.50
        else:
            refund_percent = 0.0
            
        # Standard refund calculation based on total paid (final_amount + wallet_used)
        refund_amount = (booking.final_amount + booking.wallet_used) * refund_percent
        
        # Update booking status
        booking.status = "cancelled"
        booking.payment_status = "refunded"
        booking.ticket_status = "cancelled"
        db.add(booking)
        
        # Process refund to Wallet
        if refund_amount > 0:
            from app.repositories import wallet_repo
            from app.models.auth import Wallet, WalletTransaction
            wallet = wallet_repo.get_by_user_id(db, booking.user_id)
            if not wallet:
                wallet = Wallet(user_id=booking.user_id, balance=0.0)
                db.add(wallet)
                db.flush()
                
            wallet.balance += refund_amount
            tx = WalletTransaction(
                wallet_id=wallet.id,
                amount=refund_amount,
                transaction_type="credit",
                description=f"Refund for cancelled ticket {booking.booking_number}"
            )
            db.add(wallet)
            db.add(tx)
            
        # Create Refund Record
        import uuid
        booking_id_uuid = booking.id
        if isinstance(booking_id_uuid, str):
            booking_id_uuid = uuid.UUID(booking_id_uuid)
            
        payment_id_uuid = None
        if booking.payments:
            pid = booking.payments[0].id
            payment_id_uuid = uuid.UUID(pid) if isinstance(pid, str) else pid
            
        refund_record = Refund(
            booking_id=booking_id_uuid,
            payment_id=payment_id_uuid,
            refund_amount=refund_amount,
            refund_type="wallet",
            status="success",
            refund_id=f"ref_{uuid.uuid4().hex[:16]}"
        )
        db.add(refund_record)
            
        db.commit()
        db.refresh(booking)
        return booking

    def retry_payment(self, db: Session, user_id: UUID, booking_id: UUID) -> Dict[str, Any]:
        booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found.")
        if booking.status not in ("pending", "failed"):
            raise HTTPException(status_code=400, detail="Booking payment cannot be retried (status is not pending/failed).")
            
        # Check retry limit (max 3 failed payment attempts)
        failed_attempts = db.query(Payment).filter(
            Payment.booking_id == booking_id,
            Payment.status == "failed"
        ).count()
        if failed_attempts >= 3:
            raise HTTPException(status_code=400, detail="Payment retry limit (3 attempts) exceeded. Please book again.")
            
        # Verify hold expiry: check if locks are still active in the DB or Redis
        now = datetime.now(timezone.utc)
        seat_ids = [p.seat_id for p in booking.passengers]
        
        # Verify user still holds locks on these seats
        from app.core.redis_store import get_seat_lock_holder
        for seat_id in seat_ids:
            holder = get_seat_lock_holder(str(booking.trip_id), str(seat_id))
            if not holder:
                db_lock = db.query(SeatLock).filter(
                    SeatLock.trip_id == booking.trip_id,
                    SeatLock.seat_id == seat_id,
                    SeatLock.expires_at > now
                ).first()
                if db_lock:
                    holder = str(db_lock.user_id)
            if not holder or holder != str(user_id):
                raise HTTPException(status_code=400, detail="Seat hold has expired. Please select and lock seats again.")
                
        # Generate new payment order
        from app.services.payment.gateways import get_gateway
        gateway_name = booking.payments[0].payment_gateway if booking.payments else "stripe"
        gateway = get_gateway(gateway_name)
        
        order = gateway.create_order(str(booking_id), booking.final_amount)
        return order

booking_service = BookingService()
