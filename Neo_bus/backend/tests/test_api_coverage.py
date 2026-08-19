import pytest
from app.models.master import Country, BusType, SeatType, VehicleCategory, Tax, CancellationPolicy, RefundRule
from app.models.buses import State, City, Route, Bus, Operator, Trip
from app.models.auth import Role, User

def test_public_master_endpoints(client, db_session):
    # Verify public catalog endpoints
    resp = client.get("/api/v1/master/countries")
    assert resp.status_code == 200
    
    resp = client.get("/api/v1/master/bus-types")
    assert resp.status_code == 200

    resp = client.get("/api/v1/master/seat-types")
    assert resp.status_code == 200

    resp = client.get("/api/v1/master/vehicle-categories")
    assert resp.status_code == 200

    resp = client.get("/api/v1/master/taxes")
    assert resp.status_code == 200

    resp = client.get("/api/v1/master/cancellation-policies")
    assert resp.status_code == 200

    resp = client.get("/api/v1/master/refund-rules")
    assert resp.status_code == 200

def test_search_trips_missing_params(client):
    # Missing source/destination parameters -> should fail with 422 or 400
    resp = client.get("/api/v1/bookings/search")
    assert resp.status_code in [400, 422]

def test_passenger_profile_authentication(client):
    # Access profile without token -> should fail with 401
    resp = client.get("/api/v1/passenger/profile")
    assert resp.status_code == 401

    # Access wallet without token -> should fail with 401
    resp = client.get("/api/v1/auth/wallet")
    assert resp.status_code == 401

def test_authenticated_passenger_flows(client, db_session):
    # 1. Setup Role passenger if not present
    pass_role = db_session.query(Role).filter(Role.name == "passenger").first()
    if not pass_role:
        pass_role = Role(name="passenger", description="Passenger Role")
        db_session.add(pass_role)
        db_session.commit()
        db_session.refresh(pass_role)

    # 2. Register user
    payload = {
        "email": "cov_passenger@newbus.com",
        "phone": "+919999888899",
        "full_name": "Coverage Passenger",
        "password": "passengerpass123",
        "role_name": "passenger"
    }
    client.post("/api/v1/auth/register", json=payload)

    # 3. Log in
    login_payload = {
        "identifier": "cov_passenger@newbus.com",
        "password": "passengerpass123"
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Access passenger endpoints
    profile_res = client.get("/api/v1/passenger/profile", headers=headers)
    assert profile_res.status_code == 200
    assert profile_res.json()["email"] == "cov_passenger@newbus.com"

    # 5. Top up wallet (which initializes it)
    topup_res = client.post("/api/v1/passenger/wallet/topup", json={"amount": 500.0}, headers=headers)
    assert topup_res.status_code == 200
    assert topup_res.json()["balance"] >= 500.0

    # 6. Read wallet
    wallet_res = client.get("/api/v1/auth/wallet", headers=headers)
    assert wallet_res.status_code == 200
    assert wallet_res.json()["balance"] >= 500.0
