from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.services.auth import get_current_active_user
from app.models.auth import User, Wallet, WalletTransaction
from app.models.passenger import SavedPassenger, FavoriteRoute, SearchHistory
from app.models.feedback import Notification
from app.models.buses import Route, City
from app.schemas.passenger import (
    SavedPassengerCreate, SavedPassengerOut,
    FavoriteRouteCreate, FavoriteRouteOut,
    SearchHistoryCreate, SearchHistoryOut,
    EmergencyContactUpdate, PassengerProfileOut
)
from app.schemas.auth import WalletTransactionOut

router = APIRouter(prefix="/passenger", tags=["Passenger Operations"])

@router.get("/profile", response_model=PassengerProfileOut)
def get_passenger_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    balance = 0.0
    if current_user.wallet:
        balance = current_user.wallet.balance
    
    return PassengerProfileOut(
        id=current_user.id,
        email=current_user.email,
        phone=current_user.phone,
        full_name=current_user.full_name,
        reward_points=current_user.reward_points,
        emergency_contact_name=current_user.emergency_contact_name,
        emergency_contact_phone=current_user.emergency_contact_phone,
        emergency_contact_relation=current_user.emergency_contact_relation,
        wallet_balance=balance
    )

@router.put("/emergency-contact")
def update_emergency_contact(
    req: EmergencyContactUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    current_user.emergency_contact_name = req.emergency_contact_name
    current_user.emergency_contact_phone = req.emergency_contact_phone
    current_user.emergency_contact_relation = req.emergency_contact_relation
    db.add(current_user)
    db.commit()
    return {"detail": "Emergency contact details updated successfully."}

# Saved Passengers CRUD
@router.get("/saved-passengers", response_model=List[SavedPassengerOut])
def list_saved_passengers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return db.query(SavedPassenger).filter(SavedPassenger.user_id == current_user.id, SavedPassenger.deleted_at.is_(None)).all()

@router.post("/saved-passengers", response_model=SavedPassengerOut, status_code=status.HTTP_201_CREATED)
def create_saved_passenger(
    req: SavedPassengerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    new_companion = SavedPassenger(
        user_id=current_user.id,
        name=req.name,
        age=req.age,
        gender=req.gender
    )
    db.add(new_companion)
    db.commit()
    db.refresh(new_companion)
    return new_companion

@router.delete("/saved-passengers/{id}")
def delete_saved_passenger(
    id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    companion = db.query(SavedPassenger).filter(SavedPassenger.id == id, SavedPassenger.user_id == current_user.id).first()
    if not companion:
        raise HTTPException(status_code=404, detail="Saved companion passenger not found.")
    db.delete(companion)
    db.commit()
    return {"detail": "Saved passenger removed successfully."}

# Favorite Routes CRUD
@router.get("/favorites")
def list_favorite_routes(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    favs = db.query(FavoriteRoute).options(
        joinedload(FavoriteRoute.route).joinedload(Route.source_city),
        joinedload(FavoriteRoute.route).joinedload(Route.destination_city)
    ).filter(FavoriteRoute.user_id == current_user.id, FavoriteRoute.deleted_at.is_(None)).all()
    
    result = []
    for f in favs:
        result.append({
            "id": f.id,
            "route_id": f.route_id,
            "source_city": f.route.source_city.name if f.route and f.route.source_city else "Unknown",
            "destination_city": f.route.destination_city.name if f.route and f.route.destination_city else "Unknown",
            "distance_km": f.route.distance_km if f.route else 0
        })
    return result

@router.post("/favorites")
def add_favorite_route(
    req: FavoriteRouteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check duplicate
    existing = db.query(FavoriteRoute).filter_by(user_id=current_user.id, route_id=req.route_id).first()
    if existing:
        return {"detail": "Route already favorited."}
        
    fav = FavoriteRoute(
        user_id=current_user.id,
        route_id=req.route_id
    )
    db.add(fav)
    db.commit()
    return {"detail": "Route added to favorites."}

@router.delete("/favorites/{id}")
def remove_favorite_route(
    id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    fav = db.query(FavoriteRoute).filter(FavoriteRoute.id == id, FavoriteRoute.user_id == current_user.id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite route entry not found.")
    db.delete(fav)
    db.commit()
    return {"detail": "Route removed from favorites."}

# Search History Logging
@router.get("/search-history")
def get_search_history(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    histories = db.query(SearchHistory).options(
        joinedload(SearchHistory.source_city),
        joinedload(SearchHistory.destination_city)
    ).filter(SearchHistory.user_id == current_user.id).order_by(SearchHistory.created_at.desc()).limit(10).all()
    
    result = []
    for h in histories:
        result.append({
            "id": h.id,
            "source_city_id": h.source_city_id,
            "destination_city_id": h.destination_city_id,
            "source_city_name": h.source_city.name if h.source_city else "Unknown",
            "destination_city_name": h.destination_city.name if h.destination_city else "Unknown",
            "searched_at": h.created_at
        })
    return result

@router.post("/search-history")
def log_search_history(
    req: SearchHistoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # To avoid flood, check if identical search exists in past 10 minutes
    ten_mins_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10)
    existing = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.source_city_id == req.source_city_id,
        SearchHistory.destination_city_id == req.destination_city_id,
        SearchHistory.created_at >= ten_mins_ago
    ).first()
    
    if existing:
        return {"detail": "Search already logged recently."}
        
    log = SearchHistory(
        user_id=current_user.id,
        source_city_id=req.source_city_id,
        destination_city_id=req.destination_city_id
    )
    db.add(log)
    db.commit()
    return {"detail": "Search query logged."}

# Notifications Feed
@router.get("/notifications")
def list_my_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(50).all()

# Wallet Ledger and Top-up Simulation
@router.get("/wallet/transactions", response_model=List[WalletTransactionOut])
def get_wallet_transactions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not current_user.wallet:
        return []
    return db.query(WalletTransaction).filter(WalletTransaction.wallet_id == current_user.wallet.id).order_by(WalletTransaction.created_at.desc()).all()

class TopupRequest(BaseModel):
    amount: float

@router.post("/wallet/topup")
def topup_wallet(
    req: TopupRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Top up amount must be positive.")
        
    wallet = current_user.wallet
    if not wallet:
        # Auto-create if missing
        wallet = Wallet(user_id=current_user.id, balance=0.0)
        db.add(wallet)
        db.flush()
        
    wallet.balance += req.amount
    db.add(wallet)
    
    transaction = WalletTransaction(
        wallet_id=wallet.id,
        amount=req.amount,
        transaction_type="credit",
        description="Top up via online simulation payment"
    )
    db.add(transaction)
    
    db.commit()
    return {"detail": f"Successfully loaded ₹{req.amount} into wallet.", "balance": wallet.balance}
