from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
import models
from auth import get_current_user
import math

router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────────
JOURS_SEMAINE = {0:"Lun", 1:"Mar", 2:"Mer", 3:"Jeu", 4:"Ven", 5:"Sam"}
# Semaine Jeu→Mer, Dim(6) exclu

def get_semaine_label(dt: datetime) -> str:
    return f"S{dt.isocalendar()[1]:02d}/{dt.year}"

def get_mois_label(dt: datetime) -> str:
    mois = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
    return f"{mois[dt.month-1]} {dt.year}"

def pieu_realise(e: models.Element) -> bool:
    """Un pieu réalisé = foré ET bétonné = prof_roche > 0 ET volume_fore > 0"""
    return (e.prof_roche or 0) > 0 and (e.volume_fore or 0) > 0

def statut_val(e):
    return e.statut_element.value if hasattr(e.statut_element, 'value') else str(e.statut_element)

def type_val(e):
    return e.type_element.value if hasattr(e.type_element, 'value') else str(e.type_element)

# ── 1. KPIs globaux ───────────────────────────────────────────────
@router.get("/kpis/{projet_id}")
def get_kpis(
    projet_id: int,
    prix_m3: float = Query(150000, description="Prix béton armé en FCFA/m³"),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()
    total = len(elements)
    if total == 0:
        return {"total": 0}

    # Décomposition par type
    par_type = {}
    for e in elements:
        t = type_val(e)
        par_type[t] = par_type.get(t, 0) + 1

    # Statuts
    par_statut = {}
    for e in elements:
        s = statut_val(e)
        par_statut[s] = par_statut.get(s, 0) + 1

    # Par famille
    par_famille = {}
    for e in elements:
        if e.famille:
            par_famille[e.famille] = par_famille.get(e.famille, 0) + 1

    # Volumes béton armé (pieux + semelles)
    vol_budgetise = sum(e.volume_budgetise or 0 for e in elements)
    vol_fore      = sum(e.volume_fore or 0 for e in elements)
    vol_recepé    = sum(e.volume_recepé or 0 for e in elements)

    # Pieux réalisés (forés ET bétonnés)
    nb_realises = sum(1 for e in elements if pieu_realise(e))
    nb_pieux    = par_type.get("Pieu", 0)

    # Avancement global = nb_réalisés / nb_pieux_total × 100
    avancement_global = round(nb_realises / nb_pieux * 100, 1) if nb_pieux > 0 else 0

    # Taux de recépage = Σ V_rec_k / Σ V_fore_k × 100
    taux_recepage = round(vol_recepé / vol_fore * 100, 1) if vol_fore > 0 else 0

    # Coût global = Σ volume_fore × prix/m³ (BQE)
    cout_global = round(vol_fore * prix_m3, 0)

    # Alertes rapides
    nb_alertes = sum(
        1 for e in elements
        if e.volume_budgetise and e.volume_fore
        and (e.volume_fore - e.volume_budgetise) / e.volume_budgetise > 0.15
    )

    return {
        "total": total,
        "par_type": par_type,
        "par_statut": par_statut,
        "par_famille": par_famille,
        "pieux": {
            "total": nb_pieux,
            "realises": nb_realises,
            "avancement_pct": avancement_global,
        },
        "volumes": {
            "budgetise":    round(vol_budgetise, 3),
            "fore":         round(vol_fore, 3),
            "recepé":       round(vol_recepé, 3),
            "delta":        round(vol_fore - vol_budgetise, 3),
            "taux_recepage": taux_recepage,
        },
        "cout_global": {
            "total_fcfa":   cout_global,
            "prix_m3_fcfa": prix_m3,
            "volume_total": round(vol_fore, 3),
        },
        "avancement_global": avancement_global,
        "nb_alertes": nb_alertes,
    }

# ── 2. Courbe d'activités hebdomadaire ───────────────────────────
@router.get("/courbe-hebdo/{projet_id}")
def courbe_hebdo(
    projet_id: int,
    cadence_prevue: int = Query(2, description="Nombre de pieux prévus par jour"),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    """
    Courbe Jeu → Mer, Dimanche exclu.
    Prévisionnelle vs Réelle (pieux réalisés par jour).
    """
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id)\
                 .filter(models.Element.type_element == "Pieu")\
                 .all()

    # Pieux réalisés avec date
    realises = [e for e in elements if pieu_realise(e) and e.date_forage]

    if not realises:
        return {"semaines": [], "total_realises": 0, "total_prevu": 0}

    # Grouper par jour (Jeu=0 → Mer=6, sans Dim)
    jours_data = {}
    for e in realises:
        dt = e.date_forage
        if dt.weekday() == 6:  # Dimanche exclu
            continue
        key = dt.strftime("%Y-%m-%d")
        jours_data[key] = jours_data.get(key, 0) + 1

    # Trouver la plage de dates (semaine Jeu→Mer)
    dates_sorted = sorted(jours_data.keys())
    if not dates_sorted:
        return {"semaines": [], "total_realises": 0, "total_prevu": 0}

    date_debut = datetime.strptime(dates_sorted[0], "%Y-%m-%d")
    date_fin   = datetime.strptime(dates_sorted[-1], "%Y-%m-%d")

    # Trouver le jeudi de la semaine de début
    def jeudi_semaine(dt):
        # Aller au jeudi (weekday=3) de la même semaine ou précédente
        delta = (dt.weekday() - 3) % 7
        return dt - timedelta(days=delta)

    # Construire les semaines
    semaines = []
    current = jeudi_semaine(date_debut)
    cum_reel = 0
    cum_prevu = 0

    while current <= date_fin + timedelta(days=7):
        semaine_jours = []
        total_reel_semaine = 0
        total_prevu_semaine = 0

        for delta in range(7):  # Jeu(0) à Mer(6)
            jour = current + timedelta(days=delta)
            if jour.weekday() == 6:  # Dimanche skip
                continue
            key = jour.strftime("%Y-%m-%d")
            nb_reel = jours_data.get(key, 0)
            nb_prevu = cadence_prevue
            total_reel_semaine += nb_reel
            total_prevu_semaine += nb_prevu
            semaine_jours.append({
                "date":       key,
                "jour":       JOURS_SEMAINE.get(jour.weekday(), "?"),
                "reel":       nb_reel,
                "prevu":      nb_prevu,
            })

        cum_reel  += total_reel_semaine
        cum_prevu += total_prevu_semaine

        if total_reel_semaine > 0 or current <= date_fin:
            semaines.append({
                "semaine":          get_semaine_label(current),
                "debut":            current.strftime("%d/%m/%Y"),
                "fin":              (current + timedelta(days=6)).strftime("%d/%m/%Y"),
                "jours":            semaine_jours,
                "total_reel":       total_reel_semaine,
                "total_prevu":      total_prevu_semaine,
                "cumul_reel":       cum_reel,
                "cumul_prevu":      cum_prevu,
                "avancement_pct":   round(cum_reel / len(elements) * 100, 1) if elements else 0,
            })

        current += timedelta(days=7)
        if current > date_fin + timedelta(days=14):
            break

    return {
        "semaines": semaines,
        "total_realises": sum(jours_data.values()),
        "total_prevu": len(semaines) * 6 * cadence_prevue,
        "cadence_prevue": cadence_prevue,
        "nb_pieux_total": len(elements),
    }

# ── 3. Courbe mensuelle cumulée ──────────────────────────────────
@router.get("/courbe-mensuelle/{projet_id}")
def courbe_mensuelle(
    projet_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    """Vue mensuelle cumulée — pieux réalisés vs prévus."""
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id)\
                 .filter(models.Element.type_element == "Pieu")\
                 .all()

    realises = [e for e in elements if pieu_realise(e) and e.date_forage]
    if not realises:
        return []

    mois_data = {}
    for e in realises:
        key = get_mois_label(e.date_forage)
        mois_data[key] = mois_data.get(key, 0) + 1

    result = []
    cum = 0
    for key in sorted(mois_data.keys()):
        cum += mois_data[key]
        result.append({
            "mois":        key,
            "nb_realises": mois_data[key],
            "cumul":       cum,
            "avancement":  round(cum / len(elements) * 100, 1) if elements else 0,
        })
    return result

# ── 4. Récapitulatif par semelle ──────────────────────────────────
@router.get("/recap-semelles/{projet_id}")
def recap_semelles(
    projet_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    """Récapitulatif groupé par semelle avec pieux associés."""
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()

    # Grouper pieux par semelle_ref
    semelles_data = {}
    pieux_sans_semelle = []

    for e in elements:
        if type_val(e) != "Pieu":
            continue
        sem_ref = e.semelle_ref or "/"
        if sem_ref == "/" or not sem_ref:
            pieux_sans_semelle.append(e)
            continue
        if sem_ref not in semelles_data:
            semelles_data[sem_ref] = {
                "semelle_ref":   sem_ref,
                "nb_pieux":      0,
                "nb_realises":   0,
                "vol_budgetise": 0,
                "vol_fore":      0,
                "vol_recepé":    0,
                "pieux":         [],
            }
        d = semelles_data[sem_ref]
        d["nb_pieux"] += 1
        d["vol_budgetise"] += e.volume_budgetise or 0
        d["vol_fore"]      += e.volume_fore or 0
        d["vol_recepé"]    += e.volume_recepé or 0
        if pieu_realise(e):
            d["nb_realises"] += 1
        d["pieux"].append({
            "id":         e.id,
            "reference":  e.reference,
            "statut":     statut_val(e),
            "prof_roche": e.prof_roche,
            "volume_fore":e.volume_fore,
            "date_forage":e.date_forage.isoformat() if e.date_forage else None,
        })

    result = []
    for sem_ref, d in sorted(semelles_data.items()):
        d["vol_budgetise"] = round(d["vol_budgetise"], 3)
        d["vol_fore"]      = round(d["vol_fore"], 3)
        d["vol_recepé"]    = round(d["vol_recepé"], 3)
        d["avancement_pct"]= round(d["nb_realises"] / d["nb_pieux"] * 100, 1) if d["nb_pieux"] else 0
        result.append(d)

    return {
        "par_semelle": result,
        "sans_semelle": {
            "nb_pieux": len(pieux_sans_semelle),
            "nb_realises": sum(1 for e in pieux_sans_semelle if pieu_realise(e)),
        },
        "total_semelles": len(result),
    }

# ── 5. KPIs volumes ───────────────────────────────────────────────
@router.get("/courbe-volumes/{projet_id}")
def courbe_volumes(
    projet_id: int,
    granularite: str = Query("semaine", enum=["semaine", "mois", "date"]),
    type_element: Optional[str] = None,
    famille: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    q = db.query(models.Element)\
          .filter(models.Element.projet_id == projet_id)\
          .filter(models.Element.date_forage.isnot(None))
    if type_element:
        q = q.filter(models.Element.type_element == type_element)
    if famille:
        q = q.filter(models.Element.famille == famille)

    elements = q.order_by(models.Element.date_forage).all()
    if not elements:
        # Fallback sur mesures
        return courbe_volumes_mesures(projet_id, granularite, type_element, famille, db)

    buckets = {}
    for e in elements:
        dt = e.date_forage
        if granularite == "semaine":
            key = get_semaine_label(dt)
        elif granularite == "mois":
            key = get_mois_label(dt)
        else:
            key = dt.strftime("%d/%m/%Y")

        if key not in buckets:
            buckets[key] = {"periode": key, "volume_fore": 0, "volume_recepé": 0, "nb_elements": 0}
        buckets[key]["volume_fore"]   += e.volume_fore or 0
        buckets[key]["volume_recepé"] += e.volume_recepé or 0
        buckets[key]["nb_elements"]   += 1

    result = []
    cum_fore = cum_recep = 0
    for key in sorted(buckets.keys()):
        b = buckets[key]
        cum_fore  += b["volume_fore"]
        cum_recep += b["volume_recepé"]
        result.append({
            "periode":       key,
            "volume_fore":   round(b["volume_fore"], 3),
            "volume_recepé": round(b["volume_recepé"], 3),
            "cumul_fore":    round(cum_fore, 3),
            "cumul_recepé":  round(cum_recep, 3),
            "nb_elements":   b["nb_elements"],
        })
    return result

def courbe_volumes_mesures(projet_id, granularite, type_element, famille, db):
    """Fallback sur la table mesures si pas de date_forage sur les éléments."""
    q = db.query(models.MesureElement).join(models.Element)\
          .filter(models.Element.projet_id == projet_id)
    if type_element:
        q = q.filter(models.Element.type_element == type_element)
    if famille:
        q = q.filter(models.Element.famille == famille)

    mesures = q.order_by(models.MesureElement.date_mesure).all()
    if not mesures:
        return []

    buckets = {}
    for m in mesures:
        dt = m.date_mesure
        if granularite == "semaine":
            key = get_semaine_label(dt)
        elif granularite == "mois":
            key = get_mois_label(dt)
        else:
            key = dt.strftime("%d/%m/%Y")

        if key not in buckets:
            buckets[key] = {"periode": key, "volume_fore": 0, "volume_recepé": 0, "nb_elements": 0}
        buckets[key]["volume_fore"]   += m.volume_fore or 0
        buckets[key]["volume_recepé"] += m.volume_recepé or 0
        buckets[key]["nb_elements"]   += 1

    result = []
    cum_fore = cum_recep = 0
    for key in sorted(buckets.keys()):
        b = buckets[key]
        cum_fore  += b["volume_fore"]
        cum_recep += b["volume_recepé"]
        result.append({
            "periode":       key,
            "volume_fore":   round(b["volume_fore"], 3),
            "volume_recepé": round(b["volume_recepé"], 3),
            "cumul_fore":    round(cum_fore, 3),
            "cumul_recepé":  round(cum_recep, 3),
            "nb_elements":   b["nb_elements"],
        })
    return result

# ── 6. Volumes par famille ────────────────────────────────────────
@router.get("/volumes-par-famille/{projet_id}")
def volumes_par_famille(projet_id: int, db: Session = Depends(get_db),
                        _: models.User = Depends(get_current_user)):
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()

    familles = {}
    for e in elements:
        f = e.famille or "Sans famille"
        if f not in familles:
            familles[f] = {"famille": f, "nb_elements": 0, "nb_realises": 0,
                           "vol_budgetise": 0, "vol_fore": 0, "vol_recepé": 0}
        familles[f]["nb_elements"]   += 1
        familles[f]["vol_budgetise"] += e.volume_budgetise or 0
        familles[f]["vol_fore"]      += e.volume_fore or 0
        familles[f]["vol_recepé"]    += e.volume_recepé or 0
        if pieu_realise(e):
            familles[f]["nb_realises"] += 1

    result = []
    for f, d in sorted(familles.items()):
        d["vol_budgetise"]  = round(d["vol_budgetise"], 3)
        d["vol_fore"]       = round(d["vol_fore"], 3)
        d["vol_recepé"]     = round(d["vol_recepé"], 3)
        d["delta"]          = round(d["vol_fore"] - d["vol_budgetise"], 3)
        d["avancement_pct"] = round(d["nb_realises"] / d["nb_elements"] * 100, 1) if d["nb_elements"] else 0
        d["pct_fore"]       = round(d["vol_fore"] / d["vol_budgetise"] * 100, 1) if d["vol_budgetise"] else 0
        result.append(d)
    return result

# ── 7. Alertes ────────────────────────────────────────────────────
@router.get("/alertes/{projet_id}")
def get_alertes(projet_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    alertes = []
    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id).all()

    for e in elements:
        ref = e.reference
        val = e.statut_validation.value if hasattr(e.statut_validation,'value') else str(e.statut_validation)

        if val == 'en_revue' and e.updated_at:
            jours = (datetime.utcnow() - e.updated_at.replace(tzinfo=None)).days
            if jours >= 2:
                alertes.append({"type": "validation_tardive", "element_id": e.id,
                    "reference": ref, "message": f"{ref} en attente de validation depuis {jours}j",
                    "severite": "warning"})

        if e.volume_budgetise and e.volume_fore:
            delta_pct = (e.volume_fore - e.volume_budgetise) / e.volume_budgetise * 100
            if delta_pct > 15:
                alertes.append({"type": "depassement_volume", "element_id": e.id,
                    "reference": ref, "message": f"{ref} : dépassement volume +{delta_pct:.1f}%",
                    "severite": "danger"})

        ref_charge = e.charge_admissible_mesure or e.charge_admissible_calc
        if ref_charge and e.charge_appliquee and e.charge_appliquee > ref_charge:
            alertes.append({"type": "charge_depassee", "element_id": e.id,
                "reference": ref,
                "message": f"{ref} : charge ({e.charge_appliquee}kN) > admissible ({ref_charge}kN)",
                "severite": "danger"})

    return sorted(alertes, key=lambda x: ["danger","warning"].index(x["severite"]))

# ── 8. Recépage par élément ───────────────────────────────────────
@router.get("/recepage/{element_id}")
def suivi_recepage(element_id: int, db: Session = Depends(get_db),
                   _: models.User = Depends(get_current_user)):
    element = db.query(models.Element).filter(models.Element.id == element_id).first()
    if not element:
        return {"error": "Élément introuvable"}

    mesures = db.query(models.MesureElement)\
                .filter(models.MesureElement.element_id == element_id)\
                .order_by(models.MesureElement.date_mesure).all()

    progression = []
    for m in mesures:
        ecart = None
        cible = element.cote_recepee or element.cote_bs_theorique
        if m.cote_tete is not None and cible is not None:
            ecart = round(m.cote_tete - cible, 3)
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

    return {
        "element": {
            "id": element.id,
            "reference": element.reference,
            "cote_recepee": element.cote_recepee,
            "cote_plancher": element.cote_plancher,
            "prof_toit_rocheux": element.prof_toit_rocheux,
            "prof_roche": element.prof_roche,
            "ancrage": element.ancrage,
            "volume_fore": element.volume_fore,
        },
        "progression": progression,
    }
