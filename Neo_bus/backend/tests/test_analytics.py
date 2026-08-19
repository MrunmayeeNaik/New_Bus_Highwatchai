import pytest
from app.models.auth import Role, User
from app.models.buses import Trip, Bus, Route, Operator
from app.core.security import get_password_hash

def test_analytics_endpoints(client, db_session):
    # 1. Setup Role admin if not present
    admin_role = db_session.query(Role).filter(Role.name == "admin").first()
    if not admin_role:
        admin_role = Role(name="admin", description="Admin Role")
        db_session.add(admin_role)
        db_session.commit()
        db_session.refresh(admin_role)

    # 2. Register admin user
    payload = {
        "email": "analytics_admin@newbus.com",
        "phone": "+919999888811",
        "full_name": "Analytics Admin",
        "password": "adminpassword123",
        "role_name": "admin"
    }
    register_res = client.post("/api/v1/auth/register", json=payload)
    assert register_res.status_code == 201

    # 3. Log in to get token
    login_payload = {
        "identifier": "analytics_admin@newbus.com",
        "password": "adminpassword123"
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Test GET /admin/analytics/dashboard
    dash_res = client.get("/api/v1/admin/analytics/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "summary" in dash_data
    assert "routes" in dash_data
    assert "operators" in dash_data
    assert "time_series" in dash_data
    assert dash_data["summary"]["bookings"] == 0
    assert dash_data["summary"]["revenue"] == 0

    # 5. Test GET /admin/analytics/export/csv
    csv_res = client.get("/api/v1/admin/analytics/export/csv?report_type=daily", headers=headers)
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"] == "text/csv; charset=utf-8"
    assert "newbus_report_daily" in csv_res.headers["content-disposition"]
    
    # 6. Test GET /admin/analytics/export/pdf
    pdf_res = client.get("/api/v1/admin/analytics/export/pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "newbus_analytics_report" in pdf_res.headers["content-disposition"]

    # 7. Test unauthorized access (No token)
    unauth_res = client.get("/api/v1/admin/analytics/dashboard")
    assert unauth_res.status_code == 401
