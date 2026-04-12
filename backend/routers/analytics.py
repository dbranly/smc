from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from database import get_db
import models
from auth import get_current_user

router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────────
def get_semaine(dt: datetime) -> str:
    """Retourne 'S01', 'S02'... basé sur la semaine ISO de l'année"""
    return f"S{dt.isocalendar()[1]:02d}"

def get_semaine_label(dt: datetime) -> str:
    return f"S{dt.isocalendar()[1]:02d}/{dt.year}"

# ── 1. KPIs globaux ───────────────────────────────────────────────
@router.get("/kpis/{projet_id}")
def get_kpis(projet_id: int, db: Session = Depends(get_db),
             _: models.User = Depends(get_current_user)):
    elements = db.query(models.Element).filter(models.Element.projet_id == projet_id).all()
    mesures  = db.query(models.MesureElement).join(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()

    total = len(elements)
    if total == 0:
        return {"total": 0}

    # Volumes
    vol_budg  = sum(e.volume_budgetise or 0 for e in elements)
    vol_fore  = sum(e.volume_fore or 0 for e in elements)
    vol_recep = sum(e.volume_recepé or 0 for e in elements)
    vol_fin   = sum(e.volume_final or 0 for e in elements)

    # Depuis mesures (plus précis si renseignées)
    vol_fore_mes  = sum(m.volume_fore or 0 for m in mesures)
    vol_recep_mes = sum(m.volume_recepé or 0 for m in mesures)

    # Statuts
    par_statut = {}
    for e in elements:
        k = e.statut_element.value if hasattr(e.statut_element, 'value') else str(e.statut_element)
        par_statut[k] = par_statut.get(k, 0) + 1

    # Par type
    par_type = {}
    for e in elements:
        k = e.type_element.value if hasattr(e.type_element, 'value') else str(e.type_element)
        par_type[k] = par_type.get(k, 0) + 1

    # Par famille
    par_famille = {}
    for e in elements:
        if e.famille:
            par_famille[e.famille] = par_famille.get(e.famille, 0) + 1

    # Recépés (ont au moins une mesure phase apres_recepage)
    recepés_ids = {m.element_id for m in mesures if m.phase == 'apres_recepage'}
    nb_recepés  = len(recepés_ids)

    # Taux d'avancement global (basé sur statut_element)
    poids = {'À faire': 0, 'En cours': 0.25, 'Foré': 0.6, 'Recépé': 0.85, 'Validé': 1.0,
             'Coulé': 0.6, 'Décoffré': 0.85}
    avancement_global = round(
        sum(poids.get(e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element), 0)
            for e in elements) / total * 100, 1
    )

    return {
        "total": total,
        "par_statut": par_statut,
        "par_type": par_type,
        "par_famille": par_famille,
        "volumes": {
            "budgetise":  round(vol_budg, 3),
            "fore":       round(max(vol_fore, vol_fore_mes), 3),
            "recepé":     round(max(vol_recep, vol_recep_mes), 3),
            "final":      round(vol_fin, 3),
            "delta_fore": round(max(vol_fore, vol_fore_mes) - vol_budg, 3),
            "taux_recepage": round(max(vol_recep, vol_recep_mes) / max(vol_fore, vol_fore_mes) * 100, 1)
                             if max(vol_fore, vol_fore_mes) > 0 else 0,
        },
        "nb_recepés": nb_recepés,
        "avancement_global": avancement_global,
        "nb_mesures": len(mesures),
    }

