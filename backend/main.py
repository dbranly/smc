from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
import os

models.Base.metadata.create_all(bind=engine)

from routers import auth, projets, elements, mesures, commentaires
from routers import couches_geo, liaisons, analytics, users, rapport

app = FastAPI(title="SMC v3 API", version="3.0.0")

# CORS — accepte GitHub Pages + localhost pour le dev
ALLOWED = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
origins  = [o.strip() for o in ALLOWED.split(",")]
origins += ["http://localhost:5173", "http://localhost:4173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])
app.include_router(projets.router,      prefix="/api/projets",      tags=["Projets"])
app.include_router(elements.router,     prefix="/api/elements",     tags=["Éléments"])
app.include_router(mesures.router,      prefix="/api/mesures",      tags=["Mesures"])
app.include_router(commentaires.router, prefix="/api/commentaires", tags=["Commentaires"])
app.include_router(couches_geo.router,  prefix="/api/couches-geo",  tags=["Couches géologiques"])
app.include_router(liaisons.router,     prefix="/api/liaisons",     tags=["Liaisons structurelles"])
app.include_router(analytics.router,    prefix="/api/analytics",    tags=["Analytics"])
app.include_router(users.router,        prefix="/api/users",        tags=["Utilisateurs"])
app.include_router(rapport.router,      prefix="/api/rapport",      tags=["Rapport PDF"])

@app.get("/")
def root():
    return {"message": "SMC v3 API", "docs": "/docs", "version": "3.0.0"}