import os
import pathlib
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure backend package imports resolve no matter the current working directory.
BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load .env if present
try:
    from dotenv import load_dotenv
    backend_dir = BACKEND_DIR
    root_env = backend_dir.parent / '.env'
    backend_env = backend_dir / '.env'
    if root_env.exists():
        load_dotenv(dotenv_path=root_env, override=True)
    if backend_env.exists():
        load_dotenv(dotenv_path=backend_env, override=False)
except Exception:
    pass

# Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import metadata
from db.database import Base  # noqa: E402
from db import models  # noqa: F401,E402

target_metadata = Base.metadata


def _get_database_url() -> str:
    default_path = BACKEND_DIR / "app.db"
    return os.getenv("DATABASE_URL", f"sqlite:///{default_path}")


# Override SQLAlchemy URL from env. ConfigParser treats "%" as interpolation,
# so percent-encoded database passwords must be escaped before set_main_option.
config.set_main_option("sqlalchemy.url", _get_database_url().replace("%", "%%"))


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
