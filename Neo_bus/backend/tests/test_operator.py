import pytest
from uuid import UUID
from datetime import datetime, timedelta, timezone
from app.models.auth import User, Role
from app.models.buses import Operator, OperatorStaff, Bus, Seat, Trip
from app.models.bookings import Booking, BookingPassenger

def test_register_operator(client, db_session):
    payload = {
        "full_name": "Test Op Owner",
        "email": "owner@testoperator.com",
        "phone": "+919999888800",
        "password": "ownerpassword123",
        "company_name": "Express Travels Ltd",
        "company_email": "info@expresstravels.com",
        "company_phone": "+912212345678",
        "logo_url": "http://example.com/logo.png"
    }
    
    response = client.post("/api/v1/operator/register", json=payload)
    assert response.status_code == 201
    assert response.json()["detail"] == "Operator registered successfully. You can now login."
    
    # Verify DB entries
    user = db_session.query(User).filter_by(email="owner@testoperator.com").first()
    assert user is not None
    assert user.full_name == "Test Op Owner"
    
    operator = db_session.query(Operator).filter_by(email="info@expresstravels.com").first()
    assert operator is not None
    assert operator.name == "Express Travels Ltd"
    
    staff = db_session.query(OperatorStaff).filter_by(user_id=user.id, operator_id=operator.id).first()
    assert staff is not None
    assert staff.designation == "manager"

