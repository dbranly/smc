from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user, require_role
import openpyxl, io, math

router = APIRouter()

def get_elem(db, element_id):
    e = db.query(models.Element).filter(models.Element.id == element_id).first()
    if not e: raise HTTPException(status_code=404, detail="Élément introuvable")
    return e

# ── CRUD ─────────────────────────────────────────────────────────
@router.get("/", response_model=List[schemas.ElementOut])
def list_elements(
    projet_id: Optional[int] = None,
    lot: Optional[str] = None,
    type_element: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    q = db.query(models.Element)
    if projet_id:    q = q.filter(models.Element.projet_id == projet_id)
    if lot:          q = q.filter(models.Element.lot == lot)
    if type_element: q = q.filter(models.Element.type_element == type_element)
    return q.order_by(models.Element.reference).all()

@router.get("/{element_id}", response_model=schemas.ElementOut)
def get_element(element_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return get_elem(db, element_id)

@router.post("/", response_model=schemas.ElementOut, status_code=201)
def create_element(data: schemas.ElementCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    e = models.Element(**data.model_dump(), createur_id=current_user.id)
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.put("/{element_id}", response_model=schemas.ElementOut)
def update_element(element_id: int, data: schemas.ElementUpdate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    e = get_elem(db, element_id)
    if e.statut_validation == models.StatutEnum.valide and current_user.role != models.RoleEnum.chef:
        raise HTTPException(status_code=403, detail="Élément validé — modification réservée au chef")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit(); db.refresh(e)
    return e

@router.delete("/{element_id}", status_code=204)
def delete_element(element_id: int, db: Session = Depends(get_db),
                   _: models.User = Depends(require_role("chef"))):
    e = get_elem(db, element_id)
    db.delete(e); db.commit()

# ── Workflow validation ──────────────────────────────────────────
@router.post("/{element_id}/soumettre", response_model=schemas.ElementOut)
def soumettre(element_id: int, db: Session = Depends(get_db),
              _: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    e = get_elem(db, element_id)
    if e.statut_validation not in [models.StatutEnum.brouillon, models.StatutEnum.rejete]:
        raise HTTPException(status_code=400, detail="Seul un brouillon/rejeté peut être soumis")
    e.statut_validation = models.StatutEnum.en_revue
    db.commit(); db.refresh(e)
    return e

@router.post("/{element_id}/valider", response_model=schemas.ElementOut)
def valider(element_id: int, action: schemas.ValidationAction, db: Session = Depends(get_db),
            _: models.User = Depends(require_role("chef"))):
    e = get_elem(db, element_id)
    if e.statut_validation != models.StatutEnum.en_revue:
        raise HTTPException(status_code=400, detail="Seul un élément 'En revue' peut être validé/rejeté")
    if action.action == "valider":
        e.statut_validation = models.StatutEnum.valide
        e.commentaire_rejet = None
    elif action.action == "rejeter":
        if not action.commentaire:
            raise HTTPException(status_code=400, detail="Commentaire obligatoire pour rejeter")
        e.statut_validation = models.StatutEnum.rejete
        e.commentaire_rejet = action.commentaire
    else:
        raise HTTPException(status_code=400, detail="Action invalide")
    db.commit(); db.refresh(e)
    return e

# ── Import Excel ─────────────────────────────────────────────────
@router.post("/import/excel")
def import_excel(
    projet_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("chef","suivi"))
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Fichier Excel requis")
    wb = openpyxl.load_workbook(io.BytesIO(file.file.read()), data_only=True)
    ws = wb.active
    headers = [str(c.value).strip().lower().replace(" ","_") if c.value else "" for c in ws[1]]
    created, updated, errors = 0, 0, []

    for row in ws.iter_rows(min_row=2, values_only=True):
        d = dict(zip(headers, row))
        ref = str(d.get("reference","") or d.get("repere","") or "").strip()
        if not ref: continue
        try:
            e = db.query(models.Element).filter(
                models.Element.projet_id == projet_id,
                models.Element.reference == ref
            ).first()
            lot = str(d.get("lot","Fondations") or "Fondations")
            type_el = str(d.get("type_element","Pieu") or "Pieu")

            def fv(k): 
                v = d.get(k)
                try: return float(v) if v not in (None,"","None") else None
                except: return None

            fields = dict(
                projet_id=projet_id, reference=ref,
                lot=lot, type_element=type_el,
                famille=str(d.get("famille","") or "").strip() or None,
                coord_x=fv("coord_x") or fv("x"), coord_y=fv("coord_y") or fv("y"),
                diametre=fv("diametre") or fv("ø") or fv("type"),
                cote_bs_theorique=fv("cote_bs_theorique") or fv("bs_th"),
                cote_bi_theorique=fv("cote_bi_theorique") or fv("bi_th"),
                cote_bs_reelle=fv("cote_bs_reelle") or fv("bs_reel"),
                cote_bi_reelle=fv("cote_bi_reelle") or fv("bi_reel"),
                longueur_theorique=fv("longueur_theorique") or fv("l_th"),
                longueur_reelle=fv("longueur_reelle") or fv("l_reel"),
                volume_budgetise=fv("volume_budgetise") or fv("vol_budg"),
                volume_fore=fv("volume_fore") or fv("vol_fore"),
                volume_recepé=fv("volume_recepé") or fv("vol_recep"),
                materiau=str(d.get("materiau","") or "").strip() or None,
            )
            if e:
                for k, v in fields.items():
                    if v is not None: setattr(e, k, v)
                updated += 1
            else:
                e = models.Element(**{k:v for k,v in fields.items() if v is not None}, createur_id=current_user.id)
                db.add(e)
                created += 1
        except Exception as ex:
            errors.append({"reference": ref, "erreur": str(ex)})
    db.commit()
    return {"créés": created, "mis_à_jour": updated, "erreurs": errors}

# ── Export template Excel ────────────────────────────────────────
@router.get("/export/template-excel")
def export_template(_: models.User = Depends(get_current_user)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pieux"
    headers = ["reference","lot","type_element","famille","coord_x","coord_y",
               "diametre","cote_bs_theorique","cote_bi_theorique","cote_bs_reelle","cote_bi_reelle",
               "longueur_theorique","longueur_reelle","volume_budgetise","volume_fore","volume_recepé","materiau"]
    ws.append(headers)
    # Exemple ligne
    ws.append(["Pi.1","Fondations","Pieu","F1",778930.920,428785.296,800,-3.00,-4.20,None,None,1.20,None,0.603,None,None,"Béton C30/37"])
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=template_pieux.xlsx"})

# ── Export DXF AutoCAD ───────────────────────────────────────────
@router.get("/export/dxf/{projet_id}")
def export_dxf(projet_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    try:
        import ezdxf
    except ImportError:
        raise HTTPException(status_code=500, detail="Module ezdxf non installé")

    elements = db.query(models.Element).filter(models.Element.projet_id == projet_id).all()
    doc = ezdxf.new(dxfversion="R2010")
    doc.layers.new("PIEUX",    dxfattribs={"color": 1})
    doc.layers.new("SEMELLES", dxfattribs={"color": 3})
    doc.layers.new("POTEAUX",  dxfattribs={"color": 5})
    doc.layers.new("AUTRES",   dxfattribs={"color": 7})
    msp = doc.modelspace()

    LAYER_MAP = {"Pieu": "PIEUX", "Semelle": "SEMELLES", "Poteau": "POTEAUX"}

    for e in elements:
        if e.coord_x is None or e.coord_y is None:
            continue
        layer = LAYER_MAP.get(e.type_element.value if hasattr(e.type_element,'value') else e.type_element, "AUTRES")
        r = (e.diametre or 800) / 2000  # mm → m, rayon

        # Cercle en vue plan
        msp.add_circle(center=(e.coord_x, e.coord_y, 0), radius=r, dxfattribs={"layer": layer})

        # Label
        msp.add_text(e.reference, dxfattribs={
            "layer": layer, "height": 0.15,
            "insert": (e.coord_x + r + 0.1, e.coord_y)
        })

        # Représentation 3D (cylindre approché par 2 cercles + lignes)
        bs = e.cote_bs_reelle or e.cote_bs_theorique or 0
        bi = e.cote_bi_reelle or e.cote_bi_theorique or -1
        msp.add_circle(center=(e.coord_x, e.coord_y, bs), radius=r, dxfattribs={"layer": layer})
        msp.add_circle(center=(e.coord_x, e.coord_y, bi), radius=r, dxfattribs={"layer": layer})
        for angle in [0, 90, 180, 270]:
            rad = math.radians(angle)
            px = e.coord_x + r * math.cos(rad)
            py = e.coord_y + r * math.sin(rad)
            msp.add_line((px, py, bs), (px, py, bi), dxfattribs={"layer": layer})

    buf = io.StringIO()
    doc.write(buf)
    content = buf.getvalue().encode('utf-8')
    buf = io.BytesIO(content)
    return StreamingResponse(buf, media_type="application/dxf",
                             headers={"Content-Disposition": f"attachment; filename=smc_projet_{projet_id}.dxf"})

# ── Stats ────────────────────────────────────────────────────────
@router.get("/stats/{projet_id}")
def stats(projet_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    elements = db.query(models.Element).filter(models.Element.projet_id == projet_id).all()
    total = len(elements)
    if total == 0:
        return {"total": 0, "par_type": {}, "par_statut": {}, "volumes": {}}

    par_type   = {}
    par_statut = {}
    vol_budg = vol_fore = vol_recep = 0

    for e in elements:
        t = e.type_element.value if hasattr(e.type_element,'value') else str(e.type_element)
        s = e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element)
        par_type[t]   = par_type.get(t, 0) + 1
        par_statut[s] = par_statut.get(s, 0) + 1
        vol_budg  += e.volume_budgetise or 0
        vol_fore  += e.volume_fore or 0
        vol_recep += e.volume_recepé or 0

    return {
        "total": total,
        "par_type": par_type,
        "par_statut": par_statut,
        "volumes": {
            "budgetise": round(vol_budg, 3),
            "fore":      round(vol_fore, 3),
            "recepé":    round(vol_recep, 3),
            "delta":     round(vol_fore - vol_budg, 3),
        }
    }