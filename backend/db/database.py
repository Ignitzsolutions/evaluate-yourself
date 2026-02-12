# backend/db/database.py
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine import Engine
import os
import logging

logger = logging.getLogger(__name__)

_default_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_path}")
ENV = os.getenv(
    "ENV",
    os.getenv("APP_ENV", os.getenv("ENVIRONMENT", os.getenv("PYTHON_ENV", "development"))),
).strip().lower()


def is_production_env() -> bool:
    return ENV == "production"

# Azure PostgreSQL readiness configuration
def _get_engine_config(database_url: str) -> dict:
    """Get SQLAlchemy engine configuration based on database type."""
    config = {}
    
    if database_url.startswith("sqlite"):
        # SQLite-specific settings
        config["connect_args"] = {"check_same_thread": False}
    elif database_url.startswith("postgresql"):
        # PostgreSQL-specific settings for Azure
        config["pool_pre_ping"] = True  # Verify connections before using
        config["pool_size"] = int(os.getenv("DB_POOL_SIZE", "10"))  # Azure default
        config["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "20"))
        config["pool_recycle"] = int(os.getenv("DB_POOL_RECYCLE", "3600"))  # 1 hour
        config["pool_timeout"] = int(os.getenv("DB_POOL_TIMEOUT", "30"))
        
        # Azure PostgreSQL requires SSL in production
        connect_args = {}
        if "sslmode" not in database_url:
            # Default to requiring SSL for Azure
            ssl_mode = os.getenv("DB_SSL_MODE", "prefer")
            connect_args["sslmode"] = ssl_mode
            logger.info(f"PostgreSQL SSL mode: {ssl_mode}")
        
        if connect_args:
            config["connect_args"] = connect_args
    
    return config


def assert_production_database_config() -> None:
    """Fail fast if production database settings are unsafe."""
    if not is_production_env():
        return
    if not os.getenv("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL must be set in production.")
    if not DATABASE_URL.startswith("postgresql"):
        raise RuntimeError("Production requires PostgreSQL DATABASE_URL.")


assert_production_database_config()
logger.info(
    "Database backend resolved: %s",
    "postgresql" if DATABASE_URL.startswith("postgresql") else "sqlite",
)

engine_config = _get_engine_config(DATABASE_URL)
engine = create_engine(DATABASE_URL, **engine_config)

# Log successful connection on startup
@event.listens_for(Engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Log database connections for monitoring."""
    logger.info(f"Database connection established: {type(dbapi_conn).__name__}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for FastAPI endpoints to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_db_connection() -> tuple[bool, str, float]:
    """Test database connectivity for health checks.
    
    Returns:
        tuple: (success: bool, message: str, latency_ms: float)
    """
    import time
    from sqlalchemy import text
    start = time.time()
    try:
        db = SessionLocal()
        # Simple query to test connection
        db.execute(text("SELECT 1"))
        db.close()
        latency_ms = (time.time() - start) * 1000
        return True, "Database connected", latency_ms
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        logger.error(f"Database health check failed: {e}")
        return False, str(e), latency_ms
