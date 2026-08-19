from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.auth import User, Role, RefreshToken, Wallet, WalletTransaction, role_permissions, OTPVerification

class UserRepository(BaseRepository[User]):
    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(self.model).filter(User.email == email, User.deleted_at.is_(None)).first()
        
    def get_by_phone(self, db: Session, phone: str) -> Optional[User]:
        return db.query(self.model).filter(User.phone == phone, User.deleted_at.is_(None)).first()

class RoleRepository(BaseRepository[Role]):
    def get_by_name(self, db: Session, name: str) -> Optional[Role]:
        return db.query(self.model).filter(Role.name == name, Role.deleted_at.is_(None)).first()

class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def get_by_token(self, db: Session, token: str) -> Optional[RefreshToken]:
        return db.query(self.model).filter(RefreshToken.token == token, RefreshToken.is_revoked == False).first()

    def revoke_all_user_tokens(self, db: Session, user_id: str) -> None:
        db.query(self.model).filter(RefreshToken.user_id == user_id).update({"is_revoked": True})
        db.commit()

class WalletRepository(BaseRepository[Wallet]):
    def get_by_user_id(self, db: Session, user_id: str) -> Optional[Wallet]:
        return db.query(self.model).filter(Wallet.user_id == user_id).first()

class OTPVerificationRepository(BaseRepository[OTPVerification]):
    def get_valid_otp(self, db: Session, email: str, otp_code: str, purpose: str) -> Optional[OTPVerification]:
        import datetime
        return db.query(self.model).filter(
            OTPVerification.email == email,
            OTPVerification.otp_code == otp_code,
            OTPVerification.purpose == purpose,
            OTPVerification.is_used == False,
            OTPVerification.expires_at > datetime.datetime.now(datetime.timezone.utc)
        ).first()

    def deactivate_previous_otps(self, db: Session, email: str, purpose: str) -> None:
        db.query(self.model).filter(
            OTPVerification.email == email,
            OTPVerification.purpose == purpose,
            OTPVerification.is_used == False
        ).update({"is_used": True})
        db.commit()

user_repo = UserRepository(User)
role_repo = RoleRepository(Role)
token_repo = RefreshTokenRepository(RefreshToken)
wallet_repo = WalletRepository(Wallet)
otp_repo = OTPVerificationRepository(OTPVerification)

