from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.bookings import Booking, BookingPassenger, Payment, Coupon

class BookingRepository(BaseRepository[Booking]):
    def get_by_booking_number(self, db: Session, booking_number: str) -> Optional[Booking]:
        return db.query(self.model).filter(Booking.booking_number == booking_number, Booking.deleted_at.is_(None)).first()

    def get_by_pnr(self, db: Session, pnr: str) -> Optional[Booking]:
        return db.query(self.model).filter(Booking.pnr == pnr.upper(), Booking.deleted_at.is_(None)).first()

    def get_user_bookings(self, db: Session, user_id: str) -> List[Booking]:
        return db.query(self.model).filter(Booking.user_id == user_id, Booking.deleted_at.is_(None)).order_by(Booking.created_at.desc()).all()

class CouponRepository(BaseRepository[Coupon]):
    def get_by_code(self, db: Session, code: str) -> Optional[Coupon]:
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc)
        return db.query(self.model).filter(
            Coupon.code == code.upper(),
            Coupon.is_active == True,
            Coupon.expires_at > now,
            Coupon.deleted_at.is_(None)
        ).first()

class PaymentRepository(BaseRepository[Payment]):
    def get_by_transaction_id(self, db: Session, transaction_id: str) -> Optional[Payment]:
        return db.query(self.model).filter(Payment.transaction_id == transaction_id).first()

booking_repo = BookingRepository(Booking)
coupon_repo = CouponRepository(Coupon)
payment_repo = PaymentRepository(Payment)
passenger_repo = BaseRepository(BookingPassenger)
