from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user, require_role

router = APIRouter()

@router.get("/{element_id}", response_model=List[schemas.CoucheGeoOut])
def get_couches(element_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    return db.query(models.CoucheGeo)\
             .filter(models.CoucheGeo.element_id == element_id)\
             .order_by(models.CoucheGeo.profondeur_top)\
             .all()

@router.post("/", response_model=schemas.CoucheGeoOut, status_code=201)
def add_couche(data: schemas.CoucheGeoCreate, db: Session = Depends(get_db),
               _: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    if data.profondeur_top <= data.profondeur_bottom:
        raise HTTPException(status_code=400, detail="profondeur_top doit être > profondeur_bottom (ex: top=-1.0, bottom=-3.5)")
    e = db.query(models.Element).filter(models.Element.id == data.element_id).first()
    if not e: raise HTTPException(status_code=404, detail="Élément introuvable")
    c = models.CoucheGeo(**data.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.put("/{couche_id}", response_model=schemas.CoucheGeoOut)
def update_couche(couche_id: int, data: schemas.CoucheGeoCreate, db: Session = Depends(get_db),
                  _: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    c = db.query(models.CoucheGeo).filter(models.CoucheGeo.id == couche_id).first()
    if not c: raise HTTPException(status_code=404, detail="Couche introuvable")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return c

@router.delete("/{couche_id}", status_code=204)
def delete_couche(couche_id: int, db: Session = Depends(get_db),
                  _: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    c = db.query(models.CoucheGeo).filter(models.CoucheGeo.id == couche_id).first()
    if not c: raise HTTPException(status_code=404, detail="Couche introuvable")
    db.delete(c); db.commit()