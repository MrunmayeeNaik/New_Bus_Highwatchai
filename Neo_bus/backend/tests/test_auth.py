def test_register_user(client):
    # Test valid passenger registration
    payload = {
        "email": "test_passenger@newbus.com",
        "phone": "+919999888877",
        "full_name": "Test Passenger",
        "password": "strongpassword123",
        "role_name": "passenger"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test_passenger@newbus.com"
    assert data["full_name"] == "Test Passenger"
    assert "id" in data
    
def test_login_user(client):
    # Register passenger
    payload = {
        "email": "login_user@newbus.com",
        "phone": "+919999888866",
        "full_name": "Login User",
        "password": "mypassword123",
        "role_name": "passenger"
    }
    client.post("/api/v1/auth/register", json=payload)
    
    # 1. Login via email + password -> Should work
    login_payload_email = {
        "identifier": "login_user@newbus.com",
        "password": "mypassword123"
    }
    response = client.post("/api/v1/auth/login", json=login_payload_email)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["role"] == "passenger"

    # 2. Login via phone + password -> Should work
    login_payload_phone = {
        "identifier": "+919999888866",
        "password": "mypassword123"
    }
    response = client.post("/api/v1/auth/login", json=login_payload_phone)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["role"] == "passenger"

def test_send_and_verify_otp_phone(client, db_session):
    from app.models.auth import OTPVerification, User
    # Register first
    payload = {
        "email": "otp_user@newbus.com",
        "phone": "+919999888844",
        "full_name": "OTP User",
        "password": "mypassword123",
        "role_name": "passenger"
    }
    client.post("/api/v1/auth/register", json=payload)
    
    # Check if a verification OTP was automatically created
    otp_entry = db_session.query(OTPVerification).filter_by(email="otp_user@newbus.com", purpose="email_verification").first()
    assert otp_entry is not None
    
    # Try verifying the OTP using phone
    verify_payload = {
        "phone": "+919999888844",
        "otp_code": otp_entry.otp_code,
        "purpose": "email_verification"
    }
    response = client.post("/api/v1/auth/verify-otp", json=verify_payload)
    assert response.status_code == 200
    
    # Check if user is now verified
    user_entry = db_session.query(User).filter_by(email="otp_user@newbus.com").first()
    assert user_entry.is_verified is True

def test_forgot_and_reset_password_operator(client, db_session):
    from app.models.auth import OTPVerification
    # Register operator
    payload = {
        "email": "forgot_operator@newbus.com",
        "phone": "+919999888833",
        "full_name": "Forgot Operator",
        "password": "oldpassword123",
        "role_name": "operator"
    }
    client.post("/api/v1/auth/register", json=payload)
    
    # Request forgot password
    response = client.post("/api/v1/auth/forgot-password", json={"email": "forgot_operator@newbus.com"})
    assert response.status_code == 200
    
    # Fetch reset OTP
    otp_entry = db_session.query(OTPVerification).filter_by(email="forgot_operator@newbus.com", purpose="password_reset").first()
    assert otp_entry is not None
    
    # Verify OTP
    verify_payload = {
        "email": "forgot_operator@newbus.com",
        "otp_code": otp_entry.otp_code,
        "purpose": "password_reset"
    }
    verify_response = client.post("/api/v1/auth/verify-otp", json=verify_payload)
    assert verify_response.status_code == 200
    reset_token = verify_response.json()["reset_token"]
    assert reset_token is not None
    
    # Reset password
    reset_payload = {
        "token": reset_token,
        "new_password": "newpassword123"
    }
    reset_response = client.post("/api/v1/auth/reset-password", json=reset_payload)
    assert reset_response.status_code == 200
    
    # Verify we can login with the new password
    login_payload = {
        "identifier": "forgot_operator@newbus.com",
        "password": "newpassword123"
    }
    login_response = client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200
