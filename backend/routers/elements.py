from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
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
def get_element(element_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    return get_elem(db, element_id)

@router.post("/", response_model=schemas.ElementOut, status_code=201)
def create_element(data: schemas.ElementCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(require_role("chef","suivi","topo","civil"))):
    e = models.Element(**data.model_dump(), createur_id=current_user.id)
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.put("/{element_id}", response_model=schemas.ElementOut)
def update_element(element_id: int, data: schemas.ElementUpdate,
                   db: Session = Depends(get_db),
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
                   _: models.User = Depends(require_role("chef","suivi"))):
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
def valider(element_id: int, action: schemas.ValidationAction,
            db: Session = Depends(get_db),
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

    # Normaliser les en-têtes (insensible à la casse et aux espaces)
    raw_headers = [str(c.value).strip().upper().replace(" ","_") if c.value else "" for c in ws[1]]
    # Si ligne 2 est aussi une ligne d'en-tête (cas du fichier Warda à 2 lignes d'en-tête)
    second_row = [ws.cell(2, ci+1).value for ci in range(len(raw_headers))]
    has_double_header = any(isinstance(v, str) and v.strip().upper() in ('X','Y','Z','TOIT_ROCHEUX','ROCHE')
                            for v in second_row if v)
    start_row = 3 if has_double_header else 2

    # Construire les en-têtes fusionnés pour le fichier Warda (colonnes groupées)
    def build_headers(ws, has_double_header):
        headers = []
        row1 = [str(ws.cell(1, ci).value).strip().upper().replace(" ","_") if ws.cell(1, ci).value else ""
                for ci in range(1, ws.max_column+1)]
        if not has_double_header:
            return row1
        row2 = [str(ws.cell(2, ci).value).strip().upper().replace(" ","_") if ws.cell(2, ci).value else ""
                for ci in range(1, ws.max_column+1)]
        last_group = ""
        for r1, r2 in zip(row1, row2):
            if r1: last_group = r1
            if r2:
                headers.append(f"{last_group}_{r2}")
            else:
                headers.append(last_group)
        return headers

    headers = build_headers(ws, has_double_header)
    headers_lower = [h.lower() for h in headers]

    def col(d, *keys):
        """Cherche une valeur parmi plusieurs clés possibles"""
        for k in keys:
            v = d.get(k.lower())
            if v not in (None, "", "None", "/", "none"):
                try: return float(v)
                except: pass
        return None

    def col_str(d, *keys):
        for k in keys:
            v = d.get(k.lower())
            if v and str(v).strip() not in ("", "None", "/", "none"):
                return str(v).strip()
        return None

    def col_date(d, *keys):
        for k in keys:
            v = d.get(k.lower())
            if v and isinstance(v, datetime):
                return v
            if v and isinstance(v, str):
                try: return datetime.strptime(v, "%d/%m/%Y")
                except: pass
        return None

    created, updated, errors = 0, 0, []

    for row_values in ws.iter_rows(min_row=start_row, values_only=True):
        d = dict(zip(headers_lower, row_values))

        # Référence : chercher dans PIEUX, REFERENCE, REPERE
        ref = col_str(d, "pieux", "reference", "repere", "pile_number")
        if not ref: continue

        # Normaliser la référence PI017 → Pi.17 ou garder telle quelle
        # On garde le format d'origine pour compatibilité
        try:
            # Coordonnées théoriques
            theo_x = col(d, "coordonnees_theoriques_x", "theo_x", "coord_x", "e(x)")
            theo_y = col(d, "coordonnees_theoriques_y", "theo_y", "coord_y", "n(y)")

            # Coordonnées virole
            virole_x = col(d, "coordonnees_virole_x", "virole_x", "coord_virole_x")
            virole_y = col(d, "coordonnees_virole_y", "virole_y", "coord_virole_y")
            virole_z = col(d, "coordonnees_virole_z", "virole_z", "coord_virole_z",
                           "altitude_virole", "elevation")

            # Cotes
            cote_plancher = col(d, "cote_plancher", "zp", "altitude_plancher")
            cote_recepee  = col(d, "cote_recepee_a_atteindre", "cote_recepee")

            # Profondeurs
            prof_toit = col(d, "profondeurs_(m)_toit_rocheux", "prof_toit_rocheux",
                            "toit_rocheux", "depth")
            prof_roche= col(d, "profondeurs_(m)_roche", "prof_roche", "roche")
            ancrage   = col(d, "ancrage", "ancrage_(m)")

            # Calculer ancrage si manquant
            if ancrage is None and prof_toit is not None and prof_roche is not None:
                ancrage = round(prof_roche - prof_toit, 4)

            # Volume béton
            vol_beton = col(d, "beton_arme_qte_(m3)", "volume_beton", "volume_fore",
                            "vol_beton", "volume_budgetise")

            # Calculer volume si manquant (π×r²×prof_roche)
            if vol_beton is None and prof_roche is not None:
                d_pieu = col(d, "diametre", "diameter") or 0.8  # défaut Ø800
                vol_beton = round(math.pi * (d_pieu/2)**2 * prof_roche, 4)

            # Liaisons
            semelle_ref = col_str(d, "semelle")
            poteau_ref  = col_str(d, "poteau")

            # Date forage
            date_forage = col_date(d, "date")

            # Lot et type
            lot      = col_str(d, "lot") or "Fondations"
            type_el  = col_str(d, "type_element") or "Pieu"
            famille  = col_str(d, "famille")
            materiau = col_str(d, "materiau")
            armature = col_str(d, "armature")

            # Statut : si volume_fore renseigné → Foré
            statut = col_str(d, "statut_element") or "À faire"
            if vol_beton and vol_beton > 0 and statut == "À faire":
                statut = "Foré"

            fields = dict(
                projet_id       = projet_id,
                reference       = ref,
                lot             = lot,
                type_element    = type_el,
                famille         = famille,
                # Coordonnées théoriques
                coord_x         = theo_x,
                coord_y         = theo_y,
                # Coordonnées virole
                coord_virole_x  = virole_x,
                coord_virole_y  = virole_y,
                coord_virole_z  = virole_z,
                # Cotes
                cote_plancher   = cote_plancher,
                cote_recepee    = cote_recepee,
                # Profondeurs
                prof_toit_rocheux = prof_toit,
                prof_roche      = prof_roche,
                ancrage         = ancrage,
                # Volume
                volume_fore     = vol_beton,
                volume_budgetise= col(d, "volume_budgetise", "vol_budg"),
                # Liaisons
                semelle_ref     = semelle_ref if semelle_ref != "/" else None,
                poteau_ref      = poteau_ref if poteau_ref != "/" else None,
                # Date
                date_forage     = date_forage,
                # Matériaux
                materiau        = materiau,
                armature        = armature,
                # Statut
                statut_element  = statut,
            )

            # Chercher si l'élément existe déjà
            e = db.query(models.Element).filter(
                models.Element.projet_id == projet_id,
                models.Element.reference == ref
            ).first()

            if e:
                for k, v in fields.items():
                    if v is not None:
                        setattr(e, k, v)
                updated += 1
            else:
                clean = {k: v for k, v in fields.items() if v is not None}
                e = models.Element(**clean, createur_id=current_user.id)
                db.add(e)
                created += 1

        except Exception as ex:
            errors.append({"reference": ref, "erreur": str(ex)})

    db.commit()
    return {
        "créés": created,
        "mis_à_jour": updated,
        "erreurs": errors,
        "total": created + updated
    }

# ── Export template Excel ────────────────────────────────────────
@router.get("/export/template-excel")
def export_template(_: models.User = Depends(get_current_user)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pieux"
    headers = [
        "reference", "lot", "type_element", "famille",
        "coord_x", "coord_y",
        "coord_virole_x", "coord_virole_y", "coord_virole_z",
        "cote_plancher", "cote_recepee",
        "prof_toit_rocheux", "prof_roche", "ancrage",
        "diametre", "volume_budgetise", "volume_fore",
        "semelle_ref", "poteau_ref",
        "date_forage", "materiau", "armature", "statut_element"
    ]
    ws.append(headers)
    ws.append([
        "Pi.1", "Fondations", "Pieu", "F1",
        778930.920, 428785.296,
        778930.918, 428785.293, 715.95,
        715.26, 714.46,
        7.4, 8.52, 1.12,
        0.80, 0.603, 4.28,
        "/", "/",
        "2025-09-19", "Béton C30/37", "500A/B - Ø800", "Foré"
    ])
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_pieux.xlsx"}
    )

# ── Export DXF AutoCAD ───────────────────────────────────────────
@router.get("/export/dxf/{projet_id}")
def export_dxf(projet_id: int, db: Session = Depends(get_db),
               _: models.User = Depends(get_current_user)):
    try:
        import ezdxf
    except ImportError:
        raise HTTPException(status_code=500, detail="Module ezdxf non installé")

    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()
    doc = ezdxf.new(dxfversion="R2010")
    doc.layers.new("PIEUX",    dxfattribs={"color": 1})
    doc.layers.new("SEMELLES", dxfattribs={"color": 3})
    doc.layers.new("POTEAUX",  dxfattribs={"color": 5})
    doc.layers.new("AUTRES",   dxfattribs={"color": 7})
    msp = doc.modelspace()
    LAYER_MAP = {"Pieu": "PIEUX", "Semelle": "SEMELLES", "Poteau": "POTEAUX"}

    for e in elements:
        x = e.coord_virole_x or e.coord_x
        y = e.coord_virole_y or e.coord_y
        if x is None or y is None:
            continue
        layer = LAYER_MAP.get(
            e.type_element.value if hasattr(e.type_element,'value') else e.type_element,
            "AUTRES"
        )
        r = (e.diametre or 0.8) / 2

        msp.add_circle(center=(x, y, 0), radius=r, dxfattribs={"layer": layer})
        msp.add_text(e.reference, dxfattribs={
            "layer": layer, "height": 0.15,
            "insert": (x + r + 0.1, y)
        })

        bs = e.coord_virole_z or e.cote_bs_reelle or e.cote_bs_theorique or 0
        prof = e.prof_roche or 1
        bi   = bs - prof
        msp.add_circle(center=(x, y, bs), radius=r, dxfattribs={"layer": layer})
        msp.add_circle(center=(x, y, bi), radius=r, dxfattribs={"layer": layer})
        for angle in [0, 90, 180, 270]:
            rad = math.radians(angle)
            px = x + r * math.cos(rad)
            py = y + r * math.sin(rad)
            msp.add_line((px, py, bs), (px, py, bi), dxfattribs={"layer": layer})

    buf = io.StringIO()
    doc.write(buf)
    content = buf.getvalue().encode('utf-8')
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/dxf",
        headers={"Content-Disposition": f"attachment; filename=smc_projet_{projet_id}.dxf"}
    )

# ── Stats ────────────────────────────────────────────────────────
@router.get("/stats/{projet_id}")
def stats(projet_id: int, db: Session = Depends(get_db),
          _: models.User = Depends(get_current_user)):
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()
    total = len(elements)
    if total == 0:
        return {"total": 0, "par_type": {}, "par_statut": {}, "volumes": {}}

    par_type = {}; par_statut = {}
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
