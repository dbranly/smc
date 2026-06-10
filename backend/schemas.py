from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models import RoleEnum, StatutEnum, LotEnum, TypeElementEnum, StatutPieuEnum

# ── Auth ─────────────────────────────────────────────────────────
class LoginForm(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    nom: str
    email: str
    password: str
    role: RoleEnum

class UserUpdate(BaseModel):
    nom: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[RoleEnum] = None
    actif: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    nom: str
    email: str
    role: RoleEnum
    actif: bool = True
    created_at: datetime
    class Config: from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# ── Projet ───────────────────────────────────────────────────────
class ProjetCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    localisation: Optional[str] = None
    client: Optional[str] = None
    altitude_tn_global: Optional[float] = None
    altitude_plateforme_global: Optional[float] = None
    type_sol_global: Optional[str] = None
    rapport_sol: Optional[str] = None

class ProjetOut(BaseModel):
    id: int
    nom: str
    description: Optional[str]
    localisation: Optional[str]
    client: Optional[str]
    altitude_tn_global: Optional[float]
    altitude_plateforme_global: Optional[float]
    type_sol_global: Optional[str]
    rapport_sol: Optional[str]
    created_at: datetime
    class Config: from_attributes = True

# ── Element ──────────────────────────────────────────────────────
class ElementCreate(BaseModel):
    projet_id: int
    reference: str
    lot: LotEnum = LotEnum.fondations
    type_element: TypeElementEnum
    famille: Optional[str] = None

    # Coordonnées théoriques (plan)
    coord_x: Optional[float] = None
    coord_y: Optional[float] = None
    coord_z: Optional[float] = None

    # Coordonnées virole (réelles mesurées)
    coord_virole_x: Optional[float] = None   # VIROLE_X
    coord_virole_y: Optional[float] = None   # VIROLE_Y
    coord_virole_z: Optional[float] = None   # VIROLE_Z

    # Terrain naturel
    altitude_tn: Optional[float] = None      # TN altitude

    # Cotes
    cote_plancher: Optional[float] = None    # COTE_PLANCHER
    cote_recepee: Optional[float] = None     # COTE_RECEPEE
    cote_bs_theorique: Optional[float] = None
    cote_bs_reelle: Optional[float] = None
    cote_bi_theorique: Optional[float] = None
    cote_bi_reelle: Optional[float] = None

    # Profondeurs rocher
    prof_toit_rocheux: Optional[float] = None  # PROF_TOIT_ROCHEUX
    prof_roche: Optional[float] = None          # PROF_ROCHE
    ancrage: Optional[float] = None             # ANCRAGE

    # Dimensions
    diametre: Optional[float] = None
    largeur: Optional[float] = None
    longueur: Optional[float] = None
    hauteur: Optional[float] = None
    epaisseur: Optional[float] = None
    longueur_theorique: Optional[float] = None
    longueur_reelle: Optional[float] = None

    # Volumes
    volume_budgetise: Optional[float] = None
    volume_fore: Optional[float] = None        # VOLUME_BETON
    volume_recepé: Optional[float] = None
    volume_final: Optional[float] = None

    # Sol
    altitude_plateforme: Optional[float] = None
    type_sol: Optional[str] = None
    description_sol: Optional[str] = None

    # Charges
    charge_admissible_calc: Optional[float] = None
    charge_admissible_mesure: Optional[float] = None
    charge_appliquee: Optional[float] = None

    # Matériaux
    materiau: Optional[str] = None
    armature: Optional[str] = None

    # Liaisons
    semelle_ref: Optional[str] = None   # SEMELLE
    poteau_ref: Optional[str] = None    # POTEAU

    # Date forage
    date_forage: Optional[datetime] = None  # DATE

    statut_element: Optional[StatutPieuEnum] = StatutPieuEnum.a_faire

class ElementUpdate(ElementCreate):
    projet_id: Optional[int] = None
    reference: Optional[str] = None
    lot: Optional[LotEnum] = None
    type_element: Optional[TypeElementEnum] = None

class ElementOut(BaseModel):
    id: int
    projet_id: int
    reference: str
    lot: LotEnum
    type_element: TypeElementEnum
    famille: Optional[str]

    # Coordonnées
    coord_x: Optional[float]
    coord_y: Optional[float]
    coord_z: Optional[float]
    coord_virole_x: Optional[float]
    coord_virole_y: Optional[float]
    coord_virole_z: Optional[float]
    altitude_tn: Optional[float]

    # Cotes
    cote_plancher: Optional[float]
    cote_recepee: Optional[float]
    cote_bs_theorique: Optional[float]
    cote_bs_reelle: Optional[float]
    cote_bi_theorique: Optional[float]
    cote_bi_reelle: Optional[float]

    # Profondeurs
    prof_toit_rocheux: Optional[float]
    prof_roche: Optional[float]
    ancrage: Optional[float]

    # Dimensions
    diametre: Optional[float]
    largeur: Optional[float]
    longueur: Optional[float]
    hauteur: Optional[float]
    epaisseur: Optional[float]
    longueur_theorique: Optional[float]
    longueur_reelle: Optional[float]

    # Volumes
    volume_budgetise: Optional[float]
    volume_fore: Optional[float]
    volume_recepé: Optional[float]
    volume_final: Optional[float]

    # Sol
    altitude_plateforme: Optional[float]
    type_sol: Optional[str]
    description_sol: Optional[str]

    # Charges
    charge_admissible_calc: Optional[float]
    charge_admissible_mesure: Optional[float]
    charge_appliquee: Optional[float]

    # Matériaux
    materiau: Optional[str]
    armature: Optional[str]

    # Liaisons
    semelle_ref: Optional[str]
    poteau_ref: Optional[str]

    # Date forage
    date_forage: Optional[datetime]

    # Statuts
    statut_element: StatutPieuEnum
    statut_validation: StatutEnum
    commentaire_rejet: Optional[str]

    created_at: datetime
    updated_at: Optional[datetime]
    class Config: from_attributes = True

class ValidationAction(BaseModel):
    action: str
    commentaire: Optional[str] = None

# ── CoucheGeo ────────────────────────────────────────────────────
class CoucheGeoCreate(BaseModel):
    element_id: int
    profondeur_top: float
    profondeur_bottom: float
    type_sol: str
    description: Optional[str] = None
    resistance_spt: Optional[float] = None
    cohesion_cu: Optional[float] = None
    angle_frottement: Optional[float] = None

class CoucheGeoOut(BaseModel):
    id: int
    element_id: int
    profondeur_top: float
    profondeur_bottom: float
    type_sol: str
    description: Optional[str]
    resistance_spt: Optional[float]
    cohesion_cu: Optional[float]
    angle_frottement: Optional[float]
    created_at: datetime
    class Config: from_attributes = True

# ── LiaisonStructurelle ──────────────────────────────────────────
class LiaisonCreate(BaseModel):
    pieu_id: int
    semelle_id: int
    poteau_id: Optional[int] = None
    ordre: Optional[int] = 1

class LiaisonOut(BaseModel):
    id: int
    pieu_id: int
    semelle_id: int
    poteau_id: Optional[int]
    ordre: int
    created_at: datetime
    pieu: Optional[ElementOut]
    semelle: Optional[ElementOut]
    poteau: Optional[ElementOut]
    class Config: from_attributes = True

# ── MesureElement ────────────────────────────────────────────────
class MesureCreate(BaseModel):
    element_id: int
    date_mesure: datetime
    phase: Optional[str] = None
    cote_tete: Optional[float] = None
    cote_pied: Optional[float] = None
    longueur_mesuree: Optional[float] = None
    volume_fore: Optional[float] = None
    volume_recepé: Optional[float] = None
    volume_net: Optional[float] = None
    commentaire: Optional[str] = None

class MesureOut(BaseModel):
    id: int
    element_id: int
    date_mesure: datetime
    phase: Optional[str]
    cote_tete: Optional[float]
    cote_pied: Optional[float]
    longueur_mesuree: Optional[float]
    volume_fore: Optional[float]
    volume_recepé: Optional[float]
    volume_net: Optional[float]
    commentaire: Optional[str]
    created_at: datetime
    operateur: Optional[UserOut]
    class Config: from_attributes = True

# ── Commentaire ──────────────────────────────────────────────────
class CommentaireCreate(BaseModel):
    element_id: int
    texte: str
    parent_id: Optional[int] = None

class CommentaireOut(BaseModel):
    id: int
    element_id: int
    texte: str
    parent_id: Optional[int]
    created_at: datetime
    auteur: UserOut
    class Config: from_attributes = True

Token.model_rebuild()
