from app.repositories.base import BaseRepository
from app.repositories.auth import user_repo, role_repo, token_repo, wallet_repo, otp_repo
from app.repositories.buses import (
    city_repo,
    route_repo,
    bus_repo,
    trip_repo,
    lock_repo,
    state_repo,
    stop_repo,
    amenity_repo,
    seat_repo,
    operator_repo,
    staff_repo,
    schedule_repo,
)
from app.repositories.bookings import booking_repo, coupon_repo, payment_repo, passenger_repo
from app.repositories.feedback import review_repo, notification_repo
from app.repositories.support import ticket_repo, audit_repo
