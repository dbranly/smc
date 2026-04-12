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
    coord_x: Optional[float] = None
    coord_y: Optional[float] = None
    coord_z: Optional[float] = None
    diametre: Optional[float] = None
    largeur: Optional[float] = None
    longueur: Optional[float] = None
    hauteur: Optional[float] = None
    epaisseur: Optional[float] = None
    cote_bs_theorique: Optional[float] = None
    cote_bs_reelle: Optional[float] = None
    cote_bi_theorique: Optional[float] = None
    cote_bi_reelle: Optional[float] = None
    longueur_theorique: Optional[float] = None
    longueur_reelle: Optional[float] = None
    # Nouveaux
    altitude_tn: Optional[float] = None
    altitude_plateforme: Optional[float] = None
    type_sol: Optional[str] = None
    description_sol: Optional[str] = None
    charge_admissible_calc: Optional[float] = None
    charge_admissible_mesure: Optional[float] = None
    charge_appliquee: Optional[float] = None
    # Volumes
    volume_budgetise: Optional[float] = None
    volume_fore: Optional[float] = None
    volume_recepé: Optional[float] = None
    volume_final: Optional[float] = None
    materiau: Optional[str] = None
    armature: Optional[str] = None
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
    coord_x: Optional[float]
    coord_y: Optional[float]
    coord_z: Optional[float]
    diametre: Optional[float]
    largeur: Optional[float]
    longueur: Optional[float]
    hauteur: Optional[float]
    epaisseur: Optional[float]
    cote_bs_theorique: Optional[float]
    cote_bs_reelle: Optional[float]
    cote_bi_theorique: Optional[float]
    cote_bi_reelle: Optional[float]
    longueur_theorique: Optional[float]
    longueur_reelle: Optional[float]
    altitude_tn: Optional[float]
    altitude_plateforme: Optional[float]
    type_sol: Optional[str]
    description_sol: Optional[str]
    charge_admissible_calc: Optional[float]
    charge_admissible_mesure: Optional[float]
    charge_appliquee: Optional[float]
    volume_budgetise: Optional[float]
    volume_fore: Optional[float]
    volume_recepé: Optional[float]
    volume_final: Optional[float]
    materiau: Optional[str]
    armature: Optional[str]
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