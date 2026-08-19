from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import io
import csv

from app.core.database import get_db
from app.services.auth import require_roles
from app.models.auth import User
from app.models.bookings import Booking
from app.models.buses import Trip, Bus, Route, Operator, City
from app.services.pdf_generator import PDFGenerator

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics"])

def compile_analytics_data(db: Session, start_dt: Optional[datetime] = None, end_dt: Optional[datetime] = None) -> dict:
    # 1. Base Queries
    bookings_query = db.query(Booking).options(
        joinedload(Booking.trip).joinedload(Trip.route).joinedload(Route.source_city),
        joinedload(Booking.trip).joinedload(Trip.route).joinedload(Route.destination_city),
        joinedload(Booking.trip).joinedload(Trip.bus),
        joinedload(Booking.operator)
    )
    trips_query = db.query(Trip).options(
        joinedload(Trip.bus),
        joinedload(Trip.route).joinedload(Route.source_city),
        joinedload(Trip.route).joinedload(Route.destination_city),
        joinedload(Trip.operator),
        joinedload(Trip.bookings)
    )
    
    if start_dt:
        bookings_query = bookings_query.filter(Booking.created_at >= start_dt)
        trips_query = trips_query.filter(Trip.departure_time >= start_dt)
    if end_dt:
        bookings_query = bookings_query.filter(Booking.created_at <= end_dt)
        trips_query = trips_query.filter(Trip.departure_time <= end_dt)
        
    bookings = bookings_query.all()
    trips = trips_query.all()

    # 2. Executive Summary Metrics
    total_bookings = len(bookings)
    confirmed_bookings = [b for b in bookings if b.status == "confirmed"]
    cancelled_bookings = [b for b in bookings if b.status == "cancelled"]
    
    revenue = sum(b.final_amount for b in confirmed_bookings)
    cancellation_rate = (len(cancelled_bookings) / total_bookings * 100) if total_bookings > 0 else 0.0
    
    total_capacity = 0
    total_booked_seats = 0
    for trip in trips:
        if trip.bus:
            total_capacity += trip.bus.capacity
            trip_bookings = [b for b in bookings if b.trip_id == trip.id and b.status == "confirmed"]
            total_booked_seats += sum(b.passenger_count for b in trip_bookings)
            
    occupancy_rate = (total_booked_seats / total_capacity * 100) if total_capacity > 0 else 0.0

    # 3. Top Routes
    route_stats = {}
    for booking in bookings:
        trip = booking.trip
        if not trip or not trip.route:
            continue
        route = trip.route
        route_id = route.id
        source = route.source_city.name if route.source_city else "Unknown"
        dest = route.destination_city.name if route.destination_city else "Unknown"
        
        if route_id not in route_stats:
            route_stats[route_id] = {
                "route_id": str(route_id),
                "source": source,
                "destination": dest,
                "bookings_count": 0,
                "revenue": 0.0,
                "confirmed_seats": 0,
                "total_capacity": 0
            }
        
        route_stats[route_id]["bookings_count"] += 1
        if booking.status == "confirmed":
            route_stats[route_id]["revenue"] += booking.final_amount
            route_stats[route_id]["confirmed_seats"] += booking.passenger_count

    for trip in trips:
        if not trip.route or not trip.bus:
            continue
        r_id = trip.route.id
        if r_id in route_stats:
            route_stats[r_id]["total_capacity"] += trip.bus.capacity

    routes_list = []
    for r_id, stats in route_stats.items():
        cap = stats["total_capacity"]
        seats = stats["confirmed_seats"]
        stats["occupancy_pct"] = round((seats / cap * 100), 2) if cap > 0 else 0.0
        del stats["confirmed_seats"]
        del stats["total_capacity"]
        routes_list.append(stats)
    routes_list.sort(key=lambda x: x["revenue"], reverse=True)
    top_routes = routes_list[:10]

    # 4. Top Operators
    operator_stats = {}
    for booking in bookings:
        op = booking.operator
        if not op and booking.trip:
            op = booking.trip.operator
        if not op:
            continue
        op_id = op.id
        op_name = op.name
        
        if op_id not in operator_stats:
            operator_stats[op_id] = {
                "operator_id": str(op_id),
                "name": op_name,
                "bookings_count": 0,
                "revenue": 0.0,
                "confirmed_seats": 0,
                "total_capacity": 0
            }
            
        operator_stats[op_id]["bookings_count"] += 1
        if booking.status == "confirmed":
            operator_stats[op_id]["revenue"] += booking.final_amount
            operator_stats[op_id]["confirmed_seats"] += booking.passenger_count

    for trip in trips:
        if not trip.operator or not trip.bus:
            continue
        op_id = trip.operator.id
        if op_id in operator_stats:
            operator_stats[op_id]["total_capacity"] += trip.bus.capacity

    operators_list = []
    for op_id, stats in operator_stats.items():
        cap = stats["total_capacity"]
        seats = stats["confirmed_seats"]
        stats["occupancy_pct"] = round((seats / cap * 100), 2) if cap > 0 else 0.0
        del stats["confirmed_seats"]
        del stats["total_capacity"]
        operators_list.append(stats)
    operators_list.sort(key=lambda x: x["revenue"], reverse=True)
    top_operators = operators_list[:10]

    # 5. Time Series (Daily, Monthly, Yearly)
    daily_data = {}
    monthly_data = {}
    yearly_data = {}

    for b in bookings:
        dt = b.created_at
        d_key = dt.strftime("%Y-%m-%d")
        m_key = dt.strftime("%Y-%m")
        y_key = dt.strftime("%Y")
        
        for key, dataset in [(d_key, daily_data), (m_key, monthly_data), (y_key, yearly_data)]:
            if key not in dataset:
                dataset[key] = {
                    "bookings": 0,
                    "confirmed_bookings": 0,
                    "cancelled_bookings": 0,
                    "revenue": 0.0,
                    "confirmed_seats": 0,
                    "total_capacity": 0
                }
            dataset[key]["bookings"] += 1
            if b.status == "confirmed":
                dataset[key]["confirmed_bookings"] += 1
                dataset[key]["revenue"] += b.final_amount
                dataset[key]["confirmed_seats"] += b.passenger_count
            elif b.status == "cancelled":
                dataset[key]["cancelled_bookings"] += 1

    for t in trips:
        if not t.bus:
            continue
        dt = t.departure_time
        d_key = dt.strftime("%Y-%m-%d")
        m_key = dt.strftime("%Y-%m")
        y_key = dt.strftime("%Y")
        
        for key, dataset in [(d_key, daily_data), (m_key, monthly_data), (y_key, yearly_data)]:
            if key in dataset:
                dataset[key]["total_capacity"] += t.bus.capacity
            else:
                dataset[key] = {
                    "bookings": 0,
                    "confirmed_bookings": 0,
                    "cancelled_bookings": 0,
                    "revenue": 0.0,
                    "confirmed_seats": 0,
                    "total_capacity": t.bus.capacity
                }

    def post_process(dataset, label_name):
        res = []
        for key in sorted(dataset.keys()):
            s = dataset[key]
            bookings_count = s["bookings"]
            cancelled = s["cancelled_bookings"]
            cap = s["total_capacity"]
            seats = s["confirmed_seats"]
            
            c_pct = (cancelled / bookings_count * 100) if bookings_count > 0 else 0.0
            o_pct = (seats / cap * 100) if cap > 0 else 0.0
            
            res.append({
                label_name: key,
                "bookings": bookings_count,
                "revenue": round(s["revenue"], 2),
                "occupancy": round(o_pct, 2),
                "cancellations": round(c_pct, 2)
            })
        return res

    return {
        "summary": {
            "revenue": round(revenue, 2),
            "bookings": total_bookings,
            "occupancy": round(occupancy_rate, 2),
            "cancellation_rate": round(cancellation_rate, 2)
        },
        "routes": top_routes,
        "operators": top_operators,
        "time_series": {
            "daily": post_process(daily_data, "date"),
            "monthly": post_process(monthly_data, "month"),
            "yearly": post_process(yearly_data, "year")
        }
    }

