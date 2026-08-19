import pytest
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.auth import User, Role, Wallet, WalletTransaction
from app.models.buses import State, City, Route, Operator, Bus, Seat, Trip, TripPoint, SeatLock
from app.models.bookings import Booking, BookingPassenger, Coupon, Refund, Payment
from app.core.security import create_access_token
from app.services.bookings import booking_service

@pytest.fixture
def setup_booking_engine_data(db_session):
    passenger_role = Role(name="passenger", description="Passenger Role")
    db_session.add(passenger_role)
    db_session.flush()

    user = User(email="buyer@test.com", phone="+919999111888", full_name="Buyer User", hashed_password="pwd", role_id=passenger_role.id)
    db_session.add(user)
    db_session.flush()

    # Create user wallet
    wallet = Wallet(user_id=user.id, balance=1000.0)
    db_session.add(wallet)
    db_session.flush()

    state = State(name="BookingState", code="BS")
    db_session.add(state)
    db_session.flush()
    c1 = City(name="BookingSource", code="BSO", state_id=state.id)
    c2 = City(name="BookingDest", code="BDE", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.flush()
    
    route = Route(source_city_id=c1.id, destination_city_id=c2.id, distance_km=200.0, duration_minutes=240)
    operator = Operator(name="Booking Operator", email="booking@op.com", phone="+9122334466")
    db_session.add_all([route, operator])
    db_session.flush()

    bus = Bus(operator_id=operator.id, bus_number="MH-12-BK", bus_type="AC_Sleeper", capacity=2)
    db_session.add(bus)
    db_session.flush()

    s1 = Seat(bus_id=bus.id, seat_number="B1", row=1, column=1, seat_type="seater", category="normal", deck="lower", is_ladies=False)
    s2 = Seat(bus_id=bus.id, seat_number="B2", row=1, column=2, seat_type="seater", category="vip", deck="lower", is_ladies=False)
    db_session.add_all([s1, s2])
    db_session.flush()

    # Wednesday departure (weekday = 2) for normal price, Saturday (weekday = 5) for weekend
    wednesday_dep = datetime.now(timezone.utc) + timedelta(days=2)
    while wednesday_dep.weekday() != 2:
        wednesday_dep += timedelta(days=1)

    saturday_dep = datetime.now(timezone.utc) + timedelta(days=2)
    while saturday_dep.weekday() != 5:
        saturday_dep += timedelta(days=1)

    trip_normal = Trip(
        bus_id=bus.id, operator_id=operator.id, route_id=route.id,
        departure_time=wednesday_dep, arrival_time=wednesday_dep + timedelta(hours=4),
        price=500.0, use_dynamic_pricing=False
    )
    trip_weekend = Trip(
        bus_id=bus.id, operator_id=operator.id, route_id=route.id,
        departure_time=saturday_dep, arrival_time=saturday_dep + timedelta(hours=4),
        price=500.0, use_dynamic_pricing=False
    )
    db_session.add_all([trip_normal, trip_weekend])
    db_session.flush()

    # Trip boarding & dropping points
    tp1 = TripPoint(trip_id=trip_normal.id, point_name="Wednesday Boarding", point_type="boarding", time=wednesday_dep)
    tp2 = TripPoint(trip_id=trip_normal.id, point_name="Wednesday Dropoff", point_type="dropping", time=wednesday_dep + timedelta(hours=4))
    tp3 = TripPoint(trip_id=trip_weekend.id, point_name="Saturday Boarding", point_type="boarding", time=saturday_dep)
    tp4 = TripPoint(trip_id=trip_weekend.id, point_name="Saturday Dropoff", point_type="dropping", time=saturday_dep + timedelta(hours=4))
    db_session.add_all([tp1, tp2, tp3, tp4])
    db_session.commit()

    return {
        "user": user,
        "wallet": wallet,
        "trip_normal": trip_normal,
        "trip_weekend": trip_weekend,
        "seats": [s1, s2],
        "points": [tp1, tp2, tp3, tp4],
        "route": route,
        "operator": operator
    }

def test_detailed_fare_calculation_and_gst(client, setup_booking_engine_data, db_session):
    data = setup_booking_engine_data
    trip_normal = data["trip_normal"]
    trip_weekend = data["trip_weekend"]
    s_normal = data["seats"][0] # Normal Seater
    s_vip = data["seats"][1] # VIP Seater

    # 1. Normal Seat on Wednesday: base price = 500.0
    p1 = booking_service.calculate_seat_price(db_session, trip_normal, s_normal)
    assert p1 == 500.0

    # 2. VIP Seat on Saturday (Weekend +10%, VIP Category +15%):
    # base = 500.0 * 1.10 (weekend) = 550.0 * 1.15 (VIP) = 632.50
    p2 = booking_service.calculate_seat_price(db_session, trip_weekend, s_vip)
    assert p2 == 632.50

    # Lock and Book normal Wednesday seat
    token = create_access_token(data["user"].id)
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip_normal.id), "seat_ids": [str(s_normal.id)]}, headers={"Authorization": f"Bearer {token}"})

    booking_payload = {
        "trip_id": str(trip_normal.id),
        "passengers": [{
            "seat_id": str(s_normal.id),
            "passenger_name": "Test Passenger",
            "passenger_age": 25,
            "passenger_gender": "female",
            "mobile": "+919999111888",
            "email": "passenger@test.com",
            "id_proof": "Aadhaar123",
            "emergency_contact": "+919999111777"
        }],
        "coupon_code": None,
        "use_wallet": False,
        "boarding_point_id": str(data["points"][0].id),
        "dropping_point_id": str(data["points"][1].id)
    }
    res = client.post("/api/v1/bookings/", json=booking_payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    booking = res.json()

    # Fare checks: base_fare=500.0, tax=500.0*0.05=25.0, final_amount=500.0+25.0+15.0(service_fee)=540.0
    assert booking["base_fare"] == 500.0
    assert booking["tax"] == 25.0
    assert booking["final_amount"] == 540.0

def test_coupon_validation_rules(client, setup_booking_engine_data, db_session):
    data = setup_booking_engine_data
    trip = data["trip_normal"]
    seat = data["seats"][0]
    token = create_access_token(data["user"].id)

    # Setup coupons
    # Coupon 1: First booking only
    c_first = Coupon(code="WELCOME50", discount_type="flat", discount_value=50.0, min_booking_amount=100.0, expires_at=datetime.now(timezone.utc)+timedelta(days=1), is_first_booking=True, is_active=True)
    # Coupon 2: Route specific
    c_route = Coupon(code="ROUTETEST", discount_type="flat", discount_value=30.0, min_booking_amount=100.0, expires_at=datetime.now(timezone.utc)+timedelta(days=1), route_id=data["route"].id, is_active=True)
    # Coupon 3: Expiry checking
    c_expired = Coupon(code="EXPIRED", discount_type="flat", discount_value=10.0, min_booking_amount=100.0, expires_at=datetime.now(timezone.utc)-timedelta(days=1), is_active=True)
    
    db_session.add_all([c_first, c_route, c_expired])
    db_session.commit()

    # Lock seat
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token}"})

    # 1. Try expired coupon -> Fails 400
    res = client.post("/api/v1/bookings/", json={
        "trip_id": str(trip.id),
        "passengers": [{"seat_id": str(seat.id), "passenger_name": "P1", "passenger_age": 20, "passenger_gender": "female"}],
        "coupon_code": "EXPIRED"
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

    # 2. Try first booking coupon -> Succeeds because user has no confirmed bookings
    res_first = client.post("/api/v1/bookings/", json={
        "trip_id": str(trip.id),
        "passengers": [{"seat_id": str(seat.id), "passenger_name": "P1", "passenger_age": 20, "passenger_gender": "female"}],
        "coupon_code": "WELCOME50"
    }, headers={"Authorization": f"Bearer {token}"})
    assert res_first.status_code == 201

def test_wallet_debits_and_refunds(client, setup_booking_engine_data, db_session):
    data = setup_booking_engine_data
    trip = data["trip_normal"]
    seat = data["seats"][0]
    token = create_access_token(data["user"].id)

    # 1. Book seat with wallet (amount = 540.0, wallet balance = 1000.0) -> Auto-confirms
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token}"})

    booking_payload = {
        "trip_id": str(trip.id),
        "passengers": [{"seat_id": str(seat.id), "passenger_name": "User", "passenger_age": 25, "passenger_gender": "female"}],
        "use_wallet": True
    }
    res = client.post("/api/v1/bookings/", json=booking_payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    booking = res.json()
    assert booking["status"] == "confirmed"
    assert booking["payment_status"] == "paid"
    
    # Check wallet balance: 1000.0 - 540.0 = 460.0
    db_session.refresh(data["wallet"])
    assert data["wallet"].balance == 460.0

    # 2. Cancel ticket and check partial refund (Mumbai-Pune departure in 2 days -> >24 hours -> 90% refund of final paid, which was 540.0)
    # 90% of 540.0 = 486.0 refunded back to wallet
    res_cancel = client.post("/api/v1/bookings/cancel", json={"booking_id": booking["id"]}, headers={"Authorization": f"Bearer {token}"})
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"

    db_session.refresh(data["wallet"])
    assert data["wallet"].balance == 460.0 + 486.0

    # Check Refund record exists in DB
    ref = db_session.query(Refund).filter(Refund.booking_id == UUID(booking["id"])).first()
    assert ref is not None
    assert ref.refund_amount == 486.0
    assert ref.status == "success"

def test_payment_retry_flow(client, setup_booking_engine_data, db_session):
    data = setup_booking_engine_data
    trip = data["trip_normal"]
    seat = data["seats"][0]
    token = create_access_token(data["user"].id)

    # 1. Create a pending booking without wallet
    client.post("/api/v1/bookings/seats/lock", json={"trip_id": str(trip.id), "seat_ids": [str(seat.id)]}, headers={"Authorization": f"Bearer {token}"})
    booking_payload = {
        "trip_id": str(trip.id),
        "passengers": [{"seat_id": str(seat.id), "passenger_name": "User", "passenger_age": 25, "passenger_gender": "female"}],
        "use_wallet": False
    }
    res = client.post("/api/v1/bookings/", json=booking_payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    booking_id = res.json()["id"]

    # 2. Trigger payment retry order generation -> 200 Order created
    res_retry = client.post(f"/api/v1/bookings/{booking_id}/retry", headers={"Authorization": f"Bearer {token}"})
    assert res_retry.status_code == 200
    assert "order_id" in res_retry.json()

    # 3. Simulate payment retry limit (mocking 3 failed attempts)
    for i in range(3):
        payment = Payment(
            booking_id=UUID(booking_id),
            transaction_id=f"txn-fail-{i}",
            payment_gateway="stripe",
            amount=540.0,
            status="failed"
        )
        db_session.add(payment)
    db_session.commit()

    # 4. Trying retry again should fail 400 since retry limit (3) is exceeded
    res_retry_fail = client.post(f"/api/v1/bookings/{booking_id}/retry", headers={"Authorization": f"Bearer {token}"})
    assert res_retry_fail.status_code == 400
    assert "retry limit" in res_retry_fail.json()["detail"].lower()
