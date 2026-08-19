import pytest
from app.models.auth import User, Role, Wallet
from app.models.buses import State, City, Route
from app.models.passenger import SavedPassenger, FavoriteRoute, SearchHistory
from app.models.feedback import Notification
from app.core.security import create_access_token

@pytest.fixture
def test_passenger(db_session):
    role = Role(name="passenger", description="Passenger Role")
    db_session.add(role)
    db_session.flush()
    
    user = User(
        email="psg_test@newbus.com",
        phone="+919999000111",
        full_name="Passenger Test",
        hashed_password="hashedpassword123",
        role_id=role.id,
        reward_points=150
    )
    db_session.add(user)
    db_session.flush()
    
    wallet = Wallet(user_id=user.id, balance=125.50)
    db_session.add(wallet)
    db_session.commit()
    return user

@pytest.fixture
def auth_headers(test_passenger):
    token = create_access_token(test_passenger.id)
    return {"Authorization": f"Bearer {token}"}

def test_get_passenger_profile(client, test_passenger, auth_headers):
    response = client.get("/api/v1/passenger/profile", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "psg_test@newbus.com"
    assert data["full_name"] == "Passenger Test"
    assert data["reward_points"] == 150
    assert data["wallet_balance"] == 125.50

def test_update_emergency_contact(client, test_passenger, auth_headers, db_session):
    payload = {
        "emergency_contact_name": "Emergency Person",
        "emergency_contact_phone": "+919999000222",
        "emergency_contact_relation": "Brother"
    }
    response = client.put("/api/v1/passenger/emergency-contact", json=payload, headers=auth_headers)
    assert response.status_code == 200
    
    # Reload and check
    db_session.refresh(test_passenger)
    assert test_passenger.emergency_contact_name == "Emergency Person"
    assert test_passenger.emergency_contact_phone == "+919999000222"
    assert test_passenger.emergency_contact_relation == "Brother"

def test_saved_passengers_crud(client, test_passenger, auth_headers, db_session):
    # 1. Create saved passenger
    payload = {
        "name": "Companion One",
        "age": 28,
        "gender": "female"
    }
    response = client.post("/api/v1/passenger/saved-passengers", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Companion One"
    assert data["age"] == 28
    assert data["gender"] == "female"
    companion_id = data["id"]
    
    # 2. List saved passengers
    response = client.get("/api/v1/passenger/saved-passengers", headers=auth_headers)
    assert response.status_code == 200
    list_data = response.json()
    assert len(list_data) == 1
    assert list_data[0]["name"] == "Companion One"
    
    # 3. Delete saved passenger
    response = client.delete(f"/api/v1/passenger/saved-passengers/{companion_id}", headers=auth_headers)
    assert response.status_code == 200
    
    # 4. Verify list is empty
    response = client.get("/api/v1/passenger/saved-passengers", headers=auth_headers)
    assert len(response.json()) == 0

def test_favorite_routes(client, test_passenger, auth_headers, db_session):
    # Setup route
    state = State(name="FavState", code="FS")
    db_session.add(state)
    db_session.flush()
    c1 = City(name="SourceA", code="SRA", state_id=state.id)
    c2 = City(name="DestB", code="DTB", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.flush()
    route = Route(source_city_id=c1.id, destination_city_id=c2.id, distance_km=180.0, duration_minutes=240)
    db_session.add(route)
    db_session.commit()
    
    # 1. Add favorite
    response = client.post("/api/v1/passenger/favorites", json={"route_id": str(route.id)}, headers=auth_headers)
    assert response.status_code == 200
    
    # 2. List favorites
    response = client.get("/api/v1/passenger/favorites", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["source_city"] == "SourceA"
    assert data[0]["destination_city"] == "DestB"
    fav_id = data[0]["id"]
    
    # 3. Delete favorite
    response = client.delete(f"/api/v1/passenger/favorites/{fav_id}", headers=auth_headers)
    assert response.status_code == 200
    
    # 4. Verify empty
    response = client.get("/api/v1/passenger/favorites", headers=auth_headers)
    assert len(response.json()) == 0

def test_search_history(client, test_passenger, auth_headers, db_session):
    state = State(name="SearchState", code="SS")
    db_session.add(state)
    db_session.flush()
    c1 = City(name="SearchA", code="SHA", state_id=state.id)
    c2 = City(name="SearchB", code="SHB", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.commit()
    
    # 1. Log search
    payload = {
        "source_city_id": str(c1.id),
        "destination_city_id": str(c2.id)
    }
    response = client.post("/api/v1/passenger/search-history", json=payload, headers=auth_headers)
    assert response.status_code == 200
    
    # 2. Fetch history
    response = client.get("/api/v1/passenger/search-history", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["source_city_name"] == "SearchA"
    assert data[0]["destination_city_name"] == "SearchB"

def test_wallet_topup(client, test_passenger, auth_headers, db_session):
    # 1. Topup wallet
    response = client.post("/api/v1/passenger/wallet/topup", json={"amount": 350.0}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["balance"] == 475.50
    
    # 2. Fetch ledger transaction history
    response = client.get("/api/v1/passenger/wallet/transactions", headers=auth_headers)
    assert response.status_code == 200
    transactions = response.json()
    assert len(transactions) == 1
    assert transactions[0]["amount"] == 350.0
    assert transactions[0]["transaction_type"] == "credit"
