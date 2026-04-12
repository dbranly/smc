"""
Script d'initialisation pour la production.
Lance une seule fois après le premier déploiement sur Render :
  python seed_prod.py

Crée un compte chef par défaut que tu changeras immédiatement.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, SessionLocal
import models
from auth import hash_password

def seed():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Vérifie si des users existent déjà
    if db.query(models.User).count() > 0:
        print("⚠ Des utilisateurs existent déjà — seed ignoré.")
        db.close()
        return

    # Compte chef par défaut
    chef = models.User(
        nom="Administrateur",
        email="admin@smc.app",
        hashed_password=hash_password("ChangeMe2025!"),
        role="chef",
        actif=True,
    )
    db.add(chef)
    db.commit()
    print("✅ Compte admin créé :")
    print("   Email    : admin@smc.app")
    print("   Password : ChangeMe2025!")
    print("   ⚠ Changez ce mot de passe immédiatement via l'interface Utilisateurs !")
    db.close()

if __name__ == "__main__":
    seed()