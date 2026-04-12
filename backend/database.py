from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Priorité :

# 1. Variable d’env DATABASE_URL si définie

# 2. /data/smc_v2.db si le dossier existe (volume Render payant)

# 3. /tmp/smc_v2.db  (Render free — éphémère mais fonctionnel)

# 4. ./smc_v2.db     (local dev)

if os.environ.get("DATABASE_URL"):
    DB_PATH = os.environ["DATABASE_URL"]
elif os.path.isdir("/data"):
    DB_PATH = "sqlite:////data/smc_v2.db"
elif os.path.isdir("/tmp"):
    DB_PATH = "sqlite:////tmp/smc_v2.db"
else:
    DB_PATH = "sqlite:///./smc_v2.db"

engine = create_engine(
    DB_PATH,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()