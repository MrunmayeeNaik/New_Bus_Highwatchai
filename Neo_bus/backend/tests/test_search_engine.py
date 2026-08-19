import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.models.auth import User, Role
from app.models.buses import State, City, Route, Operator, Bus, Amenity, Trip, bus_amenities
from app.core.security import create_access_token
from app.services.bookings import booking_service

@pytest.fixture
def setup_search_test_data(db_session):
    passenger_role = Role(name="passenger", description="Passenger Role")
    db_session.add(passenger_role)
    db_session.flush()

    user = User(email="searcher@test.com", phone="+919999222333", full_name="Search User", hashed_password="pwd", role_id=passenger_role.id)
    db_session.add(user)
    db_session.flush()

    state = State(name="SearchState", code="SS")
    db_session.add(state)
    db_session.flush()

    c1 = City(name="SearchSource", code="SSC", state_id=state.id)
    c2 = City(name="SearchDest", code="SDC", state_id=state.id)
    db_session.add_all([c1, c2])
    db_session.flush()

    route = Route(source_city_id=c1.id, destination_city_id=c2.id, distance_km=150.0, duration_minutes=180, is_active=True)
    db_session.add(route)
    db_session.flush()

    op_a = Operator(name="Alpha Travels", email="alpha@travels.com", phone="+918888777666", rating=4.5)
    op_b = Operator(name="Beta Movers", email="beta@movers.com", phone="+918888777555", rating=3.8)
    db_session.add_all([op_a, op_b])
    db_session.flush()

    bus_a = Bus(operator_id=op_a.id, bus_number="MH-12-AAA", bus_type="AC_Sleeper", capacity=30)
    bus_b = Bus(operator_id=op_b.id, bus_number="MH-12-BBB", bus_type="Non_AC_Seater", capacity=40)
    db_session.add_all([bus_a, bus_b])
    db_session.flush()

    # Amenities
    wifi = Amenity(name="WiFi")
    gps = Amenity(name="GPS")
    db_session.add_all([wifi, gps])
    db_session.flush()

    # Map amenities
    bus_a.amenities.append(wifi)
    bus_a.amenities.append(gps)
    bus_b.amenities.append(gps)
    db_session.flush()

    # Create trips departing tomorrow morning and evening
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    dep_morning = datetime.combine(tomorrow.date(), datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=8) # 8:00 AM
    dep_evening = datetime.combine(tomorrow.date(), datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=19) # 7:00 PM

    trip_a = Trip(
        bus_id=bus_a.id,
        operator_id=op_a.id,
        route_id=route.id,
        departure_time=dep_morning,
        arrival_time=dep_morning + timedelta(hours=3),
        price=300.0,
        use_dynamic_pricing=False
    )
    trip_b = Trip(
        bus_id=bus_b.id,
        operator_id=op_b.id,
        route_id=route.id,
        departure_time=dep_evening,
        arrival_time=dep_evening + timedelta(hours=3),
        price=150.0,
        use_dynamic_pricing=False
    )
    db_session.add_all([trip_a, trip_b])
    db_session.commit()

    return {
        "user": user,
        "c1": c1,
        "c2": c2,
        "route": route,
        "trip_a": trip_a,
        "trip_b": trip_b,
        "journey_date_str": tomorrow.strftime("%Y-%m-%d")
    }

def test_search_validation_failures(client, setup_search_test_data):
    data = setup_search_test_data
    c1_id = str(data["c1"].id)
    c2_id = str(data["c2"].id)
    date_str = data["journey_date_str"]

    # 1. Matching source & destination
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c1_id}&journey_date={date_str}")
    assert res.status_code == 400
    assert "cities cannot be the same" in res.json()["detail"]

    # 2. Past journey date
    past_date = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={past_date}")
    assert res.status_code == 400
    assert "cannot be in the past" in res.json()["detail"]

    # 3. Negative minimum price bounds
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&min_price=-50")
    assert res.status_code == 400
    assert "cannot be negative" in res.json()["detail"]

    # 4. Min price greater than max price
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&min_price=500&max_price=200")
    assert res.status_code == 400
    assert "greater than maximum" in res.json()["detail"]

def test_search_advanced_filtering(client, setup_search_test_data):
    data = setup_search_test_data
    c1_id = str(data["c1"].id)
    c2_id = str(data["c2"].id)
    date_str = data["journey_date_str"]

    # Filter 1: Amenities (WiFi) -> should only return Trip A (Alpha Travels)
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&amenities=WiFi")
    assert res.status_code == 200
    res_data = res.json()
    assert len(res_data) == 1
    assert res_data[0]["operator"]["name"] == "Alpha Travels"

    # Filter 2: Max Price (under 200) -> should only return Trip B (Beta Movers)
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&max_price=200")
    assert res.status_code == 200
    res_data = res.json()
    assert len(res_data) == 1
    assert res_data[0]["operator"]["name"] == "Beta Movers"

    # Filter 3: Departure period (Evening) -> returns Trip B (Beta Movers)
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&departure_period=evening")
    assert res.status_code == 200
    res_data = res.json()
    assert len(res_data) == 1
    assert res_data[0]["operator"]["name"] == "Beta Movers"

def test_search_sorting_and_pagination(client, setup_search_test_data):
    data = setup_search_test_data
    c1_id = str(data["c1"].id)
    c2_id = str(data["c2"].id)
    date_str = data["journey_date_str"]

    # Sort: Price Low to High (price_asc) -> Trip B (150) then Trip A (300)
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&sort_by=price_asc")
    assert res.status_code == 200
    res_data = res.json()
    assert len(res_data) == 2
    assert res_data[0]["price"] == 150.0
    assert res_data[1]["price"] == 300.0

    # Sort: Price High to Low (price_desc) -> Trip A (300) then Trip B (150)
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&sort_by=price_desc")
    assert res.status_code == 200
    res_data = res.json()
    assert len(res_data) == 2
    assert res_data[0]["price"] == 300.0
    assert res_data[1]["price"] == 150.0

    # Pagination: limit=1, offset=0 -> returns only 1 trip
    res = client.get(f"/api/v1/bookings/search?source_city_id={c1_id}&destination_city_id={c2_id}&journey_date={date_str}&limit=1&offset=0")
    assert res.status_code == 200
    assert len(res.json()) == 1
