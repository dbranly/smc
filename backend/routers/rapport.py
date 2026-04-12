from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from datetime import datetime

from database import get_db
import models
from auth import get_current_user

router = APIRouter()

# ── Couleurs SMC ─────────────────────────────────────────────────
SLATE_900 = (0.059, 0.086, 0.122)
SLATE_700 = (0.220, 0.271, 0.341)
SLATE_500 = (0.388, 0.459, 0.537)
SLATE_200 = (0.882, 0.906, 0.929)
SLATE_50  = (0.980, 0.984, 0.988)
WHITE     = (1, 1, 1)
BLUE_600  = (0.149, 0.361, 0.863)
EMERALD   = (0.063, 0.725, 0.506)
AMBER     = (0.961, 0.620, 0.043)
RED_500   = (0.937, 0.267, 0.267)
TEAL      = (0.059, 0.463, 0.431)

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))

FAM_COLORS = {
    'F1': hex_to_rgb('6366f1'), 'F2': hex_to_rgb('ec4899'),
    'F3': hex_to_rgb('f97316'), 'F4': hex_to_rgb('14b8a6'),
    'F5': hex_to_rgb('8b5cf6'), 'F6': hex_to_rgb('ef4444'),
}

STATUT_COLORS = {
    'À faire': SLATE_500, 'En cours': BLUE_600, 'Foré': AMBER,
    'Recépé': EMERALD, 'Validé': (0.086, 0.627, 0.173),
    'Coulé': AMBER, 'Décoffré': EMERALD,
}

# ── Helpers canvas ────────────────────────────────────────────────
def set_color(c, rgb, alpha=1):
    c.setFillColorRGB(*rgb, alpha=alpha)

def set_stroke(c, rgb, alpha=1):
    c.setStrokeColorRGB(*rgb, alpha=alpha)

def draw_rect(c, x, y, w, h, fill=None, stroke=None, radius=3):
    if fill:    set_color(c, fill)
    if stroke:  set_stroke(c, stroke)
    if radius:
        c.roundRect(x, y, w, h, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)
    else:
        c.rect(x, y, w, h, fill=1 if fill else 0, stroke=1 if stroke else 0)

def text(c, x, y, s, size=9, bold=False, color=SLATE_700, align='left'):
    set_color(c, color)
    c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    if align == 'center': c.drawCentredString(x, y, str(s))
    elif align == 'right': c.drawRightString(x, y, str(s))
    else: c.drawString(x, y, str(s))

def header_bar(c, w, h, projet, page_num):
    """Barre header en haut de chaque page"""
    draw_rect(c, 0, h-45, w, 45, fill=SLATE_900)
    text(c, 30, h-18, 'SMC', size=12, bold=True, color=WHITE)
    text(c, 30, h-30, 'Suivi Massifs & Chantier', size=7, color=SLATE_200)
    text(c, w/2, h-20, projet.nom, size=10, bold=True, color=WHITE, align='center')
    if projet.client:
        text(c, w/2, h-32, projet.client, size=7, color=SLATE_200, align='center')
    text(c, w-30, h-18, f'Page {page_num}', size=8, color=SLATE_200, align='right')
    text(c, w-30, h-30, datetime.now().strftime('%d/%m/%Y'), size=7, color=SLATE_500, align='right')

def footer(c, w):
    set_stroke(c, SLATE_200)
    c.setLineWidth(0.5)
    c.line(30, 25, w-30, 25)
    text(c, 30, 12, 'SMC — Suivi Massifs & Chantier — Document confidentiel', size=7, color=SLATE_500)
    text(c, w-30, 12, f'Généré le {datetime.now().strftime("%d/%m/%Y à %H:%M")}', size=7, color=SLATE_500, align='right')

def section_title(c, x, y, w, title, color=SLATE_900):
    draw_rect(c, x, y-2, w, 18, fill=SLATE_50)
    set_stroke(c, SLATE_200)
    c.setLineWidth(0.5)
    c.rect(x, y-2, w, 18, fill=0, stroke=1)
    text(c, x+8, y+5, title.upper(), size=8, bold=True, color=color)
    return y - 26

