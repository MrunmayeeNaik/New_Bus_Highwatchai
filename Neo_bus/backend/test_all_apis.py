import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_get_endpoint(path, name):
    url = f"{BASE_URL}{path}"
    print(f"Testing GET {path} ({name})... ", end="")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as res:
            if res.status == 200:
                data = json.loads(res.read().decode())
                print(f"OK (Status: 200, items: {len(data) if isinstance(data, list) else '1'})")
                return data
            else:
                print(f"FAILED (Status: {res.status})")
                return None
    except Exception as e:
        print(f"FAILED (Error: {e})")
        return None

def test_login(email, password):
    url = f"{BASE_URL}/auth/login"
    print(f"Testing POST /auth/login for {email}... ", end="")
    try:
        # Form urlencoded request
        params = f"username={email}&password={password}".encode('utf-8')
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        req = urllib.request.Request(url, data=params, headers=headers)
        with urllib.request.urlopen(req) as res:
            if res.status == 200:
                data = json.loads(res.read().decode())
                print("OK (Status: 200)")
                return data.get("access_token")
            else:
                print(f"FAILED (Status: {res.status})")
                return None
    except Exception as e:
        print(f"FAILED (Error: {e})")
        return None

def test_authenticated_get(path, token, name):
    url = f"{BASE_URL}{path}"
    print(f"Testing Authenticated GET {path} ({name})... ", end="")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as res:
            if res.status == 200:
                data = json.loads(res.read().decode())
                print(f"OK (Status: 200)")
                return data
            else:
                print(f"FAILED (Status: {res.status})")
                return None
    except Exception as e:
        print(f"FAILED (Error: {e})")
        return None

def main():
    print("====================================================")
    print("NEW BUS API E2E VALIDATION REPORT")
    print("====================================================")
    
    # 1. Check Master Catalogs (Public endpoints)
    cities = test_get_endpoint("/master/cities", "Master Cities")
    test_get_endpoint("/master/routes", "Master Routes")
    test_get_endpoint("/master/operators", "Master Operators")
    
    # 2. Check search engine endpoint
    if cities and len(cities) >= 2:
        from_city = cities[0]['id']
        to_city = cities[1]['id']
        test_get_endpoint(f"/trips/search?from_city_id={from_city}&to_city_id={to_city}&date=2026-08-01", "Trip Search Engine")
    else:
        print("Skipping search test: Not enough cities found.")

    # 3. Check Authentication & Logins
    passenger_token = test_login("passenger@newbus.com", "password123")
    admin_token = test_login("admin@newbus.com", "admin123")
    
    # 4. Check Passenger Profile & Wallet
    if passenger_token:
        test_authenticated_get("/passenger/profile", passenger_token, "Passenger Profile")
        test_authenticated_get("/wallet/balance", passenger_token, "Passenger Wallet")
    
    # 5. Check Admin logs & bookings
    if admin_token:
        test_authenticated_get("/admin/bookings", admin_token, "Admin Detailed Booking Audit Logs")
        test_authenticated_get("/admin/users", admin_token, "Admin Users List")
        test_authenticated_get("/admin/logs", admin_token, "Admin Detailed System Audit Logs")

    print("====================================================")
    print("E2E API Test Completed.")
    print("====================================================")

if __name__ == "__main__":
    main()
