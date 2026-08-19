import pytest
from app.models.auth import Role, User

def test_rbac_passenger_blocked_from_admin(client, db_session):
    # 1. Setup Role passenger if not present
    pass_role = db_session.query(Role).filter(Role.name == "passenger").first()
    if not pass_role:
        pass_role = Role(name="passenger", description="Passenger Role")
        db_session.add(pass_role)
        db_session.commit()
        db_session.refresh(pass_role)

    # 2. Register standard passenger
    payload = {
        "email": "hacker_passenger@newbus.com",
        "phone": "+919999111122",
        "full_name": "Hacker Passenger",
        "password": "mypassword123",
        "role_name": "passenger"
    }
    client.post("/api/v1/auth/register", json=payload)

    # 3. Log in
    login_payload = {
        "identifier": "hacker_passenger@newbus.com",
        "password": "mypassword123"
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Attempt to access admin routes -> must be blocked with 403
    resp = client.get("/api/v1/admin/users", headers=headers)
    assert resp.status_code == 403

    resp = client.get("/api/v1/admin/analytics/dashboard", headers=headers)
    assert resp.status_code == 403

    resp = client.post("/api/v1/admin/countries", json={"name": "Attacked", "code": "AT"}, headers=headers)
    assert resp.status_code == 403

def test_sql_injection_resilience(client, db_session):
    # 1. Setup Role passenger if not present
    pass_role = db_session.query(Role).filter(Role.name == "passenger").first()
    if not pass_role:
        pass_role = Role(name="passenger", description="Passenger Role")
        db_session.add(pass_role)
        db_session.commit()

    # Pass SQL Injection strings as search parameter
    sql_payload = "' OR '1'='1' --"
    
    # Attempt login with SQL Injection in username -> should fail gracefully (no exceptions, just 401/400)
    login_payload = {
        "identifier": sql_payload,
        "password": "somepassword"
    }
    resp = client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code in [400, 401, 404]

    # Attempt to search trips with SQL Injection strings in date -> should fail gracefully with 422 or return empty list
    resp = client.get(f"/api/v1/bookings/search?source_city_id=00000000-0000-0000-0000-000000000000&destination_city_id=00000000-0000-0000-0000-000000000000&journey_date={sql_payload}")
    assert resp.status_code in [400, 422, 200]
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)

def test_xss_prevention(client, db_session):
    # 1. Setup Role passenger
    pass_role = db_session.query(Role).filter(Role.name == "passenger").first()
    if not pass_role:
        pass_role = Role(name="passenger", description="Passenger Role")
        db_session.add(pass_role)
        db_session.commit()
        db_session.refresh(pass_role)

    # 2. Register user with XSS script payload in name
    xss_payload = "<script>alert('XSS_ATTACK')</script>"
    payload = {
        "email": "xss_user@newbus.com",
        "phone": "+919999111133",
        "full_name": xss_payload,
        "password": "passengerpass123",
        "role_name": "passenger"
    }
    register_res = client.post("/api/v1/auth/register", json=payload)
    assert register_res.status_code == 201
    
    # Verify the output is returned as literal string and does not fail serialization
    data = register_res.json()
    assert data["full_name"] == xss_payload

def test_jwt_malformation_rejection(client):
    # Expired or modified JWT
    headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"}
    resp = client.get("/api/v1/passenger/profile", headers=headers)
    assert resp.status_code in [401, 403]
