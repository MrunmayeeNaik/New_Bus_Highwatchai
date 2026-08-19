import pytest
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.auth import User, Role
from app.models.buses import State, City, Route, Operator, Bus, Seat, Trip, SeatLock
from app.core.security import create_access_token
from app.services.bookings import booking_service

@pytest.fixture
def setup_seat_engine_data(db_session):
    # Setup roles
    passenger_role = Role(name="passenger", description="Passenger Role")
    admin_role = Role(name="admin", description="Admin Role")
    db_session.add_all([passenger_role, admin_role])
    db_session.flush()

    # Setup passengers
    user_a = User(email="usera@test.com", phone="+919999111222", full_name="User A", hashed_password="pwd", role_id=passenger_role.id)
    user_b = User(email="userb@test.com", phone="+919999111333", full_name="User B", hashed_password="pwd", role_id=passenger_role.id)
    admin_user = User(email="admin_seat@test.com", phone="+919999111444", full_name="Admin User", hashed_password="pwd", role_id=admin_role.id)
    db_session.add_all([user_a, user_b, admin_user])
    db_session.flush()

    # Route and Operator
    state = State(name="LockState", code="LS")
    db_session.add(state)
    db_session.flush()
    c1 = City(name="LockSource", code="LSA", state_id=state.id)
    c2 = City(name="LockDest", code="LDB", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.flush()
    
    route = Route(source_city_id=c1.id, destination_city_id=c2.id, distance_km=100.0, duration_minutes=120)
    operator = Operator(name="Engine Operator", email="engine@op.com", phone="+9122334455")
    db_session.add_all([route, operator])
    db_session.flush()

    # Bus with mixed categories and decks
    bus = Bus(operator_id=operator.id, bus_number="MH-12-ENG", bus_type="AC_Sleeper", capacity=4)
    db_session.add(bus)
    db_session.flush()

    # Create 4 seats:
    # Seat 1: Lower, Normal
    # Seat 2: Lower, Premium
    # Seat 3: Lower, Ladies
    # Seat 4: Upper, Sleeper
    s1 = Seat(bus_id=bus.id, seat_number="L1", row=1, column=1, seat_type="seater", category="normal", deck="lower", is_ladies=False)
    s2 = Seat(bus_id=bus.id, seat_number="L2", row=1, column=2, seat_type="seater", category="vip", deck="lower", is_ladies=False)
    s3 = Seat(bus_id=bus.id, seat_number="L3", row=1, column=3, seat_type="seater", category="ladies", deck="lower", is_ladies=True)
    s4 = Seat(bus_id=bus.id, seat_number="U1", row=1, column=1, seat_type="sleeper", category="premium", deck="upper", is_ladies=False)
    db_session.add_all([s1, s2, s3, s4])
    db_session.flush()

    # Trip departs on a Saturday to test weekend surcharge
    saturday_dep = datetime.now(timezone.utc) + timedelta(days=5)
    while saturday_dep.weekday() != 5: # Saturday
        saturday_dep += timedelta(days=1)
        
    trip = Trip(
        bus_id=bus.id,
        operator_id=operator.id,
        route_id=route.id,
        departure_time=saturday_dep,
        arrival_time=saturday_dep + timedelta(hours=2),
        price=100.0,
        use_dynamic_pricing=False
    )
    db_session.add(trip)
    db_session.commit()

    return {
        "user_a": user_a,
        "user_b": user_b,
        "admin": admin_user,
        "trip": trip,
        "seats": [s1, s2, s3, s4]
    }

def test_concurrent_seat_locks(client, setup_seat_engine_data):
    data = setup_seat_engine_data
    trip = data["trip"]
    seat = data["seats"][0] # normal seat L1

    token_a = create_access_token(data["user_a"].id)
    token_b = create_access_token(data["user_b"].id)

    # 1. User A locks the seat L1 -> Success (200/201)
    lock_payload = {
        "trip_id": str(trip.id),
        "seat_ids": [str(seat.id)]
    }
    response_a = client.post("/api/v1/bookings/seats/lock", json=lock_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert response_a.status_code == 200

    # 2. User B tries to lock the same seat L1 simultaneously -> Conflict (409)
    response_b = client.post("/api/v1/bookings/seats/lock", json=lock_payload, headers={"Authorization": f"Bearer {token_b}"})
    assert response_b.status_code == 409
    assert "locked by another passenger" in response_b.json()["detail"]

def test_seat_pricing_calculations(setup_seat_engine_data, db_session):
    data = setup_seat_engine_data
    trip = data["trip"]
    seats = data["seats"]

    # Seat prices for weekend (Sat) departure (base price = 100.0):
    # L1: Weekend +10% -> 110.0
    # L2: Weekend +10% -> 110.0 * Premium (vip) +15% -> 126.50
    # U1: Weekend +10% -> 110.0 * Sleeper +30% -> 143.0 * Premium Category +15% -> 164.45
    p1 = booking_service.calculate_seat_price(db_session, trip, seats[0])
    p2 = booking_service.calculate_seat_price(db_session, trip, seats[1])
    p4 = booking_service.calculate_seat_price(db_session, trip, seats[3])

    assert p1 == 110.0
    assert p2 == 126.50
    assert p4 == 164.45

def test_ladies_seat_adjacent_gender_rules(client, setup_seat_engine_data, db_session):
    data = setup_seat_engine_data
    trip = data["trip"]
    seat_normal = data["seats"][0] # L1 (adjacent to nothing or L2)
    seat_ladies = data["seats"][2] # L3 (is ladies)

    token_a = create_access_token(data["user_a"].id)
    token_admin = create_access_token(data["admin"].id)

    # 1. Lock the ladies seat first
    lock_payload = {
        "trip_id": str(trip.id),
        "seat_ids": [str(seat_ladies.id)]
    }
    client.post("/api/v1/bookings/seats/lock", json=lock_payload, headers={"Authorization": f"Bearer {token_a}"})

    # 2. Try booking ladies seat for a MALE passenger -> Fails 400
    booking_payload = {
        "trip_id": str(trip.id),
        "passengers": [
            {
                "seat_id": str(seat_ladies.id),
                "passenger_name": "John Male",
                "passenger_age": 30,
                "passenger_gender": "male"
            }
        ],
        "coupon_code": None,
        "use_wallet": False
    }
    res = client.post("/api/v1/bookings/", json=booking_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 400
    assert "only be booked by a female" in res.json()["detail"]

    # 3. Booking for a FEMALE passenger -> Succeeds
    booking_payload_female = {
        "trip_id": str(trip.id),
        "passengers": [
            {
                "seat_id": str(seat_ladies.id),
                "passenger_name": "Mary Female",
                "passenger_age": 25,
                "passenger_gender": "female"
            }
        ],
        "coupon_code": None,
        "use_wallet": False
    }
    res_female = client.post("/api/v1/bookings/", json=booking_payload_female, headers={"Authorization": f"Bearer {token_a}"})
    assert res_female.status_code == 201

def test_seat_unlock_endpoint(client, setup_seat_engine_data, db_session):
    data = setup_seat_engine_data
    trip = data["trip"]
    seat = data["seats"][0]
    token = create_access_token(data["user_a"].id)

    # 1. Lock seat
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token}"})

    # 2. Unlock seat
    response = client.post("/api/v1/bookings/seats/unlock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # 3. Verify it is now available (User B can lock it)
    token_b = create_access_token(data["user_b"].id)
    response_b = client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token_b}"})
    assert response_b.status_code == 200

def test_expired_locks_pruning(client, setup_seat_engine_data, db_session):
    from app.models.buses import SeatLock
    data = setup_seat_engine_data
    trip = data["trip"]
    seat = data["seats"][0]
    token = create_access_token(data["user_a"].id)

    # 1. Create a lock in DB that expired 5 minutes ago
    now = datetime.now(timezone.utc)
    expired_lock = SeatLock(
        trip_id=trip.id,
        seat_id=seat.id,
        user_id=data["user_a"].id,
        locked_at=now - timedelta(minutes=15),
        expires_at=now - timedelta(minutes=5)
    )
    db_session.add(expired_lock)
    db_session.commit()

    # 2. Trigger prune by getting layout
    response = client.get(f"/api/v1/bookings/seats/layout/{trip.id}")
    assert response.status_code == 200
    
    # Check that seat status is "available"
    layout = response.json()
    seat_status = next(s for s in layout if s["id"] == str(seat.id))["status"]
    assert seat_status == "available"

def test_failed_payment_releases_locks(client, setup_seat_engine_data, db_session):
    data = setup_seat_engine_data
    trip = data["trip"]
    seat = data["seats"][0]
    token = create_access_token(data["user_a"].id)

    # 1. Lock seat
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token}"})

    # 2. Create pending booking
    booking_payload = {
        "trip_id": str(trip.id),
        "passengers": [
            {
                "seat_id": str(seat.id),
                "passenger_name": "User A Passenger",
                "passenger_age": 25,
                "passenger_gender": "female"
            }
        ],
        "coupon_code": None,
        "use_wallet": False
    }
    res = client.post("/api/v1/bookings/", json=booking_payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    booking_id = res.json()["id"]

    # 3. Notify payment failed
    payment_payload = {
        "booking_id": booking_id,
        "payment_gateway": "stripe",
        "transaction_id": "failed-tx",
        "amount": 100.0,
        "status": "failed"
    }
    payment_res = client.post("/api/v1/bookings/payment", json=payment_payload, headers={"Authorization": f"Bearer {token}"})
    assert payment_res.status_code == 200
    assert payment_res.json()["status"] == "failed"

    # 4. Seat should be available now (User B can lock it)
    token_b = create_access_token(data["user_b"].id)
    res_b = client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200

def test_adjacent_female_rule_for_males(client, setup_seat_engine_data, db_session):
    data = setup_seat_engine_data
    trip = data["trip"]
    seat_a = data["seats"][0] # L1 (col 1)
    seat_b = data["seats"][1] # L2 (col 2) - adjacent in same row

    token_a = create_access_token(data["user_a"].id)
    token_b = create_access_token(data["user_b"].id)

    # 1. User A (female) locks and books seat L1
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat_a.id)]}, headers={"Authorization": f"Bearer {token_a}"})
    booking_payload = {
        "trip_id": str(trip.id),
        "passengers": [
            {
                "seat_id": str(seat_a.id),
                "passenger_name": "Mary Female",
                "passenger_age": 25,
                "passenger_gender": "female"
            }
        ]
    }
    res_book = client.post("/api/v1/bookings/", json=booking_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert res_book.status_code == 201
    
    # Pay to confirm booking
    pay_payload = {
        "booking_id": res_book.json()["id"],
        "payment_gateway": "stripe",
        "transaction_id": "success-txn-adj",
        "amount": 110.0
    }
    client.post("/api/v1/bookings/payment", json=pay_payload, headers={"Authorization": f"Bearer {token_a}"})

    # 2. User B (male) locks seat L2 (which is adjacent to L1)
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat_b.id)]}, headers={"Authorization": f"Bearer {token_b}"})
    
    # 3. User B tries to book L2 for a male passenger -> Fails 400 due to adjacent female rule
    booking_payload_male = {
        "trip_id": str(trip.id),
        "passengers": [
            {
                "seat_id": str(seat_b.id),
                "passenger_name": "John Male",
                "passenger_age": 30,
                "passenger_gender": "male"
            }
        ]
    }
    res_male = client.post("/api/v1/bookings/", json=booking_payload_male, headers={"Authorization": f"Bearer {token_b}"})
    assert res_male.status_code == 400
    assert "adjacent to a seat occupied by a female" in res_male.json()["detail"]
