import os
from typing import List, Dict, Any
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "New Bus"
    
    # Security — must be supplied via environment / .env, never hardcoded here.
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # SMTP Settings (optional, falls back to console printing if SMTP_HOST is empty)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@newbus.com"
    
    # Database — override in .env; this default assumes a local trust-auth Postgres.
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost/Neo_bus"
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]
    
    # Seed Data Flag
    SEED_DEMO_DATA: bool = True
    
    # Media & Uploads
    UPLOAD_DIR: str = "uploads"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