def badge(c, x, y, label, bg, fg=WHITE, w=None):
    tw = c.stringWidth(label, 'Helvetica-Bold', 7)
    bw = w or (tw + 10)
    draw_rect(c, x, y-2, bw, 14, fill=bg, radius=3)
    text(c, x + bw/2, y+3, label, size=7, bold=True, color=fg, align='center')
    return bw + 4

def kpi_box(c, x, y, w, h, label, value, sub=None, color=BLUE_600):
    draw_rect(c, x, y, w, h, fill=WHITE)
    set_stroke(c, SLATE_200)
    c.setLineWidth(0.5)
    c.rect(x, y, w, h, fill=0, stroke=1)
    text(c, x+8, y+h-14, label, size=7, bold=False, color=SLATE_500)
    text(c, x+8, y+h-32, str(value), size=16, bold=True, color=color)
    if sub: text(c, x+8, y+8, str(sub), size=7, color=SLATE_500)

def progress_bar(c, x, y, w, h, pct, color=BLUE_600, bg=SLATE_200):
    draw_rect(c, x, y, w, h, fill=bg, radius=2)
    if pct > 0:
        draw_rect(c, x, y, max(w * min(pct/100, 1), 2), h, fill=color, radius=2)

# ── Génération du rapport ─────────────────────────────────────────
def generate_pdf(projet, elements, mesures, kpis, par_famille) -> BytesIO:
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import A4

    buf = BytesIO()
    W, H = A4  # 595 × 842 pt
    c = rl_canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Rapport SMC — {projet.nom}")
    c.setAuthor("SMC — Suivi Massifs & Chantier")

    page = [1]

    def new_page():
        c.showPage()
        page[0] += 1
        header_bar(c, W, H, projet, page[0])
        footer(c, W)
        return H - 65

    # ── PAGE 1 : Couverture + KPIs ────────────────────────────────
    # Fond slate
    draw_rect(c, 0, H-180, W, 180, fill=SLATE_900)

    # Logo SMC
    draw_rect(c, 30, H-80, 50, 50, fill=BLUE_600, radius=8)
    text(c, 55, H-48, 'SMC', size=20, bold=True, color=WHITE, align='center')

    # Titre projet
    text(c, 100, H-55, projet.nom, size=18, bold=True, color=WHITE)
    text(c, 100, H-72, 'RAPPORT DE SUIVI DE CHANTIER', size=9, color=SLATE_200)
    if projet.client:
        text(c, 100, H-88, f'Client : {projet.client}', size=9, color=SLATE_500)
    if projet.localisation:
        text(c, 100, H-101, f'Localisation : {projet.localisation}', size=9, color=SLATE_500)

    # Bandeau infos
    draw_rect(c, 0, H-180, W, 46, fill=SLATE_700)
    infos = [
        ('Date du rapport', datetime.now().strftime('%d/%m/%Y')),
        ('Éléments total', str(len(elements))),
        ('Avancement', f"{kpis.get('avancement_global', 0)}%"),
        ('Volume budgétisé', f"{kpis.get('volumes', {}).get('budgetise', 0)} m³"),
    ]
    bw = W / len(infos)
    for i, (lbl, val) in enumerate(infos):
        text(c, 30 + i*bw, H-150, lbl, size=7, color=SLATE_200)
        text(c, 30 + i*bw, H-163, val, size=11, bold=True, color=WHITE)

    footer(c, W)

    y = H - 200

    # ── KPIs ────────────────────────────────────────────────────────
    y = section_title(c, 30, y, W-60, 'Indicateurs clés')
    kw = (W - 70) / 4
    vol = kpis.get('volumes', {})
    kpi_items = [
        ('Éléments total',     len(elements),                          None, SLATE_900),
        ('Volume foré',        f"{vol.get('fore', 0)} m³",             f"Budgétisé : {vol.get('budgetise', 0)} m³", BLUE_600),
        ('Volume recépé',      f"{vol.get('recepé', 0)} m³",           f"Taux : {vol.get('taux_recepage', 0)}%", EMERALD),
        ('Avancement global',  f"{kpis.get('avancement_global', 0)}%", 'Pondéré par statut', BLUE_600),
    ]
    for i, (lbl, val, sub, col) in enumerate(kpi_items):
        kpi_box(c, 30 + i*(kw+2.5), y-58, kw, 58, lbl, val, sub, col)
    y -= 70

    # ── STATUTS ────────────────────────────────────────────────────
    y = section_title(c, 30, y-10, W-60, 'Avancement par statut')
    par_statut = kpis.get('par_statut', {})
    total = len(elements)
    col_w = (W-60) / max(len(par_statut), 1)
    for i, (statut, count) in enumerate(par_statut.items()):
        pct = round(count/total*100) if total else 0
        sx  = 30 + i * col_w
        text(c, sx, y-8, statut, size=7, color=SLATE_700)
        text(c, sx, y-20, f'{count}', size=13, bold=True, color=STATUT_COLORS.get(statut, SLATE_700))
        text(c, sx, y-30, f'{pct}%', size=7, color=SLATE_500)
        progress_bar(c, sx, y-44, col_w-10, 6, pct, STATUT_COLORS.get(statut, SLATE_200))
    y -= 58

    # ── ALERTES ─────────────────────────────────────────────────────
    alertes = []
    for e in elements:
        if e.volume_budgetise and e.volume_fore:
            delta = (e.volume_fore - e.volume_budgetise) / e.volume_budgetise * 100
            if delta > 15:
                alertes.append(('⚠', f'{e.reference} : dépassement volume +{delta:.0f}%', RED_500))
        ref_charge = e.charge_admissible_mesure or e.charge_admissible_calc
        if ref_charge and e.charge_appliquee and e.charge_appliquee > ref_charge:
            alertes.append(('⚠', f'{e.reference} : charge appliquée dépasse l\'admissible', RED_500))

    if alertes:
        y = section_title(c, 30, y-10, W-60, f'Alertes ({len(alertes)})', color=RED_500)
        for (icon, msg, col) in alertes[:6]:
            draw_rect(c, 30, y-14, W-60, 14, fill=(1, 0.95, 0.95), radius=2)
            text(c, 38, y-8, f'{icon} {msg}', size=7.5, color=col)
            y -= 18

    # ── PAGE 2 : Tableau par famille ─────────────────────────────
    y = new_page()
    y = section_title(c, 30, y, W-60, 'Récapitulatif par famille / bloc')

    # En-têtes tableau
    cols = [('Famille', 50), ('Bloc', 120), ('Éléments', 55), ('Validés', 50),
            ('Vol. budg.', 70), ('Vol. foré', 65), ('Delta', 55), ('% Foré', 55)]
    tx = 30
    draw_rect(c, 30, y-16, W-60, 16, fill=SLATE_900)
    for col, cw in cols:
        text(c, tx+3, y-10, col, size=7, bold=True, color=WHITE)
        tx += cw
    y -= 16

    # Lignes
    for i, f in enumerate(par_famille):
        row_h = 16
        bg = SLATE_50 if i % 2 == 0 else WHITE
        draw_rect(c, 30, y-row_h, W-60, row_h, fill=bg, radius=0)
        set_stroke(c, SLATE_200); c.setLineWidth(0.3)
        c.rect(30, y-row_h, W-60, row_h, fill=0, stroke=1)

        fam   = f['famille']
        fcolor = FAM_COLORS.get(fam, SLATE_500)
        tx = 30
        # Famille avec pastille
        draw_rect(c, tx+3, y-row_h+4, 8, 8, fill=fcolor, radius=2)
        text(c, tx+14, y-row_h+6, fam, size=8, bold=True, color=SLATE_900)
        tx += 50
        text(c, tx+3, y-row_h+6, f['bloc'][:22], size=7, color=SLATE_700); tx += 120
        text(c, tx+3, y-row_h+6, str(f['nb_total']), size=8, color=SLATE_700, align='left'); tx += 55
        text(c, tx+3, y-row_h+6, str(f['nb_valides']), size=8, color=EMERALD); tx += 50
        text(c, tx+3, y-row_h+6, f"{f['vol_budgetise']} m³", size=7, color=SLATE_700); tx += 70
        text(c, tx+3, y-row_h+6, f"{f['vol_fore']} m³", size=7, color=BLUE_600); tx += 65
        delta_col = RED_500 if f['delta'] > 0 else EMERALD
        delta_txt = f"+{f['delta']}" if f['delta'] >= 0 else str(f['delta'])
        text(c, tx+3, y-row_h+6, delta_txt, size=7, color=delta_col); tx += 55
        text(c, tx+3, y-row_h+6, f"{f['pct_fore']}%", size=7, color=BLUE_600)
        y -= row_h
        if y < 80:
            y = new_page()

    # ── PAGE 3 : Liste éléments ───────────────────────────────────
    y = new_page()
    y = section_title(c, 30, y, W-60, 'Liste des éléments')

    # En-tête
    hdrs = [('Référence', 65), ('Type', 55), ('Famille', 45), ('BS th.', 45),
            ('BI th.', 45), ('Vol. budg.', 60), ('Vol. foré', 55), ('Statut', 75)]
    tx = 30
    draw_rect(c, 30, y-14, W-60, 14, fill=SLATE_900)
    for col, cw in hdrs:
        text(c, tx+3, y-9, col, size=6.5, bold=True, color=WHITE)
        tx += cw
    y -= 14

    for i, e in enumerate(elements):
        if y < 60:
            y = new_page()
            y = section_title(c, 30, y, W-60, f'Liste des éléments (suite)')
            tx2 = 30
            draw_rect(c, 30, y-14, W-60, 14, fill=SLATE_900)
            for col, cw in hdrs:
                text(c, tx2+3, y-9, col, size=6.5, bold=True, color=WHITE)
                tx2 += cw
            y -= 14

        rh = 13
        bg = SLATE_50 if i % 2 == 0 else WHITE
        draw_rect(c, 30, y-rh, W-60, rh, fill=bg, radius=0)
        set_stroke(c, SLATE_200); c.setLineWidth(0.2)
        c.rect(30, y-rh, W-60, rh, fill=0, stroke=1)

        statut = e.statut_element.value if hasattr(e.statut_element, 'value') else str(e.statut_element)
        type_e = e.type_element.value if hasattr(e.type_element, 'value') else str(e.type_element)

        vals = [
            (e.reference, 65, True, SLATE_900),
            (type_e, 55, False, SLATE_700),
            (e.famille or '—', 45, False, SLATE_500),
            (str(e.cote_bs_theorique) if e.cote_bs_theorique is not None else '—', 45, False, SLATE_700),
            (str(e.cote_bi_theorique) if e.cote_bi_theorique is not None else '—', 45, False, SLATE_700),
            (f"{e.volume_budgetise} m³" if e.volume_budgetise else '—', 60, False, SLATE_700),
            (f"{e.volume_fore} m³" if e.volume_fore else '—', 55, False, BLUE_600),
            (statut, 75, False, STATUT_COLORS.get(statut, SLATE_500)),
        ]
        tx = 30
        for val, cw, bold, col in vals:
            text(c, tx+3, y-rh+4, str(val)[:12], size=6.5, bold=bold, color=col)
            tx += cw
        y -= rh

    # ── PAGE FINALE : Signature ───────────────────────────────────
    y = new_page()
    y = section_title(c, 30, y, W-60, 'Visa et signatures')

    boxes = [
        ('Établi par', 'Ingénieur Suivi de Chantier'),
        ('Vérifié par', 'Chef de Mission'),
        ("Approuvé par", "Maître d'Ouvrage"),
    ]
    bw = (W-70) / 3
    for i, (title, role) in enumerate(boxes):
        bx = 30 + i*(bw+5)
        draw_rect(c, bx, y-90, bw, 90, fill=WHITE)
        set_stroke(c, SLATE_200); c.setLineWidth(0.5)
        c.rect(bx, y-90, bw, 90, fill=0, stroke=1)
        text(c, bx+bw/2, y-16, title, size=8, bold=True, color=SLATE_900, align='center')
        text(c, bx+bw/2, y-28, role, size=7, color=SLATE_500, align='center')
        set_stroke(c, SLATE_200); c.setLineWidth(0.3)
        c.line(bx+15, y-70, bx+bw-15, y-70)
        text(c, bx+bw/2, y-82, 'Signature & cachet', size=6.5, color=SLATE_500, align='center')

    c.save()
    buf.seek(0)
    return buf