# ── 2. Courbe volumes dans le temps ──────────────────────────────
@router.get("/courbe-volumes/{projet_id}")
def courbe_volumes(
    projet_id: int,
    granularite: str = Query("semaine", enum=["semaine", "date"]),
    type_element: Optional[str] = None,
    famille: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    q = db.query(models.MesureElement).join(models.Element)\
          .filter(models.Element.projet_id == projet_id)
    if type_element:
        q = q.filter(models.Element.type_element == type_element)
    if famille:
        q = q.filter(models.Element.famille == famille)

    mesures = q.order_by(models.MesureElement.date_mesure).all()
    if not mesures:
        return []

    # Agrégation par période
    buckets = {}
    for m in mesures:
        if granularite == "semaine":
            key = get_semaine_label(m.date_mesure)
        else:
            key = m.date_mesure.strftime("%d/%m/%Y")

        if key not in buckets:
            buckets[key] = {"periode": key, "volume_fore": 0, "volume_recepé": 0,
                            "nb_mesures": 0, "phases": {}}
        buckets[key]["volume_fore"]   += m.volume_fore or 0
        buckets[key]["volume_recepé"] += m.volume_recepé or 0
        buckets[key]["nb_mesures"]    += 1
        phase = m.phase or "autre"
        buckets[key]["phases"][phase] = buckets[key]["phases"].get(phase, 0) + 1

    # Cumuler
    result = []
    cum_fore = cum_recep = 0
    for key in sorted(buckets.keys()):
        b = buckets[key]
        cum_fore  += b["volume_fore"]
        cum_recep += b["volume_recepé"]
        result.append({
            "periode":        key,
            "volume_fore":    round(b["volume_fore"], 3),
            "volume_recepé":  round(b["volume_recepé"], 3),
            "cumul_fore":     round(cum_fore, 3),
            "cumul_recepé":   round(cum_recep, 3),
            "nb_mesures":     b["nb_mesures"],
            "phases":         b["phases"],
        })
    return result

# ── 3. Suivi recépage par élément ─────────────────────────────────
@router.get("/recepage/{element_id}")
def suivi_recepage(element_id: int, db: Session = Depends(get_db),
                   _: models.User = Depends(get_current_user)):
    element = db.query(models.Element).filter(models.Element.id == element_id).first()
    if not element:
        return {"error": "Élément introuvable"}

    mesures = db.query(models.MesureElement)\
                .filter(models.MesureElement.element_id == element_id)\
                .order_by(models.MesureElement.date_mesure).all()

    cote_cible = element.cote_bs_theorique  # cote à atteindre
    progression = []
    for m in mesures:
        ecart = None
        if m.cote_tete is not None and cote_cible is not None:
            ecart = round(m.cote_tete - cote_cible, 3)  # positif = pas encore atteint
        progression.append({
            "date":          m.date_mesure.isoformat(),
            "phase":         m.phase,
            "cote_tete":     m.cote_tete,
            "cote_pied":     m.cote_pied,
            "volume_fore":   m.volume_fore,
            "volume_recepé": m.volume_recepé,
            "ecart_cible":   ecart,
            "cote_atteinte": ecart is not None and ecart <= 0.05,
            "commentaire":   m.commentaire,
            "operateur":     m.operateur.nom if m.operateur else None,
        })

    vol_total_recepé = sum(m.volume_recepé or 0 for m in mesures)
    cote_atteinte = any(p["cote_atteinte"] for p in progression)

    return {
        "element": {
            "id": element.id, "reference": element.reference,
            "cote_bs_theorique": element.cote_bs_theorique,
            "cote_bi_theorique": element.cote_bi_theorique,
            "volume_budgetise":  element.volume_budgetise,
        },
        "nb_recepages":       sum(1 for m in mesures if m.phase == 'apres_recepage'),
        "vol_total_recepé":   round(vol_total_recepé, 3),
        "cote_atteinte":      cote_atteinte,
        "progression":        progression,
    }

# ── 4. Volumes par bloc/famille ───────────────────────────────────
@router.get("/volumes-par-famille/{projet_id}")
def volumes_par_famille(projet_id: int, db: Session = Depends(get_db),
                        _: models.User = Depends(get_current_user)):
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()

    familles = {}
    for e in elements:
        f = e.famille or "Sans famille"
        if f not in familles:
            familles[f] = {
                "famille": f, "nb_elements": 0,
                "vol_budgetise": 0, "vol_fore": 0, "vol_recepé": 0,
                "nb_valides": 0, "nb_total": 0,
            }
        familles[f]["nb_elements"]  += 1
        familles[f]["nb_total"]     += 1
        familles[f]["vol_budgetise"]+= e.volume_budgetise or 0
        familles[f]["vol_fore"]     += e.volume_fore or 0
        familles[f]["vol_recepé"]   += e.volume_recepé or 0
        if (e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element)) == 'Validé':
            familles[f]["nb_valides"] += 1

    result = []
    for f, d in sorted(familles.items()):
        d["vol_budgetise"] = round(d["vol_budgetise"], 3)
        d["vol_fore"]      = round(d["vol_fore"], 3)
        d["vol_recepé"]    = round(d["vol_recepé"], 3)
        d["delta"]         = round(d["vol_fore"] - d["vol_budgetise"], 3)
        d["taux_avancement"] = round(d["nb_valides"] / d["nb_total"] * 100, 1) if d["nb_total"] else 0
        d["pct_fore"]      = round(d["vol_fore"] / d["vol_budgetise"] * 100, 1) if d["vol_budgetise"] else 0
        result.append(d)
    return result

