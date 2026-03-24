from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name)

# add your model's MetaData object here
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.database import engine, Base
from app.models import models

target_metadata = models.Base if hasattr(models, 'Base') else Base

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url") or os.getenv('DATABASE_URL')
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