def test_operator_staff_crud(client, db_session):
    # 1. Setup Operator & Manager
    op_role = Role(name="operator", description="Operator")
    db_session.add(op_role)
    db_session.flush()
    
    manager = User(email="manager@op.com", phone="+919999888801", full_name="Manager", hashed_password="pwd", role_id=op_role.id)
    operator = Operator(name="Op Company", email="op@company.com", phone="+9122112211")
    db_session.add_all([manager, operator])
    db_session.flush()
    
    op_staff = OperatorStaff(user_id=manager.id, operator_id=operator.id, designation="manager")
    db_session.add(op_staff)
    db_session.commit()
    
    # 2. Login Manager to get token
    login_payload = {
        "identifier": "manager@op.com",
        "password": "pwd"  # mock or direct auth bypass/mocking.
    }
    # For unit tests, client can execute requests directly by mocking user. Let's just create staff via API:
    # First get auth token:
    from app.core.security import create_access_token
    token = create_access_token(manager.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Create staff (driver)
    staff_payload = {
        "operator_id": str(operator.id),
        "full_name": "Ramesh Driver",
        "email": "ramesh@op.com",
        "phone": "+919999888802",
        "password": "driverpassword123",
        "designation": "driver"
    }
    res = client.post("/api/v1/operator/staff", json=staff_payload, headers=headers)
    assert res.status_code == 201
    
    # 4. List staff
    res = client.get(f"/api/v1/operator/staff?operator_id={operator.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2 # manager + driver
    assert any(x["full_name"] == "Ramesh Driver" for x in data)

def test_dynamic_pricing_rules(client, db_session):
    # Setup test route, bus, trip with dynamic pricing
    from app.models.buses import State, City, Route
    state = State(name="TestState", code="TS")
    db_session.add(state)
    db_session.flush()
    
    c1 = City(name="CityA", code="CTA", state_id=state.id)
    c2 = City(name="CityB", code="CTB", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.flush()
    
    route = Route(source_city_id=c1.id, destination_city_id=c2.id, distance_km=100.0, duration_minutes=120)
    operator = Operator(name="Op Dynamic", email="dynamic@op.com", phone="+9122332211")
    db_session.add_all([route, operator])
    db_session.flush()
    
    bus = Bus(operator_id=operator.id, bus_number="MH-12-DYN", bus_type="AC_Sleeper", capacity=10)
    db_session.add(bus)
    db_session.flush()
    
    # Add 10 seats
    for i in range(1, 11):
        db_session.add(Seat(bus_id=bus.id, seat_number=f"S{i}", row=i, column=1, seat_type="sleeper"))
    db_session.flush()
    
    # Create trip with 24+ hour departure and dynamic pricing
    future_dep = datetime.now(timezone.utc) + timedelta(days=2)
    trip = Trip(
        bus_id=bus.id,
        operator_id=operator.id,
        route_id=route.id,
        departure_time=future_dep,
        arrival_time=future_dep + timedelta(hours=2),
        price=100.0,
        use_dynamic_pricing=True,
        dynamic_pricing_type="occupancy"
    )
    db_session.add(trip)
    db_session.commit()
    
    # 1. Search trips (0% occupancy) -> Price should be base 100.0
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1.id}&destination_city_id={c2.id}&journey_date={future_dep.strftime('%Y-%m-%d')}")
    assert res.status_code == 200
    trips_list = res.json()
    assert len(trips_list) > 0
    assert trips_list[0]["price"] == 100.0
    
    # 2. Add bookings to cross 50% occupancy (e.g. 6 seats booked out of 10)
    role = Role(name="passenger", description="Passenger")
    db_session.add(role)
    db_session.flush()
    user = User(email="psg@test.com", phone="+919999888805", full_name="Passenger", hashed_password="pwd", role_id=role.id)
    db_session.add(user)
    db_session.flush()
    
    booking = Booking(user_id=user.id, trip_id=trip.id, booking_number="B1", pnr="P1", total_amount=600.0, discount_amount=0.0, final_amount=600.0, status="confirmed")
    db_session.add(booking)
    db_session.flush()
    
    seats = db_session.query(Seat).filter_by(bus_id=bus.id).all()
    for s in seats[:6]:
        db_session.add(BookingPassenger(booking_id=booking.id, seat_id=s.id, passenger_name="P", passenger_age=25, passenger_gender="male", ticket_number=f"T{s.seat_number}"))
    db_session.commit()
    
    # 3. Search trips again (60% occupancy) -> Price should increase by 10% (+10.0) -> 110.0
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1.id}&destination_city_id={c2.id}&journey_date={future_dep.strftime('%Y-%m-%d')}")
    assert res.status_code == 200
    trips_list = res.json()
    assert trips_list[0]["price"] == 110.0

def test_seat_blocking(client, db_session):
    # Setup test route, bus, trip
    from app.models.buses import State, City, Route
    state = State(name="StateBlock", code="SB")
    db_session.add(state)
    db_session.flush()
    
    c1 = City(name="CityA2", code="CT1", state_id=state.id)
    c2 = City(name="CityB2", code="CT2", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.flush()
    
    route = Route(source_city_id=c1.id, destination_city_id=c2.id, distance_km=100.0, duration_minutes=120)
    operator = Operator(name="Op Block", email="block@op.com", phone="+9122332200")
    db_session.add_all([route, operator])
    db_session.flush()
    
    bus = Bus(operator_id=operator.id, bus_number="MH-12-BLK", bus_type="AC_Sleeper", capacity=2)
    db_session.add(bus)
    db_session.flush()
    
    seat1 = Seat(bus_id=bus.id, seat_number="S1", row=1, column=1, seat_type="sleeper", is_blocked=True) # blocked
    seat2 = Seat(bus_id=bus.id, seat_number="S2", row=1, column=2, seat_type="sleeper", is_blocked=False) # open
    db_session.add_all([seat1, seat2])
    db_session.flush()
    
    future_dep = datetime.now(timezone.utc) + timedelta(days=2)
    trip = Trip(
        bus_id=bus.id,
        operator_id=operator.id,
        route_id=route.id,
        departure_time=future_dep,
        arrival_time=future_dep + timedelta(hours=2),
        price=100.0
    )
    db_session.add(trip)
    db_session.commit()
    
    # 1. Fetch layout -> Seat S1 should have status blocked
    res = client.get(f"/api/v1/bookings/seats/layout/{trip.id}")
    assert res.status_code == 200
    layout = res.json()
    s1_layout = next(x for x in layout if x["seat_number"] == "S1")
    s2_layout = next(x for x in layout if x["seat_number"] == "S2")
    assert s1_layout["status"] == "blocked"
    assert s2_layout["status"] == "available"
    
    # 2. Lock seat S1 (blocked) -> Should return 409
    role = Role(name="passenger", description="Passenger")
    db_session.add(role)
    db_session.flush()
    user = User(email="passenger_lock@test.com", phone="+919999888809", full_name="Psg Lock", hashed_password="pwd", role_id=role.id)
    db_session.add(user)
    db_session.commit()
    
    from app.core.security import create_access_token
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    lock_payload = {
        "trip_id": str(trip.id),
        "seat_ids": [str(seat1.id)]
    }
    response = client.post("/api/v1/bookings/seats/lock", json=lock_payload, headers=headers)
    assert response.status_code == 409
    assert "blocked by the operator" in response.json()["detail"]
