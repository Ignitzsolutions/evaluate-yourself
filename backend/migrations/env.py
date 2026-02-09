import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Load .env if present
try:
    from dotenv import load_dotenv
    import pathlib
    backend_dir = pathlib.Path(__file__).resolve().parents[1]
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
    default_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app.db")
    return os.getenv("DATABASE_URL", f"sqlite:///{default_path}")


# Override SQLAlchemy URL from env
config.set_main_option("sqlalchemy.url", _get_database_url())


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
