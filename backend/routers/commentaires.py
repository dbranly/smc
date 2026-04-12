from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter()

@router.get("/{element_id}", response_model=List[schemas.CommentaireOut])
def get_commentaires(element_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.query(models.Commentaire).filter(
        models.Commentaire.element_id == element_id
    ).order_by(models.Commentaire.created_at).all()

@router.post("/", response_model=schemas.CommentaireOut, status_code=201)
def add_commentaire(data: schemas.CommentaireCreate, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
    if current_user.role == models.RoleEnum.moa:
        raise HTTPException(status_code=403, detail="Le maître d'ouvrage ne peut pas commenter")
    c = models.Commentaire(**data.model_dump(), auteur_id=current_user.id)
    db.add(c); db.commit(); db.refresh(c)
    return c