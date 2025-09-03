from dotenv import load_dotenv

load_dotenv()

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from models import Base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

config = context.config
config.set_main_option("sqlalchemy.url", DATABASE_URL)
fileConfig(config.config_file_name)

target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    # 如果是老表，就忽略，不做对比
    if type_ == "table" and name in {"Chat", "Message", "Message_v2", "Vote", "Stream", "Suggestion", "User", "Document", "Vote_v2"}:
        return False
    return True


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, include_object=include_object)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)

        with context.begin_transaction():
            context.run_migrations(
                
            )


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
