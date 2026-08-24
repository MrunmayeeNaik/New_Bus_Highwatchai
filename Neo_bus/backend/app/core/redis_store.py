import os
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Redis initialization configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

redis_client = None
try:
    import redis
    redis_client = redis.from_url(REDIS_URL, socket_timeout=1.0, decode_responses=True)
    redis_client.ping()
    logger.info(f"Connected to Redis at {REDIS_URL} successfully.")
except Exception as e:
    logger.warning(f"Could not connect to Redis: {e}. Falling back to thread-safe in-memory cache.")
    redis_client = None

# Thread-safe memory fallback lock store
_memory_locks = {}
_lock = threading.Lock()

def acquire_seat_lock(trip_id: str, seat_id: str, user_id: str, ttl_seconds: int = 600) -> bool:
    """
    Attempts to atomically lock a seat for a user on a trip.
    Returns True if successfully locked, False if already locked.
    """
    key = f"seat_lock:{trip_id}:{seat_id}"
    
    if redis_client is not None:
        try:
            # Set key with Expiry and set-if-not-exists (NX)
            success = redis_client.set(key, str(user_id), nx=True, ex=ttl_seconds)
            return bool(success)
        except Exception as e:
            logger.error(f"Redis set failed: {e}. Falling back to memory lock.")
            # fallback to memory if redis fails mid-run
            pass

    # Thread-safe in-memory lock store fallback
    with _lock:
        now = datetime.now(timezone.utc)
        existing = _memory_locks.get(key)
        if existing:
            # Check expiry
            if existing["expires_at"] > now:
                # Still active
                return False
        
        # Lock is empty or expired, acquire it
        expires_at = now + timedelta(seconds=ttl_seconds)
        _memory_locks[key] = {
            "user_id": str(user_id),
            "expires_at": expires_at
        }
        return True

def get_seat_lock_holder(trip_id: str, seat_id: str) -> Optional[str]:
    """
    Returns the user ID of the lock holder if the lock is active, otherwise None.
    """
    key = f"seat_lock:{trip_id}:{seat_id}"
    
    if redis_client is not None:
        try:
            val = redis_client.get(key)
            if val:
                return val
        except Exception:
            pass

    with _lock:
        now = datetime.now(timezone.utc)
        existing = _memory_locks.get(key)
        if existing:
            if existing["expires_at"] > now:
                return existing["user_id"]
            else:
                # Cleanup expired lock
                _memory_locks.pop(key, None)
        return None

def release_seat_lock(trip_id: str, seat_id: str) -> None:
    """
    Releases the lock for a seat.
    """
    key = f"seat_lock:{trip_id}:{seat_id}"
    
    if redis_client is not None:
        try:
            redis_client.delete(key)
            return
        except Exception:
            pass

    with _lock:
        _memory_locks.pop(key, None)

def get_all_active_locks_for_trip(trip_id: str) -> dict:
    """
    Returns a dictionary of {seat_id: user_id} for all active locks on the trip.
    """
    locks = {}
    now = datetime.now(timezone.utc)
    
    if redis_client is not None:
        try:
            # Query keys starting with prefix
            pattern = f"seat_lock:{trip_id}:*"
            keys = redis_client.keys(pattern)
            for k in keys:
                seat_id = k.split(":")[-1]
                val = redis_client.get(k)
                if val:
                    locks[seat_id] = val
            return locks
        except Exception:
            pass

    with _lock:
        prefix = f"seat_lock:{trip_id}:"
        for k, item in list(_memory_locks.items()):
            if k.startswith(prefix):
                if item["expires_at"] > now:
                    seat_id = k.split(":")[-1]
                    locks[seat_id] = item["user_id"]
                else:
                    _memory_locks.pop(k, None)
        return locks

def get_all_active_locks_with_expiry_for_trip(trip_id: str) -> dict:
    """
    Returns {seat_id: {"user_id": str, "expires_at": datetime}} for active locks.

    The holder and the expiry come from the same record here. Reading them from
    separate places (the cache for one, the database for the other) lets them
    disagree, which surfaces as a lock with no expiry for the client to count down.
    """
    locks = {}
    now = datetime.now(timezone.utc)

    if redis_client is not None:
        try:
            pattern = f"seat_lock:{trip_id}:*"
            for k in redis_client.keys(pattern):
                val = redis_client.get(k)
                if not val:
                    continue
                # Redis owns the countdown; translate its remaining TTL into an
                # absolute timestamp. -1 means no expiry set, -2 means already gone.
                ttl = redis_client.ttl(k)
                expires_at = now + timedelta(seconds=ttl) if ttl and ttl > 0 else None
                locks[k.split(":")[-1]] = {"user_id": val, "expires_at": expires_at}
            return locks
        except Exception:
            pass

    with _lock:
        prefix = f"seat_lock:{trip_id}:"
        for k, item in list(_memory_locks.items()):
            if not k.startswith(prefix):
                continue
            if item["expires_at"] > now:
                locks[k.split(":")[-1]] = {
                    "user_id": item["user_id"],
                    "expires_at": item["expires_at"],
                }
            else:
                _memory_locks.pop(k, None)
        return locks


def cleanup_expired_memory_locks() -> int:
    """
    Prunes expired locks from memory.
    """
    count = 0
    now = datetime.now(timezone.utc)
    with _lock:
        for k, item in list(_memory_locks.items()):
            if item["expires_at"] <= now:
                _memory_locks.pop(k, None)
                count += 1
    return count
