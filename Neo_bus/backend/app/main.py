from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.routers import auth, bookings, operators, admin, support, passengers, master, analytics
from app.models.auth import Role

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Auto-create tables (convenient for local run and immediate validation)
try:
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    # Auto-migration of columns for existing Postgres tables
    if "postgresql" in str(engine.url):
        with engine.connect() as conn:
            # 1. Alter bookings table
            cols_booking = [
                ("operator_id", "UUID REFERENCES operators(id)"),
                ("boarding_point_id", "UUID"),
                ("dropping_point_id", "UUID"),
                ("journey_date", "TIMESTAMP WITH TIME ZONE"),
                ("passenger_count", "INTEGER DEFAULT 1"),
                ("base_fare", "DOUBLE PRECISION DEFAULT 0.0"),
                ("tax", "DOUBLE PRECISION DEFAULT 0.0"),
                ("discount", "DOUBLE PRECISION DEFAULT 0.0"),
                ("wallet_used", "DOUBLE PRECISION DEFAULT 0.0"),
                ("ticket_status", "VARCHAR(20) DEFAULT 'active'")
            ]
            for col, col_type in cols_booking:
                try:
                    from sqlalchemy import text
                    conn.execute(text(f'ALTER TABLE bookings ADD COLUMN "{col}" {col_type};'))
                    conn.commit()
                    logger.info(f"Added column {col} to bookings table.")
                except Exception:
                    pass
                    
            # 2. Alter booking_passengers table
            cols_passenger = [
                ("mobile", "VARCHAR(20)"),
                ("email", "VARCHAR(255)"),
                ("id_proof", "VARCHAR(100)"),
                ("emergency_contact", "VARCHAR(20)")
            ]
            for col, col_type in cols_passenger:
                try:
                    conn.execute(text(f'ALTER TABLE booking_passengers ADD COLUMN "{col}" {col_type};'))
                    conn.commit()
                    logger.info(f"Added column {col} to booking_passengers.")
                except Exception:
                    pass
                    
            # 3. Alter coupons table
            cols_coupon = [
                ("is_first_booking", "BOOLEAN DEFAULT FALSE"),
                ("route_id", "UUID REFERENCES routes(id)"),
                ("operator_id", "UUID REFERENCES operators(id)"),
                ("usage_limit", "INTEGER DEFAULT 0"),
                ("used_count", "INTEGER DEFAULT 0")
            ]
            for col, col_type in cols_coupon:
                try:
                    conn.execute(text(f'ALTER TABLE coupons ADD COLUMN "{col}" {col_type};'))
                    conn.commit()
                    logger.info(f"Added column {col} to coupons.")
                except Exception:
                    pass

            # 4. Alter buses table
            cols_bus = [
                ("rc_number", "VARCHAR(50)"),
                ("insurance_number", "VARCHAR(100)"),
                ("insurance_expiry", "TIMESTAMP WITH TIME ZONE"),
                ("fitness_expiry", "TIMESTAMP WITH TIME ZONE"),
                ("permit_number", "VARCHAR(100)"),
                ("permit_expiry", "TIMESTAMP WITH TIME ZONE")
            ]
            for col, col_type in cols_bus:
                try:
                    conn.execute(text(f'ALTER TABLE buses ADD COLUMN "{col}" {col_type};'))
                    conn.commit()
                    logger.info(f"Added column {col} to buses.")
                except Exception:
                    pass

    # Auto-seed basic roles if missing
    db = SessionLocal()
    try:
        role_names = ["passenger", "operator", "operator_staff", "support", "admin", "super_admin"]
        role_map = {}
        for name in role_names:
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(name=name, description=f"{name.capitalize()} Role")
                db.add(role)
                db.flush()
            role_map[name] = role
        db.commit()

        # Seed Demo Users
        from app.core.security import get_password_hash
        from app.models.auth import User, Wallet
        
        demo_users = [
            {"email": "passenger@newbus.com", "phone": "+919999999991", "full_name": "Demo Passenger", "role_name": "passenger"},
            {"email": "operator@newbus.com", "phone": "+919999999992", "full_name": "Demo Operator", "role_name": "operator"},
            {"email": "support@newbus.com", "phone": "+919999999993", "full_name": "Demo Support", "role_name": "support"},
            {"email": "admin@newbus.com", "phone": "+919999999994", "full_name": "Demo Admin", "role_name": "admin"},
        ]
        
        for u_data in demo_users:
            existing_user = db.query(User).filter((User.email == u_data["email"]) | (User.phone == u_data["phone"])).first()
            if not existing_user:
                role = role_map[u_data["role_name"]]
                new_user = User(
                    email=u_data["email"],
                    phone=u_data["phone"],
                    full_name=u_data["full_name"],
                    hashed_password=get_password_hash("password123"),
                    role_id=role.id,
                    is_active=True,
                    is_verified=True
                )
                db.add(new_user)
                db.flush()
                # Create a wallet for the passenger (to allow booking tickets)
                if u_data["role_name"] == "passenger":
                    wallet = Wallet(user_id=new_user.id, balance=5000.0) # start passenger with 5000 credits
                    db.add(wallet)
        db.commit()
    except Exception as e:
        logger.error(f"Error seeding default roles/users: {e}")
        db.rollback()
    finally:
        db.close()
        
    logger.info("Database initialization complete.")
except Exception as e:
    logger.error(f"Database table generation failed: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middlewares
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(bookings.router, prefix=settings.API_V1_STR)
app.include_router(operators.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(support.router, prefix=settings.API_V1_STR)
app.include_router(passengers.router, prefix=settings.API_V1_STR)
app.include_router(master.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)

# Global Exception Handler
@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."}
    )

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "New Bus Booking Platform API",
        "documentation": "/docs"
    }

async def seat_lock_cleanup_loop():
    import datetime
    import asyncio
    from app.core.database import SessionLocal
    from app.models.buses import SeatLock
    from app.core.redis_store import cleanup_expired_memory_locks
    from app.routers.bookings import sse_manager
    
    while True:
        try:
            # 1. Clean up in-memory fallback locks
            memory_pruned = cleanup_expired_memory_locks()
            
            # 2. Clean up database locks
            db = SessionLocal()
            now = datetime.datetime.now(datetime.timezone.utc)
            expired_locks = db.query(SeatLock).filter(SeatLock.expires_at < now).all()
            
            if expired_locks or memory_pruned > 0:
                if expired_locks:
                    for lock in expired_locks:
                        db.delete(lock)
                    db.commit()
                # Broadcast status update to all connected UIs
                await sse_manager.broadcast("status_update")
            db.close()
        except Exception:
            pass
        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.create_task(seat_lock_cleanup_loop())
