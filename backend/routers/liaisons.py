from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user, require_role

router = APIRouter()

def get_elem(db, eid, label="Élément"):
    e = db.query(models.Element).filter(models.Element.id == eid).first()
    if not e: raise HTTPException(status_code=404, detail=f"{label} introuvable (id={eid})")
    return e

@router.get("/element/{element_id}", response_model=List[schemas.LiaisonOut])
def get_liaisons_element(element_id: int, db: Session = Depends(get_db),
                         _: models.User = Depends(get_current_user)):
    """Retourne toutes les liaisons où cet élément apparaît (pieu, semelle ou poteau)"""
    return db.query(models.LiaisonStructurelle).filter(
        (models.LiaisonStructurelle.pieu_id    == element_id) |
        (models.LiaisonStructurelle.semelle_id == element_id) |
        (models.LiaisonStructurelle.poteau_id  == element_id)
    ).all()

@router.get("/semelle/{semelle_id}", response_model=List[schemas.LiaisonOut])
def get_pieux_semelle(semelle_id: int, db: Session = Depends(get_db),
                      _: models.User = Depends(get_current_user)):
    """Tous les pieux d'une semelle"""
    return db.query(models.LiaisonStructurelle)\
             .filter(models.LiaisonStructurelle.semelle_id == semelle_id)\
             .order_by(models.LiaisonStructurelle.ordre)\
             .all()

@router.get("/chaine/{element_id}")
def get_chaine(element_id: int, db: Session = Depends(get_db),
               _: models.User = Depends(get_current_user)):
    """Retourne la chaîne complète Pieu→Semelle→Poteau pour un élément donné"""
    e = get_elem(db, element_id)
    result = {"element": {"id": e.id, "reference": e.reference, "type": e.type_element.value}}

    if e.type_element.value == "Pieu":
        liaison = db.query(models.LiaisonStructurelle)\
                    .filter(models.LiaisonStructurelle.pieu_id == element_id).first()
        if liaison:
            s = liaison.semelle
            p = liaison.poteau
            result["semelle"] = {"id": s.id, "reference": s.reference} if s else None
            result["poteau"]  = {"id": p.id, "reference": p.reference} if p else None
            # Autres pieux de la même semelle
            autres = db.query(models.LiaisonStructurelle)\
                       .filter(models.LiaisonStructurelle.semelle_id == liaison.semelle_id,
                               models.LiaisonStructurelle.pieu_id != element_id).all()
            result["pieux_semelle"] = [{"id": l.pieu_id, "reference": l.pieu.reference, "ordre": l.ordre} for l in autres]

    elif e.type_element.value == "Semelle":
        liaisons = db.query(models.LiaisonStructurelle)\
                     .filter(models.LiaisonStructurelle.semelle_id == element_id)\
                     .order_by(models.LiaisonStructurelle.ordre).all()
        result["pieux"]  = [{"id": l.pieu_id, "reference": l.pieu.reference, "ordre": l.ordre} for l in liaisons]
        result["poteau"] = {"id": liaisons[0].poteau_id, "reference": liaisons[0].poteau.reference} if liaisons and liaisons[0].poteau else None

    elif e.type_element.value == "Poteau":
        liaisons = db.query(models.LiaisonStructurelle)\
                     .filter(models.LiaisonStructurelle.poteau_id == element_id).all()
        semelles = list({l.semelle_id: l.semelle for l in liaisons}.values())
        result["semelles"] = [{"id": s.id, "reference": s.reference} for s in semelles if s]

    return result

@router.post("/", response_model=schemas.LiaisonOut, status_code=201)
def create_liaison(data: schemas.LiaisonCreate, db: Session = Depends(get_db),
                   _: models.User = Depends(require_role("chef","suivi","civil"))):
    pieu    = get_elem(db, data.pieu_id, "Pieu")
    semelle = get_elem(db, data.semelle_id, "Semelle")

    if pieu.type_element.value != "Pieu":
        raise HTTPException(status_code=400, detail=f"L'élément {pieu.reference} n'est pas un Pieu")
    if semelle.type_element.value != "Semelle":
        raise HTTPException(status_code=400, detail=f"L'élément {semelle.reference} n'est pas une Semelle")
    if data.poteau_id:
        poteau = get_elem(db, data.poteau_id, "Poteau")
        if poteau.type_element.value != "Poteau":
            raise HTTPException(status_code=400, detail=f"L'élément {poteau.reference} n'est pas un Poteau")

    # Vérifier unicité
    existing = db.query(models.LiaisonStructurelle).filter(
        models.LiaisonStructurelle.pieu_id == data.pieu_id,
        models.LiaisonStructurelle.semelle_id == data.semelle_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cette liaison pieu-semelle existe déjà")

    l = models.LiaisonStructurelle(**data.model_dump())
    db.add(l); db.commit(); db.refresh(l)
    return l

@router.delete("/{liaison_id}", status_code=204)
def delete_liaison(liaison_id: int, db: Session = Depends(get_db),
                   _: models.User = Depends(require_role("chef","suivi","civil"))):
    l = db.query(models.LiaisonStructurelle).filter(models.LiaisonStructurelle.id == liaison_id).first()
    if not l: raise HTTPException(status_code=404, detail="Liaison introuvable")
    db.delete(l); db.commit()