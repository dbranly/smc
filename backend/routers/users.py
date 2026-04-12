from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user, require_role, hash_password

router = APIRouter()

@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db),
               _: models.User = Depends(require_role("chef"))):
    return db.query(models.User).order_by(models.User.nom).all()

@router.post("/", response_model=schemas.UserOut, status_code=201)
def create_user(data: schemas.UserCreate, db: Session = Depends(get_db),
                _: models.User = Depends(require_role("chef"))):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = models.User(
        nom=data.nom, email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role, actif=True
    )
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db),
                me: models.User = Depends(require_role("chef"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user_id == me.id and data.role and data.role != me.role:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas changer votre propre rôle")
    if data.nom:   user.nom   = data.nom
    if data.email: user.email = data.email
    if data.role:  user.role  = data.role
    if data.password: user.hashed_password = hash_password(data.password)
    if data.actif is not None: user.actif = data.actif
    db.commit(); db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db),
                me: models.User = Depends(require_role("chef"))):
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(user); db.commit()