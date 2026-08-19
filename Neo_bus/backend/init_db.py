import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import urllib.parse
from app.core.config import settings

def create_database_if_not_exists():
    try:
        # Parse DATABASE_URL: postgresql+psycopg2://postgres:4545@localhost/Neo_bus
        url = settings.DATABASE_URL.replace("postgresql+psycopg2://", "").replace("postgresql://", "")
        
        # Split credentials and host
        if "@" in url:
            creds, rest = url.split("@", 1)
            user, password = creds.split(":", 1)
            
            # URL decode credentials in case of special characters
            user = urllib.parse.unquote(user)
            password = urllib.parse.unquote(password)
        else:
            user = "postgres"
            password = ""
            rest = url
            
        if "/" in rest:
            host_port, db_name = rest.split("/", 1)
        else:
            host_port = rest
            db_name = "Neo_bus"
            
        if ":" in host_port:
            host, port = host_port.split(":", 1)
        else:
            host = host_port
            port = "5432"
            
        # Connect to postgres server default 'postgres' database
        conn = psycopg2.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Query PG catalog to check if the target DB exists
        cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{db_name}';")
        exists = cursor.fetchone()
        
        if not exists:
            print(f"Database '{db_name}' does not exist on PostgreSQL server. Creating it...")
            cursor.execute(f'CREATE DATABASE "{db_name}";')
            print(f"Database '{db_name}' created successfully!")
        else:
            print(f"Database '{db_name}' already exists.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Warning: Database check/creation sequence failed: {e}")

if __name__ == "__main__":
    create_database_if_not_exists()
    
    # Trigger SQLAlchemy table generation
    print("Importing models and creating tables via SQLAlchemy engine...")
    from app.core.database import Base, engine
    import app.models # ensure all models are registered
    Base.metadata.create_all(bind=engine)
    print("All required tables created successfully!")