# ── 5. Alertes ────────────────────────────────────────────────────
@router.get("/alertes/{projet_id}")
def get_alertes(projet_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    alertes = []
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()

    for e in elements:
        ref = e.reference
        statut = e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element)
        val    = e.statut_validation.value if hasattr(e.statut_validation,'value') else str(e.statut_validation)

        # En attente de validation depuis > 2 jours
        if val == 'En revue' and e.updated_at:
            jours = (datetime.utcnow() - e.updated_at.replace(tzinfo=None)).days
            if jours >= 2:
                alertes.append({"type": "validation_tardive", "element_id": e.id,
                    "reference": ref, "message": f"{ref} en attente de validation depuis {jours}j",
                    "severite": "warning"})

        # Dépassement volume
        if e.volume_budgetise and e.volume_fore:
            delta_pct = (e.volume_fore - e.volume_budgetise) / e.volume_budgetise * 100
            if delta_pct > 15:
                alertes.append({"type": "depassement_volume", "element_id": e.id,
                    "reference": ref, "message": f"{ref} : dépassement volume +{delta_pct:.1f}%",
                    "severite": "danger"})

        # Charge dépassée
        ref_charge = e.charge_admissible_mesure or e.charge_admissible_calc
        if ref_charge and e.charge_appliquee and e.charge_appliquee > ref_charge:
            alertes.append({"type": "charge_depassee", "element_id": e.id,
                "reference": ref,
                "message": f"{ref} : charge appliquée ({e.charge_appliquee}kN) > admissible ({ref_charge}kN)",
                "severite": "danger"})

        # Recépé mais cote non atteinte (si mesures disponibles)
        if statut == 'Recépé' and e.cote_bs_theorique is not None and e.cote_bs_reelle is not None:
            if e.cote_bs_reelle > e.cote_bs_theorique + 0.05:
                alertes.append({"type": "cote_non_atteinte", "element_id": e.id,
                    "reference": ref,
                    "message": f"{ref} : cote réelle ({e.cote_bs_reelle}m) > cote cible ({e.cote_bs_theorique}m)",
                    "severite": "warning"})

    return sorted(alertes, key=lambda x: ("danger","warning").index(x["severite"]))

# ── 6. Avancement par semaine (statuts) ───────────────────────────
@router.get("/avancement-semaines/{projet_id}")
def avancement_semaines(projet_id: int, db: Session = Depends(get_db),
                        _: models.User = Depends(get_current_user)):
    mesures = db.query(models.MesureElement).join(models.Element)\
                .filter(models.Element.projet_id == projet_id)\
                .order_by(models.MesureElement.date_mesure).all()

    semaines = {}
    for m in mesures:
        key = get_semaine_label(m.date_mesure)
        if key not in semaines:
            semaines[key] = {"semaine": key, "nb_mesures": 0,
                             "avant_recepage": 0, "apres_recepage": 0, "controle": 0,
                             "vol_fore": 0, "vol_recepé": 0}
        semaines[key]["nb_mesures"] += 1
        semaines[key]["vol_fore"]   += m.volume_fore or 0
        semaines[key]["vol_recepé"] += m.volume_recepé or 0
        phase = m.phase or "autre"
        if phase in semaines[key]:
            semaines[key][phase] += 1

    result = []
    for k in sorted(semaines.keys()):
        s = semaines[k]
        s["vol_fore"]   = round(s["vol_fore"], 3)
        s["vol_recepé"] = round(s["vol_recepé"], 3)
        result.append(s)
    return result