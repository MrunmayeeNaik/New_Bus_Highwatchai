from typing import Optional, List
from datetime import datetime, time, timezone
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.buses import State, City, Route, Stop, Bus, Amenity, Seat, Trip, Schedule, SeatLock, Operator, OperatorStaff

class CityRepository(BaseRepository[City]):
    def get_active_cities(self, db: Session) -> List[City]:
        return db.query(self.model).filter(City.is_active == True, City.deleted_at.is_(None)).all()

class RouteRepository(BaseRepository[Route]):
    def get_by_cities(self, db: Session, source_id: str, dest_id: str) -> Optional[Route]:
        return db.query(self.model).filter(
            Route.source_city_id == source_id,
            Route.destination_city_id == dest_id,
            Route.is_active == True,
            Route.deleted_at.is_(None)
        ).first()

class BusRepository(BaseRepository[Bus]):
    def get_operator_buses(self, db: Session, operator_id: str) -> List[Bus]:
        return db.query(self.model).filter(Bus.operator_id == operator_id, Bus.deleted_at.is_(None)).all()

class TripRepository(BaseRepository[Trip]):
    def search_trips(
        self,
        db: Session,
        source_id: str,
        dest_id: str,
        journey_date: datetime,
        bus_type: Optional[str] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        departure_time_bucket: Optional[str] = None,
    ) -> List[Trip]:
        # Filter route
        route = db.query(Route).filter(
            Route.source_city_id == source_id,
            Route.destination_city_id == dest_id,
            Route.is_active == True,
            Route.deleted_at.is_(None)
        ).first()
        
        if not route:
            return []
            
        # Get start/end of the journey date
        start_date = datetime.combine(journey_date.date(), time.min).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(journey_date.date(), time.max).replace(tzinfo=timezone.utc)
        
        query = db.query(Trip).filter(
            Trip.route_id == route.id,
            Trip.departure_time >= start_date,
            Trip.departure_time <= end_date,
            Trip.status == "scheduled",
            Trip.deleted_at.is_(None)
        )
        
        # Apply filters
        if bus_type:
            query = query.join(Bus).filter(Bus.bus_type == bus_type)
        if max_price:
            query = query.filter(Trip.price <= max_price)
        if min_rating:
            query = query.join(Operator).filter(Operator.rating >= min_rating)
            
        if departure_time_bucket:
            # morning: 6am - 12pm, afternoon: 12pm - 6pm, evening: 6pm - 12am, night: 12am - 6am
            # extraction from departure_time
            pass  # we can apply filters in service layer or standard sqlalchemy time extraction
            
        return query.all()

class SeatLockRepository(BaseRepository[SeatLock]):
    def get_active_locks_for_trip(self, db: Session, trip_id: str) -> List[SeatLock]:
        now = datetime.now(timezone.utc)
        return db.query(self.model).filter(
            SeatLock.trip_id == trip_id,
            SeatLock.expires_at > now
        ).all()

    def check_lock_exists(self, db: Session, trip_id: str, seat_id: str) -> bool:
        now = datetime.now(timezone.utc)
        lock = db.query(self.model).filter(
            SeatLock.trip_id == trip_id,
            SeatLock.seat_id == seat_id,
            SeatLock.expires_at > now
        ).first()
        return lock is not None

    def release_expired_locks(self, db: Session) -> int:
        now = datetime.now(timezone.utc)
        deleted = db.query(self.model).filter(SeatLock.expires_at <= now).delete(synchronize_session=False)
        db.commit()
        return deleted

city_repo = CityRepository(City)
route_repo = RouteRepository(Route)
bus_repo = BusRepository(Bus)
trip_repo = TripRepository(Trip)
lock_repo = SeatLockRepository(SeatLock)
state_repo = BaseRepository(State)
stop_repo = BaseRepository(Stop)
amenity_repo = BaseRepository(Amenity)
seat_repo = BaseRepository(Seat)
operator_repo = BaseRepository(Operator)
staff_repo = BaseRepository(OperatorStaff)
schedule_repo = BaseRepository(Schedule)
