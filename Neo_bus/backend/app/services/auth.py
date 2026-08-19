from datetime import datetime, timedelta, timezone
import random
import asyncio
import threading
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token, create_reset_token
from app.core.database import get_db
from app.models.auth import User, Role, RefreshToken, Wallet, OTPVerification
from app.repositories import user_repo, role_repo, token_repo, wallet_repo, otp_repo
from app.schemas.auth import UserCreate, Token, UserLogin
from app.core.email import send_email
from app.core.sms import send_sms

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def run_async_in_background(coro):
    def run():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(coro)
            loop.close()
        except Exception:
            pass
    threading.Thread(target=run, daemon=True).start()


class AuthService:
    def register_user(self, db: Session, user_in: UserCreate) -> User:
        # Check if email exists
        if user_repo.get_by_email(db, user_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )
            
        # Check if phone exists
        if user_repo.get_by_phone(db, user_in.phone):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this phone number already exists."
            )

        # Get or create Role
        role_name = user_in.role_name.lower() if user_in.role_name else "passenger"
        role = role_repo.get_by_name(db, role_name)
        if not role:
            # Auto create role if missing (for easy setup)
            role = role_repo.create(db, obj_in={"name": role_name, "description": f"{role_name.capitalize()} Role"})

        # Create user
        hashed_password = get_password_hash(user_in.password)
        user_data = {
            "email": user_in.email,
            "phone": user_in.phone,
            "full_name": user_in.full_name,
            "hashed_password": hashed_password,
            "role_id": role.id,
            "is_active": True,
            "is_verified": False,
            "reward_points": 0
        }
        user = user_repo.create(db, obj_in=user_data)

        # Create user wallet
        wallet_repo.create(db, obj_in={"user_id": user.id, "balance": 100.0}) # give 100 credits free sign-up promo
        
        # Send Verification OTP
        try:
            self.send_otp_service(db, user.email, "email_verification")
        except Exception:
            pass
            
        return user

    def authenticate_user(self, db: Session, login_data: UserLogin) -> Token:
        identifier = login_data.identifier.strip()
        
        # Check if identifier looks like an email or a phone number
        if "@" in identifier:
            user = user_repo.get_by_email(db, identifier)
        else:
            user = user_repo.get_by_phone(db, identifier)
            
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email/phone number or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user profile."
            )

        # Create tokens
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        
        # Save refresh token in DB
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        token_repo.create(db, obj_in={
            "user_id": user.id,
            "token": refresh_token,
            "expires_at": expires_at,
            "is_revoked": False
        })
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            role=user.role.name
        )

    def refresh_access_token(self, db: Session, refresh_token: str) -> Token:
        payload = decode_token(refresh_token, is_refresh=True)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token."
            )
            
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload."
            )

        db_token = token_repo.get_by_token(db, refresh_token)
        if not db_token or db_token.is_revoked or db_token.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token is revoked or expired."
            )

        user = user_repo.get(db, user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive."
            )

        # Rotate refresh token: Revoke old, issue new access & refresh
        db_token.is_revoked = True
        db.add(db_token)
        
        new_access_token = create_access_token(subject=user.id)
        new_refresh_token = create_refresh_token(subject=user.id)
        
        new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        token_repo.create(db, obj_in={
            "user_id": user.id,
            "token": new_refresh_token,
            "expires_at": new_expires_at,
            "is_revoked": False
        })
        db.commit()
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            role=user.role.name
        )

    def logout_user(self, db: Session, user_id: str) -> None:
        token_repo.revoke_all_user_tokens(db, user_id)

    def send_otp_service(self, db: Session, email: Optional[str] = None, purpose: str = "", phone: Optional[str] = None) -> None:
        if phone:
            user = user_repo.get_by_phone(db, phone)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No registered user found with this phone number."
                )
            email = user.email
        else:
            user = user_repo.get_by_email(db, email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found."
                )
            
        otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
        otp_repo.deactivate_previous_otps(db, email, purpose)
        
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        otp_repo.create(db, obj_in={
            "email": email,
            "otp_code": otp_code,
            "purpose": purpose,
            "expires_at": expires_at,
            "is_used": False
        })
        
        # Dispatch OTP via SMS for Passengers, otherwise send via Email
        if user.role.name == "passenger":
            message = f"New Bus OTP for {purpose.replace('_', ' ')} is: {otp_code}. Valid for 15 minutes."
            send_sms(user.phone, message)
        else:
            subject = f"New Bus - Email Verification" if purpose == "email_verification" else f"New Bus - Password Reset Request"
            body = f"""
            <html>
                <body style="font-family: sans-serif; padding: 20px; color: #1e293b;">
                    <h2 style="color: #2563eb; margin-bottom: 20px;">New Bus Authentication</h2>
                    <p>Hello,</p>
                    <p>Your One-Time Password (OTP) for <strong>{purpose.replace('_', ' ')}</strong> is:</p>
                    <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #2563eb; margin: 20px 0; max-width: 200px;">
                        {otp_code}
                    </div>
                    <p>This code will expire in 15 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                </body>
            </html>
            """
            run_async_in_background(send_email(email, subject, body))

    def verify_otp_service(self, db: Session, email: Optional[str] = None, otp_code: str = "", purpose: str = "", phone: Optional[str] = None) -> dict:
        if phone:
            user = user_repo.get_by_phone(db, phone)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No registered user found with this phone number."
                )
            email = user.email
            
        db_otp = otp_repo.get_valid_otp(db, email, otp_code, purpose)
        if not db_otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP."
            )
            
        db_otp.is_used = True
        db.add(db_otp)
        
        if purpose in ["email_verification", "phone_login"]:
            user = user_repo.get_by_email(db, email)
            if user:
                user.is_verified = True
                db.add(user)
        
        db.commit()
        
        if purpose == "password_reset":
            reset_token = create_reset_token(email)
            return {"detail": "OTP verified successfully", "reset_token": reset_token}
            
        return {"detail": "OTP verified successfully"}

    def forgot_password_service(self, db: Session, email: str) -> None:
        user = user_repo.get_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user registered with this email address."
            )
        self.send_otp_service(db, email, "password_reset")

    def reset_password_service(self, db: Session, token: str, new_password: str) -> None:
        payload = decode_token(token, is_refresh=False)
        if not payload or payload.get("type") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token."
            )
            
        email = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token payload."
            )
            
        user = user_repo.get_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found."
            )
            
        user.hashed_password = get_password_hash(new_password)
        db.add(user)
        token_repo.revoke_all_user_tokens(db, user.id)
        db.commit()

auth_service = AuthService()

# Dependencies
def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token, is_refresh=False)
    if not payload or payload.get("type") != "access":
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    user = user_repo.get(db, user_id)
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

# RBAC Role Checker Dependency Creator
def require_roles(allowed_roles: List[str]):
    def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires roles {allowed_roles}"
            )
        return current_user
    return dependency
