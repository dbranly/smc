from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Sur Render : base dans /data (volume persistant)
# En local   : base dans le dossier courant
DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///./smc_v2.db")

# Si c'est un chemin Render, utilise /data
if os.path.exists("/data"):
    DB_PATH = "sqlite:////data/smc_v2.db"

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