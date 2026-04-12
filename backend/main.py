from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
import os

models.Base.metadata.create_all(bind=engine)

# Auto-seed : crée le compte admin si la base est vide

def auto_seed():
from database import SessionLocal
from auth import hash_password
db = SessionLocal()
try:
if db.query(models.User).count() == 0:
chef = models.User(
nom=“Administrateur",
email=“admin@smc.app",
hashed_password=hash_password(“ChangeMe2025!"),
role=“chef",
actif=True,
)
db.add(chef); db.commit()
print(“✅ Compte admin créé : admin@smc.app / ChangeMe2025!")
finally:
db.close()

auto_seed()

from routers import auth, projets, elements, mesures, commentaires
from routers import couches_geo, liaisons, analytics, users, rapport

app = FastAPI(title=“SMC v3 API", version=“3.0.0")

app.add_middleware(
CORSMiddleware,
allow_origins=[“http://localhost:5173", “http://localhost:4173"],
allow_credentials=True,
allow_methods=["*"],
allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api/auth",         tags=[“Auth"])
app.include_router(projets.router,      prefix="/api/projets",      tags=[“Projets"])
app.include_router(elements.router,     prefix="/api/elements",     tags=[“Éléments"])
app.include_router(mesures.router,      prefix="/api/mesures",      tags=[“Mesures"])
app.include_router(commentaires.router, prefix="/api/commentaires", tags=[“Commentaires"])
app.include_router(couches_geo.router,  prefix="/api/couches-geo",  tags=[“Couches géologiques"])
app.include_router(liaisons.router,     prefix="/api/liaisons",     tags=[“Liaisons structurelles"])
app.include_router(analytics.router,    prefix="/api/analytics",    tags=[“Analytics & Dashboard"])
app.include_router(users.router,        prefix="/api/users",         tags=[“Utilisateurs"])
app.include_router(rapport.router,      prefix="/api/rapport",       tags=[“Rapport PDF"])

@app.get("/")
def root():
return {“message": “SMC v3 API", “docs": “/docs", “version": “3.0.0"}