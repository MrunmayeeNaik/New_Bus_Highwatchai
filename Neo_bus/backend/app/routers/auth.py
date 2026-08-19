from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.auth import (
    UserCreate, Token, UserOut, UserLogin, RefreshTokenRequest, UserUpdate, 
    WalletOut, WalletTransactionOut, SendOTPRequest, VerifyOTPRequest, 
    ForgotPasswordRequest, ResetPasswordRequest
)
from app.services.auth import auth_service, get_current_active_user
from app.models.auth import User
from app.repositories import user_repo, wallet_repo

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    return auth_service.register_user(db, user_in)

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    return auth_service.authenticate_user(db, login_data)

@router.post("/refresh", response_model=Token)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    return auth_service.refresh_access_token(db, req.refresh_token)

@router.post("/send-otp", status_code=status.HTTP_200_OK)
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    auth_service.send_otp_service(db, email=req.email, purpose=req.purpose, phone=req.phone)
    return {"detail": "OTP sent successfully"}

@router.post("/verify-otp", status_code=status.HTTP_200_OK)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    return auth_service.verify_otp_service(db, email=req.email, otp_code=req.otp_code, purpose=req.purpose, phone=req.phone)

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    auth_service.forgot_password_service(db, req.email)
    return {"detail": "If the email is registered, we have sent a password reset OTP."}

@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password_service(db, req.token, req.new_password)
    return {"detail": "Password has been reset successfully."}

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    auth_service.logout_user(db, current_user.id)
    return {"detail": "Successfully logged out"}

@router.get("/me", response_model=UserOut)
def read_user_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.put("/me", response_model=UserOut)
def update_user_me(obj_in: UserUpdate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    updated = user_repo.update(db, db_obj=current_user, obj_in=obj_in)
    return updated

@router.get("/wallet", response_model=WalletOut)
def read_wallet_me(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    wallet = wallet_repo.get_by_user_id(db, current_user.id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet

@router.get("/wallet/transactions", response_model=List[WalletTransactionOut])
def read_wallet_transactions_me(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    wallet = wallet_repo.get_by_user_id(db, current_user.id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet.transactions
