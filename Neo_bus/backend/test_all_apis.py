"""End-to-end smoke check against a running New Bus API.

Unlike the pytest suite (which runs against an in-memory database), this hits a
live server over HTTP — so it verifies wiring the unit tests cannot: routing,
auth headers, serialisation and PDF generation.

Usage:
    python test_all_apis.py                 # defaults to http://127.0.0.1:8000
    NEOBUS_API=http://localhost:3000/api python test_all_apis.py

Exits non-zero if any check fails, so it is safe to use in CI.
"""

import datetime
import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("NEOBUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
DEMO_PASSWORD = "password123"

passed = 0
failed = 0


def request(method, path, body=None, token=None, raw=False):
    """Return (status, payload). Never raises — a transport error is status -1."""
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(BASE_URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            content = res.read()
            if raw:
                return res.status, content
            return res.status, json.loads(content.decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]
    except Exception as e:  # connection refused, timeout, DNS
        return -1, str(e)[:200]


def check(label, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  PASS  {label}" + (f"  ({detail})" if detail else ""))
    else:
        failed += 1
        print(f"  FAIL  {label}" + (f"  -> {detail}" if detail else ""))
    return ok


def section(title):
    print(f"\n{title}")
    print("-" * len(title))


def main():
    print("=" * 60)
    print("NEW BUS API SMOKE TEST")
    print(f"target: {BASE_URL}")
    print("=" * 60)

    section("Server reachable")
    status, _ = request("GET", "")
    if status == -1:
        # The root route lives outside /api/v1, so probe master data instead.
        status, _ = request("GET", "/master/cities")
    if not check("API responds", status > 0, "is the server running?"):
        print("\nAborting: cannot reach the API.")
        return 1

    section("Public master data")
    status, cities = request("GET", "/master/cities")
    check("GET /master/cities", status == 200 and isinstance(cities, list) and cities,
          f"status={status}")
    for path in ("/master/routes", "/master/operators", "/master/amenities"):
        s, d = request("GET", path)
        check(f"GET {path}", s == 200, f"status={s}")

    section("Search engine")
    if isinstance(cities, list) and len(cities) >= 2:
        by_name = {c["name"]: c["id"] for c in cities}
        src, dst = ("Mumbai", "Pune") if {"Mumbai", "Pune"} <= by_name.keys() else \
                   (cities[0]["name"], cities[1]["name"])
        found = False
        for offset in range(0, 4):
            day = (datetime.date.today() + datetime.timedelta(days=offset)).isoformat()
            s, trips = request(
                "GET",
                f"/bookings/search?source_city_id={by_name[src]}"
                f"&destination_city_id={by_name[dst]}&journey_date={day}",
            )
            if s == 200 and trips:
                found = True
                check(f"GET /bookings/search ({src}->{dst})", True, f"{len(trips)} trips on {day}")
                break
        if not found:
            check(f"GET /bookings/search ({src}->{dst})", False,
                  "no trips in the next 4 days - run seed_all_demo.py")
    else:
        check("search", False, "need at least two cities - run seed_all_demo.py")

    section("Authentication")
    tokens = {}
    for email in ("passenger@newbus.com", "operator@newbus.com",
                  "support@newbus.com", "admin@newbus.com"):
        s, body = request("POST", "/auth/login",
                          {"identifier": email, "password": DEMO_PASSWORD})
        ok = check(f"login {email}", s == 200 and isinstance(body, dict)
                   and "access_token" in body, f"status={s}")
        if ok:
            tokens[email] = body["access_token"]

    s, _ = request("POST", "/auth/login",
                   {"identifier": "passenger@newbus.com", "password": "wrong-password"})
    check("wrong password rejected", s == 401, f"status={s}")

    section("Passenger endpoints")
    pt = tokens.get("passenger@newbus.com")
    if pt:
        for path in ("/passenger/profile", "/passenger/notifications",
                     "/passenger/wallet/transactions", "/bookings/history"):
            s, _ = request("GET", path, token=pt)
            check(f"GET {path}", s == 200, f"status={s}")

        s, _ = request("GET", "/bookings/history")
        check("history requires auth", s == 401, f"status={s}")

        s, history = request("GET", "/bookings/history", token=pt)
        confirmed = [b for b in history if b.get("status") == "confirmed"] \
            if isinstance(history, list) else []
        if confirmed:
            bid = confirmed[0]["id"]
            s, pdf = request("GET", f"/bookings/{bid}/ticket", token=pt, raw=True)
            check("ticket PDF renders", s == 200 and pdf[:5] == b"%PDF-",
                  f"status={s}, {len(pdf) if s == 200 else 0} bytes")
            s, pdf = request("GET", f"/bookings/{bid}/invoice", token=pt, raw=True)
            check("invoice PDF renders", s == 200 and pdf[:5] == b"%PDF-", f"status={s}")
        else:
            print("  SKIP  ticket/invoice PDF (no confirmed booking for this user)")
    else:
        check("passenger endpoints", False, "no passenger token")

    section("Admin endpoints")
    at = tokens.get("admin@newbus.com")
    if at:
        for path in ("/admin/users", "/admin/audit-logs", "/admin/reports/platform"):
            s, _ = request("GET", path, token=at)
            check(f"GET {path}", s == 200, f"status={s}")
    else:
        check("admin endpoints", False, "no admin token")

    if pt:
        s, _ = request("GET", "/admin/users", token=pt)
        check("passenger blocked from /admin/users", s in (401, 403), f"status={s}")

    print("\n" + "=" * 60)
    print(f"RESULT: {passed} passed, {failed} failed")
    print("=" * 60)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
