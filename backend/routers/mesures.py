from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user, require_role

router = APIRouter()

@router.get("/{element_id}", response_model=List[schemas.MesureOut])
def get_mesures(element_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.query(models.MesureElement).filter(
        models.MesureElement.element_id == element_id
    ).order_by(models.MesureElement.date_mesure).all()

@router.post("/", response_model=schemas.MesureOut, status_code=201)
def add_mesure(data: schemas.MesureCreate, db: Session = Depends(get_db),
               current_user: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    e = db.query(models.Element).filter(models.Element.id == data.element_id).first()
    if not e: raise HTTPException(status_code=404, detail="Élément introuvable")
    m = models.MesureElement(**data.model_dump(), operateur_id=current_user.id)
    db.add(m); db.commit(); db.refresh(m)
    return m

@router.delete("/{mesure_id}", status_code=204)
def delete_mesure(mesure_id: int, db: Session = Depends(get_db),
                  _: models.User = Depends(require_role("chef"))):
    m = db.query(models.MesureElement).filter(models.MesureElement.id == mesure_id).first()
    if not m: raise HTTPException(status_code=404, detail="Mesure introuvable")
    db.delete(m); db.commit()