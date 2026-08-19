from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.buses import City, Route, Amenity, Operator
from app.models.master import Country, BusType, SeatType, VehicleCategory, Tax, CancellationPolicy, RefundRule
from app.schemas.cities import CityOut, RouteOut
from app.schemas.buses import AmenityOut, OperatorOut
from app.schemas.master import CountryOut, BusTypeOut, SeatTypeOut, VehicleCategoryOut, TaxOut, CancellationPolicyOut, RefundRuleOut

router = APIRouter(prefix="/master", tags=["Public Master Data"])

@router.get("/countries", response_model=List[CountryOut])
def get_countries(db: Session = Depends(get_db)):
    return db.query(Country).all()

@router.get("/cities", response_model=List[CityOut])
def get_cities(db: Session = Depends(get_db)):
    return db.query(City).filter(City.is_active == True).all()

@router.get("/routes", response_model=List[RouteOut])
def get_routes(db: Session = Depends(get_db)):
    return db.query(Route).filter(Route.is_active == True).all()

@router.get("/amenities", response_model=List[AmenityOut])
def get_amenities(db: Session = Depends(get_db)):
    return db.query(Amenity).all()

@router.get("/bus-types", response_model=List[BusTypeOut])
def get_bus_types(db: Session = Depends(get_db)):
    return db.query(BusType).all()

@router.get("/seat-types", response_model=List[SeatTypeOut])
def get_seat_types(db: Session = Depends(get_db)):
    return db.query(SeatType).all()

@router.get("/vehicle-categories", response_model=List[VehicleCategoryOut])
def get_vehicle_categories(db: Session = Depends(get_db)):
    return db.query(VehicleCategory).all()

@router.get("/taxes", response_model=List[TaxOut])
def get_taxes(db: Session = Depends(get_db)):
    return db.query(Tax).all()

@router.get("/cancellation-policies", response_model=List[CancellationPolicyOut])
def get_cancellation_policies(db: Session = Depends(get_db)):
    return db.query(CancellationPolicy).all()

@router.get("/refund-rules", response_model=List[RefundRuleOut])
def get_refund_rules(db: Session = Depends(get_db)):
    return db.query(RefundRule).all()

@router.get("/operators", response_model=List[OperatorOut])
def get_operators(db: Session = Depends(get_db)):
    return db.query(Operator).filter(Operator.is_active == True).all()
