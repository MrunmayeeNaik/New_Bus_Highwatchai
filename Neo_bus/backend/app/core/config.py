import os
import secrets
from pathlib import Path
from typing import List, Dict, Any
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator

# Anchor the env file to the backend directory rather than the working directory, so
# the settings resolve the same way whether uvicorn is launched from here, from the
# repo root, or by pytest.
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"
ENV_EXAMPLE = BACKEND_DIR / ".env.example"


def _bootstrap_env_file() -> None:
    """Seed a local .env on first run.

    Both JWT secrets are required and have no defaults, so a fresh clone would
    otherwise die inside pydantic before the app can explain what is missing.
    Rather than ship a hardcoded fallback secret, generate real random ones per
    install and write them to the gitignored .env.
    """
    if ENV_FILE.exists():
        return
    # Docker Compose and CI inject the secrets directly; nothing to write.
    if os.getenv("JWT_SECRET_KEY") and os.getenv("JWT_REFRESH_SECRET_KEY"):
        return
    if not ENV_EXAMPLE.exists():
        return

    generated = []
    lines = []
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        key = line.split("=", 1)[0].strip()
        if key in ("JWT_SECRET_KEY", "JWT_REFRESH_SECRET_KEY") and line.strip().endswith("="):
            line = f"{key}={secrets.token_urlsafe(48)}"
            generated.append(key)
        lines.append(line)

    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[config] No .env found — created {ENV_FILE} from .env.example "
          f"with freshly generated {', '.join(generated)}.")


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
        env_file = str(ENV_FILE)


_bootstrap_env_file()
settings = Settings()

# A blank secret still satisfies `str`, but HS256 signing with an empty key is
# worthless — fail loudly here rather than issuing forgeable tokens.
for _key in ("JWT_SECRET_KEY", "JWT_REFRESH_SECRET_KEY"):
    if not getattr(settings, _key, "").strip():
        raise RuntimeError(
            f"{_key} is empty. Generate one with:\n"
            f'    python -c "import secrets; print(secrets.token_urlsafe(48))"\n'
            f"then set it in {ENV_FILE}"
        )

if settings.JWT_SECRET_KEY == settings.JWT_REFRESH_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY and JWT_REFRESH_SECRET_KEY must differ, so that a leaked "
        "access-token key cannot be used to forge long-lived refresh tokens."
    )

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
