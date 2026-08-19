from app.core.database import Base
from app.models.base import AuditModel
from app.models.auth import Role, Permission, User, RefreshToken, Wallet, WalletTransaction, role_permissions, OTPVerification
from app.models.buses import (
    Operator,
    OperatorStaff,
    State,
    City,
    Route,
    Stop,
    Bus,
    Amenity,
    bus_amenities,
    Seat,
    Trip,
    Schedule,
    SeatLock,
)
from app.models.bookings import Booking, BookingPassenger, Payment, Coupon
from app.models.feedback import Review, Notification
from app.models.support import SupportTicket, AuditLog
from app.models.master import Country, BusType, SeatType, VehicleCategory, Tax, CancellationPolicy, RefundRule
from app.models.passenger import SavedPassenger, FavoriteRoute, SearchHistory
