from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from uuid import UUID

from app.core.database import get_db
from app.services.auth import require_roles
from app.models.auth import User, Role, Wallet, WalletTransaction
from app.models.buses import State, City, Route, Stop, Amenity, Operator, Bus, Seat, Trip, TripPoint
from app.models.bookings import Booking, Coupon
from app.models.support import AuditLog
from app.schemas.auth import UserOut
from app.schemas.support import AuditLogOut

# Master Schemas
from app.schemas.master import (
    CountryCreate, CountryOut,
    BusTypeCreate, BusTypeOut,
    SeatTypeCreate, SeatTypeOut,
    VehicleCategoryCreate, VehicleCategoryOut,
    TaxCreate, TaxOut,
    CancellationPolicyCreate, CancellationPolicyOut,
    RefundRuleCreate, RefundRuleOut
)
from app.schemas.cities import (
    StateCreate, StateOut,
    CityCreate, CityOut,
    RouteCreate, RouteOut,
    StopCreate, StopOut
)
from app.schemas.buses import (
    AmenityCreate, AmenityOut,
    OperatorCreate, OperatorOut
)
from app.schemas.bookings import (
    CouponCreate, CouponOut
)
from app.models.master import (
    Country, BusType, SeatType, VehicleCategory, Tax, CancellationPolicy, RefundRule
)

router = APIRouter(prefix="/admin", tags=["System Admin Panel"])

