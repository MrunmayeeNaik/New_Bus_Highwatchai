import sys
import os

# Add backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.routers.admin import seed_demo_data

def run_seed():
    db = SessionLocal()
    try:
        print("Seeding full master database dummy data...")
        result = seed_demo_data(db=db)
        print("Seed result:", result)
        print("Successfully seeded all dummy data!")
    except Exception as e:
        print("Error during seed:", e)
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
