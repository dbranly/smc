from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
import os

app = FastAPI(title="SMC API", version="3.0.0")

ALLOWED = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in ALLOWED.split(",")]
origins += ["http://localhost:5173", "http://localhost:4173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth, projets, elements, mesures, commentaires
from routers import couches_geo, liaisons, analytics, users, rapport

app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])
app.include_router(projets.router,      prefix="/api/projets",      tags=["Projets"])
app.include_router(elements.router,     prefix="/api/elements",     tags=["Elements"])
app.include_router(mesures.router,      prefix="/api/mesures",      tags=["Mesures"])
app.include_router(commentaires.router, prefix="/api/commentaires", tags=["Commentaires"])
app.include_router(couches_geo.router,  prefix="/api/couches-geo",  tags=["Couches geo"])
app.include_router(liaisons.router,     prefix="/api/liaisons",     tags=["Liaisons"])
app.include_router(analytics.router,    prefix="/api/analytics",    tags=["Analytics"])
app.include_router(users.router,        prefix="/api/users",        tags=["Utilisateurs"])
app.include_router(rapport.router,      prefix="/api/rapport",      tags=["Rapport PDF"])

@app.on_event("startup")
async def startup():
    from database import engine
    from auth import hash_password
    from database import SessionLocal
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            chef = models.User(
                nom="Administrateur",
                email="admin@smc.app",
                hashed_password=hash_password("ChangeMe2025!"),
                role="chef",
                actif=True,
            )
            db.add(chef)
            db.commit()
            print("Compte admin cree : admin@smc.app / ChangeMe2025!")
        finally:
            db.close()

@app.get("/")
def root():
    return {"message": "SMC API", "docs": "/docs", "version": "3.0.0"}