# ── Endpoint ──────────────────────────────────────────────────────
@router.get("/{projet_id}")
def download_rapport(projet_id: int, db: Session = Depends(get_db),
                     _: models.User = Depends(get_current_user)):
    projet = db.query(models.Projet).filter(models.Projet.id == projet_id).first()
    if not projet: raise HTTPException(status_code=404, detail="Projet introuvable")

    elements = db.query(models.Element)\
                 .filter(models.Element.projet_id == projet_id)\
                 .order_by(models.Element.famille, models.Element.reference).all()

    mesures = db.query(models.MesureElement).join(models.Element)\
                .filter(models.Element.projet_id == projet_id).all()

    # KPIs
    total   = len(elements)
    vol_b   = sum(e.volume_budgetise or 0 for e in elements)
    vol_f   = sum(e.volume_fore or 0 for e in elements)
    vol_r   = sum(e.volume_recepé or 0 for e in elements)
    par_stat= {}
    for e in elements:
        k = e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element)
        par_stat[k] = par_stat.get(k,0) + 1
    poids = {'À faire':0,'En cours':0.25,'Foré':0.6,'Recépé':0.85,'Validé':1.0,'Coulé':0.6,'Décoffré':0.85}
    avancement = round(sum(poids.get(e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element),0) for e in elements)/max(total,1)*100,1)

    kpis = {
        "total": total, "avancement_global": avancement,
        "par_statut": par_stat,
        "volumes": {
            "budgetise": round(vol_b,2), "fore": round(vol_f,2),
            "recepé": round(vol_r,2),
            "taux_recepage": round(vol_r/vol_f*100,1) if vol_f else 0,
        }
    }

    # Par famille
    familles = {}
    for e in elements:
        f = e.famille or "—"
        if f not in familles:
            familles[f] = {"famille":f,"bloc":getattr(e,'bloc',''),"nb_total":0,"nb_valides":0,
                           "vol_budgetise":0,"vol_fore":0,"vol_recepé":0}
        familles[f]["nb_total"]     += 1
        familles[f]["vol_budgetise"]+= e.volume_budgetise or 0
        familles[f]["vol_fore"]     += e.volume_fore or 0
        familles[f]["vol_recepé"]   += e.volume_recepé or 0
        if (e.statut_element.value if hasattr(e.statut_element,'value') else str(e.statut_element)) == 'Validé':
            familles[f]["nb_valides"] += 1

    par_famille = []
    for f, d in sorted(familles.items()):
        d["vol_budgetise"] = round(d["vol_budgetise"],2)
        d["vol_fore"]      = round(d["vol_fore"],2)
        d["vol_recepé"]    = round(d["vol_recepé"],2)
        d["delta"]         = round(d["vol_fore"]-d["vol_budgetise"],2)
        d["pct_fore"]      = round(d["vol_fore"]/d["vol_budgetise"]*100,1) if d["vol_budgetise"] else 0
        par_famille.append(d)

    buf = generate_pdf(projet, elements, mesures, kpis, par_famille)
    nom = projet.nom.replace(' ','_').replace('/','_')
    date = datetime.now().strftime('%Y%m%d')

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rapport_SMC_{nom}_{date}.pdf"}
    )