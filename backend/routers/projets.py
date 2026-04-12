from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user, require_role

router = APIRouter()

@router.get("/", response_model=List[schemas.ProjetOut])
def list_projets(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.query(models.Projet).order_by(models.Projet.created_at.desc()).all()

@router.post("/", response_model=schemas.ProjetOut, status_code=201)
def create_projet(data: schemas.ProjetCreate, db: Session = Depends(get_db),
                  _: models.User = Depends(require_role("chef", "suivi"))):
    p = models.Projet(**data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.get("/{projet_id}", response_model=schemas.ProjetOut)
def get_projet(projet_id: int, db: Session = Depends(get_db),
               _: models.User = Depends(get_current_user)):
    p = db.query(models.Projet).filter(models.Projet.id == projet_id).first()
    if not p: raise HTTPException(status_code=404, detail="Projet introuvable")
    return p

@router.put("/{projet_id}", response_model=schemas.ProjetOut)
def update_projet(projet_id: int, data: schemas.ProjetCreate, db: Session = Depends(get_db),
                  _: models.User = Depends(require_role("chef", "suivi"))):
    p = db.query(models.Projet).filter(models.Projet.id == projet_id).first()
    if not p: raise HTTPException(status_code=404, detail="Projet introuvable")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

@router.delete("/{projet_id}", status_code=204)
def delete_projet(projet_id: int, db: Session = Depends(get_db),
                  _: models.User = Depends(require_role("chef"))):
    p = db.query(models.Projet).filter(models.Projet.id == projet_id).first()
    if not p: raise HTTPException(status_code=404, detail="Projet introuvable")
    db.delete(p); db.commit()