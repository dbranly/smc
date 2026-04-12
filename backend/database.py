from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import tempfile

# Debug
print("TMP dir:", tempfile.gettempdir())
print("TMP exists:", os.path.isdir("/tmp"))
print("TMP writable:", os.access("/tmp", os.W_OK))

DB_PATH = "sqlite:////tmp/smc_v2.db"
print("DB_PATH:", DB_PATH)

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
