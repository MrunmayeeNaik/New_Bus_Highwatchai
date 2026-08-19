from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class UserBase(BaseModel):
    email: str
    phone: str
    full_name: str

class UserCreate(UserBase):
    password: str
    role_name: Optional[str] = "passenger"  # default registration role

class UserLogin(BaseModel):
    identifier: str
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

class RoleOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class UserOut(UserBase):
    id: UUID
    role: RoleOut
    is_active: bool
    is_verified: bool
    reward_points: int
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class WalletOut(BaseModel):
    id: UUID
    user_id: UUID
    balance: float

    class Config:
        from_attributes = True

class WalletTransactionOut(BaseModel):
    id: UUID
    amount: float
    transaction_type: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class VerifyOTPRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    otp_code: str
    purpose: str  # email_verification, password_reset, phone_login

class SendOTPRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    purpose: str

class OperatorRegisterRequest(BaseModel):
    # User credentials
    full_name: str
    email: str
    phone: str
    password: str
    
    # Operator Company Profile
    company_name: str
    company_email: str
    company_phone: str
    logo_url: Optional[str] = None