@router.get("/dashboard")
def get_analytics_dashboard(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    if end_date:
        try:
            # End of specified day
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
            
    return compile_analytics_data(db, start_dt, end_dt)

@router.get("/export/csv")
def export_analytics_csv(
    report_type: str = Query("daily", pattern="^(daily|monthly|yearly|routes|operators)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        except ValueError:
            pass
            
    data = compile_analytics_data(db, start_dt, end_dt)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "daily":
        writer.writerow(["Date", "Bookings Count", "Revenue (INR)", "Occupancy %", "Cancellation %"])
        for r in data["time_series"]["daily"]:
            writer.writerow([r["date"], r["bookings"], r["revenue"], r["occupancy"], r["cancellations"]])
    elif report_type == "monthly":
        writer.writerow(["Month", "Bookings Count", "Revenue (INR)", "Occupancy %", "Cancellation %"])
        for r in data["time_series"]["monthly"]:
            writer.writerow([r["month"], r["bookings"], r["revenue"], r["occupancy"], r["cancellations"]])
    elif report_type == "yearly":
        writer.writerow(["Year", "Bookings Count", "Revenue (INR)", "Occupancy %", "Cancellation %"])
        for r in data["time_series"]["yearly"]:
            writer.writerow([r["year"], r["bookings"], r["revenue"], r["occupancy"], r["cancellations"]])
    elif report_type == "routes":
        writer.writerow(["Route Source", "Route Destination", "Bookings Count", "Revenue (INR)", "Occupancy %"])
        for r in data["routes"]:
            writer.writerow([r["source"], r["destination"], r["bookings_count"], r["revenue"], r["occupancy_pct"]])
    elif report_type == "operators":
        writer.writerow(["Operator Name", "Bookings Count", "Revenue (INR)", "Occupancy %"])
        for r in data["operators"]:
            writer.writerow([r["name"], r["bookings_count"], r["revenue"], r["occupancy_pct"]])
            
    output.seek(0)
    
    response = StreamingResponse(io.StringIO(output.getvalue()), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=newbus_report_{report_type}.csv"
    return response

@router.get("/export/pdf")
def export_analytics_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        except ValueError:
            pass
            
    data = compile_analytics_data(db, start_dt, end_dt)
    
    pdf_bytes = PDFGenerator.generate_analytics_pdf(data)
    
    response = StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf")
    response.headers["Content-Disposition"] = "attachment; filename=newbus_analytics_report.pdf"
    return response