@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_demo_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    try:
        # 1. Setup Roles if not present
        role_names = ["passenger", "operator", "operator_staff", "support", "admin", "super_admin"]
        roles = {}
        for r_name in role_names:
            role = db.query(Role).filter(Role.name == r_name).first()
            if not role:
                role = Role(name=r_name, description=f"{r_name.capitalize()} Role")
                db.add(role)
                db.flush()
            roles[r_name] = role

        # 2. Seed States
        states_data = [
            {"name": "Maharashtra", "code": "MH"},
            {"name": "Karnataka", "code": "KA"},
            {"name": "Telangana", "code": "TG"},
            {"name": "Tamil Nadu", "code": "TN"}
        ]
        states = {}
        for sd in states_data:
            st = db.query(State).filter_by(code=sd["code"]).first()
            if not st:
                st = State(name=sd["name"], code=sd["code"])
                db.add(st)
                db.flush()
            states[sd["code"]] = st

        # 3. Seed Cities
        cities_data = [
            {"name": "Mumbai", "code": "BOM", "state_code": "MH"},
            {"name": "Pune", "code": "PNQ", "state_code": "MH"},
            {"name": "Bangalore", "code": "BLR", "state_code": "KA"},
            {"name": "Hyderabad", "code": "HYD", "state_code": "TG"},
            {"name": "Chennai", "code": "MAA", "state_code": "TN"}
        ]
        cities = {}
        for cd in cities_data:
            c = db.query(City).filter_by(code=cd["code"]).first()
            if not c:
                c = City(name=cd["name"], code=cd["code"], state_id=states[cd["state_code"]].id, is_active=True)
                db.add(c)
                db.flush()
            cities[cd["code"]] = c

        # 4. Seed Routes
        routes_data = [
            {"src": "BOM", "dst": "PNQ", "dist": 150.0, "dur": 180},
            {"src": "PNQ", "dst": "BOM", "dist": 150.0, "dur": 180},
            {"src": "BLR", "dst": "HYD", "dist": 570.0, "dur": 540},
            {"src": "BLR", "dst": "MAA", "dist": 350.0, "dur": 360}
        ]
        routes = {}
        for rd in routes_data:
            src_id = cities[rd["src"]].id
            dst_id = cities[rd["dst"]].id
            route = db.query(Route).filter_by(source_city_id=src_id, destination_city_id=dst_id).first()
            if not route:
                route = Route(source_city_id=src_id, destination_city_id=dst_id, distance_km=rd["dist"], duration_minutes=rd["dur"], is_active=True)
                db.add(route)
                db.flush()
            routes[f"{rd['src']}_{rd['dst']}"] = route

        # 5. Seed Stops
        mumbai_pune_route = routes["BOM_PNQ"]
        existing_stops = db.query(Stop).filter_by(route_id=mumbai_pune_route.id).count()
        if existing_stops == 0:
            db.add_all([
                Stop(route_id=mumbai_pune_route.id, city_id=cities["BOM"].id, stop_name="Borivali", sequence_number=1, duration_from_start=0),
                Stop(route_id=mumbai_pune_route.id, city_id=cities["BOM"].id, stop_name="Dadar E", sequence_number=2, duration_from_start=45),
                Stop(route_id=mumbai_pune_route.id, city_id=cities["PNQ"].id, stop_name="Wakad", sequence_number=3, duration_from_start=150),
                Stop(route_id=mumbai_pune_route.id, city_id=cities["PNQ"].id, stop_name="Swargate", sequence_number=4, duration_from_start=180),
            ])
            db.flush()

        # 6. Seed Amenities
        amenities_data = [
            {"name": "Wi-Fi", "icon": "wifi"},
            {"name": "Charging Point", "icon": "battery"},
            {"name": "Water Bottle", "icon": "droplet"},
            {"name": "Blanket", "icon": "gift"},
            {"name": "CCTV", "icon": "shield"}
        ]
        amenities = {}
        for ad in amenities_data:
            amenity = db.query(Amenity).filter_by(name=ad["name"]).first()
            if not amenity:
                amenity = Amenity(name=ad["name"], icon_class=ad["icon"])
                db.add(amenity)
                db.flush()
            amenities[ad["name"]] = amenity

        # 7. Seed Operators
        operators_data = [
            {"name": "Neeta Travels", "email": "info@neeta.in", "phone": "+919876543210", "rating": 4.5},
            {"name": "Orange Travels", "email": "contact@orange.in", "phone": "+919876543211", "rating": 4.7},
            {"name": "VRL Travels", "email": "help@vrl.in", "phone": "+919876543212", "rating": 4.2}
        ]
        operators = {}
        for od in operators_data:
            op = db.query(Operator).filter_by(email=od["email"]).first()
            if not op:
                op = Operator(name=od["name"], email=od["email"], phone=od["phone"], rating=od["rating"], is_active=True)
                db.add(op)
                db.flush()
            operators[od["name"]] = op

        # 8. Seed Coupons
        coupons_data = [
            {"code": "FIRST50", "type": "flat", "val": 50.0, "min": 200.0, "max": 50.0},
            {"code": "NEWBUS10", "type": "percentage", "val": 10.0, "min": 500.0, "max": 150.0}
        ]
        for cp in coupons_data:
            coupon = db.query(Coupon).filter_by(code=cp["code"]).first()
            if not coupon:
                coupon = Coupon(
                    code=cp["code"],
                    discount_type=cp["type"],
                    discount_value=cp["val"],
                    min_booking_amount=cp["min"],
                    max_discount=cp["max"],
                    expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365),
                    is_active=True
                )
                db.add(coupon)
                db.flush()

        # 9. Create standard buses for operators to support instant search & demo
        for op_name, number, btype in [
            ("Neeta Travels", "MH-12-PQ-9999", "AC_Sleeper"),
            ("Orange Travels", "KA-01-AB-1234", "AC_Seater"),
            ("VRL Travels", "MH-14-ZZ-5555", "Non_AC_Sleeper")
        ]:
            op = operators[op_name]
            bus = db.query(Bus).filter_by(bus_number=number).first()
            if not bus:
                bus = Bus(operator_id=op.id, bus_number=number, bus_type=btype, capacity=32, rating=op.rating, is_active=True)
                bus.amenities = [amenities["Wi-Fi"], amenities["Charging Point"], amenities["Water Bottle"], amenities["Blanket"]]
                db.add(bus)
                db.flush()
                # generate seats
                for row in range(1, 9):
                    for col in [1, 2, 3, 4]:
                        seat = Seat(
                            bus_id=bus.id,
                            seat_number=f"{row}{chr(64 + col)}",
                            row=row,
                            column=col,
                            seat_type="sleeper" if "Sleeper" in btype else "seater",
                            is_ladies=False
                        )
                        db.add(seat)
                db.flush()


            # Trips are (re)generated on every seed run, not just when the bus is first
            # created. A database seeded days ago would otherwise hold only trips whose
            # departure time has already passed, leaving the demo with nothing bookable.
            # Schedule standard trips (today, tomorrow, next-day)
            for offset in [0, 1, 2]:
                trip_date = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=offset)

                # Skip the day if this bus is already scheduled on it, so repeat seeds
                # top up missing days instead of duplicating existing ones.
                day_start = datetime.datetime.combine(trip_date.date(), datetime.time.min).replace(tzinfo=datetime.timezone.utc)
                day_end = day_start + datetime.timedelta(days=1)
                already_scheduled = db.query(Trip).filter(
                    Trip.bus_id == bus.id,
                    Trip.departure_time >= day_start,
                    Trip.departure_time < day_end
                ).first()
                if already_scheduled:
                    continue

                # Trip Mumbai to Pune
                trip_mp = Trip(
                    bus_id=bus.id,
                    operator_id=op.id,
                    route_id=routes["BOM_PNQ"].id,
                    departure_time=datetime.datetime.combine(trip_date.date(), datetime.time(8, 0)).replace(tzinfo=datetime.timezone.utc),
                    arrival_time=datetime.datetime.combine(trip_date.date(), datetime.time(11, 0)).replace(tzinfo=datetime.timezone.utc),
                    price=650.0,
                    status="scheduled"
                )
                
                # Trip Bangalore to Hyderabad
                trip_bh = Trip(
                    bus_id=bus.id,
                    operator_id=op.id,
                    route_id=routes["BLR_HYD"].id,
                    departure_time=datetime.datetime.combine(trip_date.date(), datetime.time(21, 0)).replace(tzinfo=datetime.timezone.utc),
                    arrival_time=datetime.datetime.combine(trip_date.date() + datetime.timedelta(days=1), datetime.time(6, 0)).replace(tzinfo=datetime.timezone.utc),
                    price=1200.0,
                    status="scheduled"
                )
                db.add_all([trip_mp, trip_bh])
                db.flush()
                
                # Seed Boarding & Dropping TripPoints for the trips
                tp1 = TripPoint(
                    trip_id=trip_mp.id,
                    point_name="Mumbai Borivali East terminal",
                    point_type="boarding",
                    time=trip_mp.departure_time,
                    landmark="Near National Park Gate",
                    gps_coordinates="19.2289,72.8617",
                    pickup_instructions="Wait next to the main ticket booking counter."
                )
                tp2 = TripPoint(
                    trip_id=trip_mp.id,
                    point_name="Sion Circle terminal",
                    point_type="boarding",
                    time=trip_mp.departure_time + datetime.timedelta(minutes=30),
                    landmark="Near Sion Circle Flyover",
                    gps_coordinates="19.0372,72.8631",
                    pickup_instructions="Wait at the Neeta Travels office board."
                )
                tp3 = TripPoint(
                    trip_id=trip_mp.id,
                    point_name="Pune Wakad Dropoff",
                    point_type="dropping",
                    time=trip_mp.arrival_time - datetime.timedelta(minutes=30),
                    landmark="Wakad Ginger Hotel",
                    gps_coordinates="18.5991,73.7663",
                    pickup_instructions="Drop point is near the highway flyover bypass."
                )
                tp4 = TripPoint(
                    trip_id=trip_mp.id,
                    point_name="Pune Swargate Terminal",
                    point_type="dropping",
                    time=trip_mp.arrival_time,
                    landmark="Swargate Bus Stand Gate",
                    gps_coordinates="18.5018,73.8636",
                    pickup_instructions="Main terminal exit gate."
                )
                
                tp5 = TripPoint(
                    trip_id=trip_bh.id,
                    point_name="Bangalore Majestic terminal",
                    point_type="boarding",
                    time=trip_bh.departure_time,
                    landmark="Opposite Railway station entry",
                    gps_coordinates="12.9778,77.5724",
                    pickup_instructions="Wait at Platform 5 Neeta travels counter."
                )
                tp6 = TripPoint(
                    trip_id=trip_bh.id,
                    point_name="Anantapur bypass boarding",
                    point_type="boarding",
                    time=trip_bh.departure_time + datetime.timedelta(hours=4),
                    landmark="Bypass Toll plaza",
                    gps_coordinates="14.6819,77.6006",
                    pickup_instructions="Wait on the highway service lane near toll."
                )
                tp7 = TripPoint(
                    trip_id=trip_bh.id,
                    point_name="Hyderabad Gachibowli Dropoff",
                    point_type="dropping",
                    time=trip_bh.arrival_time - datetime.timedelta(hours=1),
                    landmark="Gachibowli Outer Ring Road",
                    gps_coordinates="17.4401,78.3489",
                    pickup_instructions="Drop point near flyover start."
                )
                tp8 = TripPoint(
                    trip_id=trip_bh.id,
                    point_name="Hyderabad Ameerpet Terminal",
                    point_type="dropping",
                    time=trip_bh.arrival_time,
                    landmark="Metro station pillar A10",
                    gps_coordinates="17.4375,78.4482",
                    pickup_instructions="Drop point under the metro pillar."
                )
                db.add_all([tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8])
            db.flush()

        # 10. Seed countries
        for c_name, c_code in [("India", "IN"), ("United States", "US")]:
            if not db.query(Country).filter_by(code=c_code).first():
                db.add(Country(name=c_name, code=c_code))

        # 11. Seed bus types
        for bt_name, bt_code in [("AC Sleeper", "AC_Sleeper"), ("AC Seater", "AC_Seater"), ("Non-AC Sleeper", "Non_AC_Sleeper"), ("Non-AC Seater", "Non_AC_Seater")]:
            if not db.query(BusType).filter_by(code=bt_code).first():
                db.add(BusType(name=bt_name, code=bt_code))

        # 12. Seed seat types
        for st_name, st_code in [("Seater Seat", "seater"), ("Sleeper Berth", "sleeper")]:
            if not db.query(SeatType).filter_by(code=st_code).first():
                db.add(SeatType(name=st_name, code=st_code))

        # 13. Seed vehicle categories
        for vc_name, vc_desc in [("Volvo Multi-Axle", "Volvo B11R luxury sleeper coach"), ("Scania Premium", "Scania Metrolink HD touring coach")]:
            if not db.query(VehicleCategory).filter_by(name=vc_name).first():
                db.add(VehicleCategory(name=vc_name, description=vc_desc))

        # 14. Seed taxes
        for tx_name, tx_pct in [("GST 5%", 5.0), ("GST 18%", 18.0)]:
            if not db.query(Tax).filter_by(name=tx_name).first():
                db.add(Tax(name=tx_name, percentage=tx_pct, is_active=True))

        # 15. Seed cancellation policies
        for cp_name, cp_desc, cp_pct, cp_hr in [
            ("Standard Policy", "10% charge if cancelled 24 hrs before", 10.0, 24),
            ("Late Policy", "50% charge if cancelled 12 hrs before", 50.0, 12)
        ]:
            if not db.query(CancellationPolicy).filter_by(name=cp_name).first():
                db.add(CancellationPolicy(name=cp_name, description=cp_desc, charge_percentage=cp_pct, hours_before_departure=cp_hr))

        # 16. Seed refund rules
        for rr_name, rr_desc, rr_pct in [
            ("Flat Refund", "Flat 90% refund policy", 90.0),
            ("No Refund", "No refund if late cancellation", 0.0)
        ]:
            if not db.query(RefundRule).filter_by(name=rr_name).first():
                db.add(RefundRule(name=rr_name, description=rr_desc, refund_percentage=rr_pct))

        db.commit()
        return {"detail": "System master data seeded successfully with States, Cities, Routes, Stops, Operators, Buses, Seats, Coupons, Countries, Bus Types, Seat Types, Categories, Taxes, and Policies."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to seed DB: {str(e)}")

@router.get("/users", response_model=List[UserOut])
def list_system_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    return db.query(User).filter(User.deleted_at.is_(None)).all()

@router.get("/audit-logs", response_model=List[AuditLogOut])
def view_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()

@router.get("/reports/platform")
def get_global_platform_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
    total_operators = db.query(Operator).filter(Operator.is_active == True).count()
    total_bookings = db.query(Booking).count()
    
    confirmed = db.query(Booking).filter(Booking.status == "confirmed").all()
    total_revenue = sum(b.final_amount for b in confirmed)
    
    cancelled = db.query(Booking).filter(Booking.status == "cancelled").count()
    cancellation_pct = (cancelled / total_bookings * 100) if total_bookings > 0 else 0.0
    
    return {
        "total_users": total_users,
        "total_operators": total_operators,
        "total_bookings_count": total_bookings,
        "total_revenue": total_revenue,
        "cancellation_rate": round(cancellation_pct, 2)
    }

# Helper to get dependency check
admin_check = Depends(require_roles(["admin", "super_admin"]))

# --- COUNTRIES CRUD ---
@router.get("/countries", response_model=List[CountryOut])
def get_countries(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(Country).all()

@router.post("/countries", response_model=CountryOut, status_code=status.HTTP_201_CREATED)
def create_country(req: CountryCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    country = Country(name=req.name, code=req.code)
    db.add(country)
    db.commit()
    db.refresh(country)
    return country

@router.delete("/countries/{id}", status_code=status.HTTP_200_OK)
def delete_country(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    country = db.query(Country).filter(Country.id == id).first()
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    db.delete(country)
    db.commit()
    return {"detail": "Country deleted"}

# --- STATES CRUD ---
@router.get("/states", response_model=List[StateOut])
def get_states(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(State).all()

@router.post("/states", response_model=StateOut, status_code=status.HTTP_201_CREATED)
def create_state(req: StateCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    state = State(name=req.name, code=req.code)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state

@router.delete("/states/{id}", status_code=status.HTTP_200_OK)
def delete_state(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    state = db.query(State).filter(State.id == id).first()
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    db.delete(state)
    db.commit()
    return {"detail": "State deleted"}

# --- CITIES CRUD ---
@router.get("/cities", response_model=List[CityOut])
def get_cities(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(City).all()

@router.post("/cities", response_model=CityOut, status_code=status.HTTP_201_CREATED)
def create_city(req: CityCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    city = City(name=req.name, code=req.code, state_id=req.state_id, is_active=True)
    db.add(city)
    db.commit()
    db.refresh(city)
    return city

@router.delete("/cities/{id}", status_code=status.HTTP_200_OK)
def delete_city(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    city = db.query(City).filter(City.id == id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    db.delete(city)
    db.commit()
    return {"detail": "City deleted"}

# --- ROUTES CRUD ---
@router.get("/routes", response_model=List[RouteOut])
def get_routes(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(Route).all()

@router.post("/routes", response_model=RouteOut, status_code=status.HTTP_201_CREATED)
def create_route(req: RouteCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    route = Route(
        source_city_id=req.source_city_id,
        destination_city_id=req.destination_city_id,
        distance_km=req.distance_km,
        duration_minutes=req.duration_minutes,
        is_active=True
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return route

@router.delete("/routes/{id}", status_code=status.HTTP_200_OK)
def delete_route(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    db.delete(route)
    db.commit()
    return {"detail": "Route deleted"}

# --- STOPS CRUD ---
@router.get("/stops", response_model=List[StopOut])
def get_stops(route_id: Optional[UUID] = None, db: Session = Depends(get_db), current_user: User = admin_check):
    q = db.query(Stop)
    if route_id:
        q = q.filter(Stop.route_id == route_id)
    return q.all()

@router.post("/stops", response_model=StopOut, status_code=status.HTTP_201_CREATED)
def create_stop(route_id: UUID, req: StopCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    stop = Stop(
        route_id=route_id,
        city_id=req.city_id,
        stop_name=req.stop_name,
        landmark=req.landmark,
        address=req.address,
        sequence_number=req.sequence_number,
        duration_from_start=req.duration_from_start
    )
    db.add(stop)
    db.commit()
    db.refresh(stop)
    return stop

@router.delete("/stops/{id}", status_code=status.HTTP_200_OK)
def delete_stop(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    stop = db.query(Stop).filter(Stop.id == id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    db.delete(stop)
    db.commit()
    return {"detail": "Stop deleted"}

# --- AMENITIES CRUD ---
@router.get("/amenities", response_model=List[AmenityOut])
def get_amenities(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(Amenity).all()

@router.post("/amenities", response_model=AmenityOut, status_code=status.HTTP_201_CREATED)
def create_amenity(req: AmenityCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    amenity = Amenity(name=req.name, icon_class=req.icon_class)
    db.add(amenity)
    db.commit()
    db.refresh(amenity)
    return amenity

@router.delete("/amenities/{id}", status_code=status.HTTP_200_OK)
def delete_amenity(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    amenity = db.query(Amenity).filter(Amenity.id == id).first()
    if not amenity:
        raise HTTPException(status_code=404, detail="Amenity not found")
    db.delete(amenity)
    db.commit()
    return {"detail": "Amenity deleted"}

# --- BUS TYPES CRUD ---
@router.get("/bus-types", response_model=List[BusTypeOut])
def get_bus_types(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(BusType).all()

@router.post("/bus-types", response_model=BusTypeOut, status_code=status.HTTP_201_CREATED)
def create_bus_type(req: BusTypeCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    bt = BusType(name=req.name, code=req.code)
    db.add(bt)
    db.commit()
    db.refresh(bt)
    return bt

@router.delete("/bus-types/{id}", status_code=status.HTTP_200_OK)
def delete_bus_type(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    bt = db.query(BusType).filter(BusType.id == id).first()
    if not bt:
        raise HTTPException(status_code=404, detail="Bus type not found")
    db.delete(bt)
    db.commit()
    return {"detail": "Bus type deleted"}

# --- SEAT TYPES CRUD ---
@router.get("/seat-types", response_model=List[SeatTypeOut])
def get_seat_types(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(SeatType).all()

@router.post("/seat-types", response_model=SeatTypeOut, status_code=status.HTTP_201_CREATED)
def create_seat_type(req: SeatTypeCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    st = SeatType(name=req.name, code=req.code)
    db.add(st)
    db.commit()
    db.refresh(st)
    return st

@router.delete("/seat-types/{id}", status_code=status.HTTP_200_OK)
def delete_seat_type(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    st = db.query(SeatType).filter(SeatType.id == id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Seat type not found")
    db.delete(st)
    db.commit()
    return {"detail": "Seat type deleted"}

# --- VEHICLE CATEGORIES CRUD ---
@router.get("/vehicle-categories", response_model=List[VehicleCategoryOut])
def get_vehicle_categories(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(VehicleCategory).all()

@router.post("/vehicle-categories", response_model=VehicleCategoryOut, status_code=status.HTTP_201_CREATED)
def create_vehicle_category(req: VehicleCategoryCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    vc = VehicleCategory(name=req.name, description=req.description)
    db.add(vc)
    db.commit()
    db.refresh(vc)
    return vc

@router.delete("/vehicle-categories/{id}", status_code=status.HTTP_200_OK)
def delete_vehicle_category(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    vc = db.query(VehicleCategory).filter(VehicleCategory.id == id).first()
    if not vc:
        raise HTTPException(status_code=404, detail="Vehicle category not found")
    db.delete(vc)
    db.commit()
    return {"detail": "Vehicle category deleted"}

# --- COUPONS CRUD ---
@router.get("/coupons", response_model=List[CouponOut])
def get_coupons(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(Coupon).all()

@router.post("/coupons", response_model=CouponOut, status_code=status.HTTP_201_CREATED)
def create_coupon(req: CouponCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    cp = Coupon(
        code=req.code,
        discount_type=req.discount_type,
        discount_value=req.discount_value,
        min_booking_amount=req.min_booking_amount,
        max_discount=req.max_discount,
        expires_at=req.expires_at,
        is_active=True
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp

@router.delete("/coupons/{id}", status_code=status.HTTP_200_OK)
def delete_coupon(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    cp = db.query(Coupon).filter(Coupon.id == id).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(cp)
    db.commit()
    return {"detail": "Coupon deleted"}

# --- TAXES CRUD ---
@router.get("/taxes", response_model=List[TaxOut])
def get_taxes(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(Tax).all()

@router.post("/taxes", response_model=TaxOut, status_code=status.HTTP_201_CREATED)
def create_tax(req: TaxCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    tx = Tax(name=req.name, percentage=req.percentage, is_active=req.is_active if req.is_active is not None else True)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx

@router.delete("/taxes/{id}", status_code=status.HTTP_200_OK)
def delete_tax(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    tx = db.query(Tax).filter(Tax.id == id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Tax not found")
    db.delete(tx)
    db.commit()
    return {"detail": "Tax deleted"}

# --- CANCELLATION POLICIES CRUD ---
@router.get("/cancellation-policies", response_model=List[CancellationPolicyOut])
def get_cancellation_policies(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(CancellationPolicy).all()

@router.post("/cancellation-policies", response_model=CancellationPolicyOut, status_code=status.HTTP_201_CREATED)
def create_cancellation_policy(req: CancellationPolicyCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    cp = CancellationPolicy(
        name=req.name,
        description=req.description,
        charge_percentage=req.charge_percentage,
        hours_before_departure=req.hours_before_departure
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp

@router.delete("/cancellation-policies/{id}", status_code=status.HTTP_200_OK)
def delete_cancellation_policy(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    cp = db.query(CancellationPolicy).filter(CancellationPolicy.id == id).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Cancellation policy not found")
    db.delete(cp)
    db.commit()
    return {"detail": "Cancellation policy deleted"}

# --- REFUND RULES CRUD ---
@router.get("/refund-rules", response_model=List[RefundRuleOut])
def get_refund_rules(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(RefundRule).all()

@router.post("/refund-rules", response_model=RefundRuleOut, status_code=status.HTTP_201_CREATED)
def create_refund_rule(req: RefundRuleCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    rr = RefundRule(name=req.name, description=req.description, refund_percentage=req.refund_percentage)
    db.add(rr)
    db.commit()
    db.refresh(rr)
    return rr

@router.delete("/refund-rules/{id}", status_code=status.HTTP_200_OK)
def delete_refund_rule(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    rr = db.query(RefundRule).filter(RefundRule.id == id).first()
    if not rr:
        raise HTTPException(status_code=404, detail="Refund rule not found")
    db.delete(rr)
    db.commit()
    return {"detail": "Refund rule deleted"}

# --- OPERATORS CRUD ---
@router.get("/operators", response_model=List[OperatorOut])
def get_operators(db: Session = Depends(get_db), current_user: User = admin_check):
    return db.query(Operator).all()

@router.post("/operators", response_model=OperatorOut, status_code=status.HTTP_201_CREATED)
def create_operator(req: OperatorCreate, db: Session = Depends(get_db), current_user: User = admin_check):
    op = Operator(name=req.name, email=req.email, phone=req.phone, logo_url=req.logo_url, is_active=True)
    db.add(op)
    db.commit()
    db.refresh(op)
    return op

@router.delete("/operators/{id}", status_code=status.HTTP_200_OK)
def delete_operator(id: UUID, db: Session = Depends(get_db), current_user: User = admin_check):
    op = db.query(Operator).filter(Operator.id == id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator not found")
    db.delete(op)
    db.commit()
    return {"detail": "Operator deleted"}

# --- BOOKINGS CRUD ---
@router.get("/bookings")
def get_all_bookings(db: Session = Depends(get_db), current_user: User = admin_check):
    bookings = db.query(Booking).order_by(Booking.created_at.desc()).all()
    result = []
    for b in bookings:
        result.append({
            "id": str(b.id),
            "booking_number": b.booking_number,
            "pnr": b.pnr,
            "total_amount": b.total_amount,
            "discount_amount": b.discount_amount,
            "final_amount": b.final_amount,
            "status": b.status,
            "payment_status": b.payment_status,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "user_email": b.user.email if b.user else "N/A",
            "trip_route": f"{b.trip.route.source_city.name} → {b.trip.route.destination_city.name}" if b.trip and b.trip.route else "N/A"
        })
    return result
