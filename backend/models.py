from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

# ── Enums ────────────────────────────────────────────────────────
class RoleEnum(str, enum.Enum):
    chef  = "chef"
    suivi = "suivi"
    topo  = "topo"
    civil = "civil"
    moa   = "moa"

class StatutEnum(str, enum.Enum):
    brouillon = "Brouillon"
    en_revue  = "En revue"
    valide    = "Validé"
    rejete    = "Rejeté"

class LotEnum(str, enum.Enum):
    fondations  = "Fondations"
    gros_oeuvre = "Gros œuvre"
    finitions   = "Finitions"

class TypeElementEnum(str, enum.Enum):
    pieu      = "Pieu"
    semelle   = "Semelle"
    poteau    = "Poteau"
    longrine  = "Longrine"
    radier    = "Radier"
    voile     = "Voile"
    poutre    = "Poutre"
    dalle     = "Dalle"
    escalier  = "Escalier"
    autre     = "Autre"

class StatutPieuEnum(str, enum.Enum):
    a_faire = "À faire"
    en_cours = "En cours"
    fore    = "Foré"
    recepé  = "Recépé"
    valide  = "Validé"

class TypeSolEnum(str, enum.Enum):
    argile          = "Argile"
    argile_molle    = "Argile molle"
    argile_dure     = "Argile dure"
    limon           = "Limon"
    sable_fin       = "Sable fin"
    sable_moyen     = "Sable moyen"
    sable_grossier  = "Sable grossier"
    gravier         = "Gravier"
    grave           = "Grave"
    roche_alteree   = "Roche altérée"
    roche_saine     = "Roche saine"
    remblai         = "Remblai"
    autre           = "Autre"

# ── Users ────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    nom             = Column(String, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(RoleEnum), nullable=False)
    actif           = Column(Boolean, default=True, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    commentaires    = relationship("Commentaire", back_populates="auteur")
    mesures         = relationship("MesureElement", back_populates="operateur")

# ── Projet ───────────────────────────────────────────────────────
class Projet(Base):
    __tablename__ = "projets"
    id          = Column(Integer, primary_key=True, index=True)
    nom         = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    localisation= Column(String, nullable=True)
    client      = Column(String, nullable=True)

    # Altitudes globales du site
    altitude_tn_global          = Column(Float, nullable=True)  # Terrain Naturel global (m NGF)
    altitude_plateforme_global  = Column(Float, nullable=True)  # Plateforme après décapage (m NGF)

    # Sol global
    type_sol_global     = Column(String, nullable=True)   # Description géologique globale
    rapport_sol         = Column(Text, nullable=True)     # Synthèse géotechnique

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    elements    = relationship("Element", back_populates="projet", cascade="all, delete")

# ── Element ──────────────────────────────────────────────────────
class Element(Base):
    __tablename__ = "elements"
    id               = Column(Integer, primary_key=True, index=True)
    projet_id        = Column(Integer, ForeignKey("projets.id"), nullable=False)
    reference        = Column(String, nullable=False)
    lot              = Column(Enum(LotEnum), nullable=False, default=LotEnum.fondations)
    type_element     = Column(Enum(TypeElementEnum), nullable=False)
    famille          = Column(String, nullable=True)

    # Géométrie
    coord_x          = Column(Float, nullable=True)
    coord_y          = Column(Float, nullable=True)
    coord_z          = Column(Float, nullable=True)
    diametre         = Column(Float, nullable=True)
    largeur          = Column(Float, nullable=True)
    longueur         = Column(Float, nullable=True)
    hauteur          = Column(Float, nullable=True)
    epaisseur        = Column(Float, nullable=True)

    # Cotes
    cote_bs_theorique   = Column(Float, nullable=True)
    cote_bs_reelle      = Column(Float, nullable=True)
    cote_bi_theorique   = Column(Float, nullable=True)
    cote_bi_reelle      = Column(Float, nullable=True)
    longueur_theorique  = Column(Float, nullable=True)
    longueur_reelle     = Column(Float, nullable=True)

    # ── NOUVEAUX : Altitudes TN / Plateforme ──────────────────────
    altitude_tn             = Column(Float, nullable=True)   # TN local (surcharge projet)
    altitude_plateforme     = Column(Float, nullable=True)   # Plateforme locale

    # ── NOUVEAUX : Sol simple ─────────────────────────────────────
    type_sol                = Column(String, nullable=True)  # Description libre
    description_sol         = Column(Text, nullable=True)    # Notes géotechniques

    # ── NOUVEAUX : Charges ────────────────────────────────────────
    charge_admissible_calc  = Column(Float, nullable=True)   # Calculée (kN)
    charge_admissible_mesure= Column(Float, nullable=True)   # Mesurée essai (kN)
    charge_appliquee        = Column(Float, nullable=True)   # Charge réelle (kN)

    # Volumes
    volume_budgetise = Column(Float, nullable=True)
    volume_fore      = Column(Float, nullable=True)
    volume_recepé    = Column(Float, nullable=True)
    volume_final     = Column(Float, nullable=True)

    # Matériaux
    materiau         = Column(String, nullable=True)
    armature         = Column(String, nullable=True)

    # Statuts
    statut_element   = Column(Enum(StatutPieuEnum), default=StatutPieuEnum.a_faire)
    statut_validation= Column(Enum(StatutEnum), default=StatutEnum.brouillon)
    commentaire_rejet= Column(Text, nullable=True)

    # Méta
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())
    createur_id  = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relations
    projet       = relationship("Projet", back_populates="elements")
    mesures      = relationship("MesureElement", back_populates="element", cascade="all, delete", order_by="MesureElement.date_mesure")
    commentaires = relationship("Commentaire", back_populates="element", cascade="all, delete")
    couches_geo  = relationship("CoucheGeo", back_populates="element", cascade="all, delete", order_by="CoucheGeo.profondeur_top")

    # Liaisons structurelles (en tant que pieu)
    liaisons_pieu    = relationship("LiaisonStructurelle", foreign_keys="LiaisonStructurelle.pieu_id",    back_populates="pieu",    cascade="all, delete")
    # Liaisons structurelles (en tant que semelle)
    liaisons_semelle = relationship("LiaisonStructurelle", foreign_keys="LiaisonStructurelle.semelle_id", back_populates="semelle", cascade="all, delete")
    # Liaisons structurelles (en tant que poteau)
    liaisons_poteau  = relationship("LiaisonStructurelle", foreign_keys="LiaisonStructurelle.poteau_id",  back_populates="poteau",  cascade="all, delete")

# ── CoucheGeo (sol détaillé par couche) ──────────────────────────
class CoucheGeo(Base):
    __tablename__ = "couches_geo"
    id               = Column(Integer, primary_key=True, index=True)
    element_id       = Column(Integer, ForeignKey("elements.id"), nullable=False)
    profondeur_top   = Column(Float, nullable=False)   # Cote haute (ex: -1.0 m)
    profondeur_bottom= Column(Float, nullable=False)   # Cote basse  (ex: -3.5 m)
    type_sol         = Column(String, nullable=False)  # Type de sol
    description      = Column(Text, nullable=True)     # Description libre
    resistance_spt   = Column(Float, nullable=True)    # Nombre de coups SPT
    cohesion_cu      = Column(Float, nullable=True)    # Cohésion non drainée (kPa)
    angle_frottement = Column(Float, nullable=True)    # Angle de frottement (°)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    element          = relationship("Element", back_populates="couches_geo")

# ── LiaisonStructurelle ───────────────────────────────────────────
class LiaisonStructurelle(Base):
    __tablename__ = "liaisons_structurelles"
    id          = Column(Integer, primary_key=True, index=True)
    pieu_id     = Column(Integer, ForeignKey("elements.id"), nullable=False)
    semelle_id  = Column(Integer, ForeignKey("elements.id"), nullable=False)
    poteau_id   = Column(Integer, ForeignKey("elements.id"), nullable=True)
    ordre       = Column(Integer, default=1)   # Position du pieu dans la semelle
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    pieu    = relationship("Element", foreign_keys=[pieu_id],    back_populates="liaisons_pieu")
    semelle = relationship("Element", foreign_keys=[semelle_id], back_populates="liaisons_semelle")
    poteau  = relationship("Element", foreign_keys=[poteau_id],  back_populates="liaisons_poteau")

    __table_args__ = (
        UniqueConstraint("pieu_id", "semelle_id", name="uq_pieu_semelle"),
    )

# ── MesureElement ────────────────────────────────────────────────
class MesureElement(Base):
    __tablename__ = "mesures_elements"
    id                = Column(Integer, primary_key=True, index=True)
    element_id        = Column(Integer, ForeignKey("elements.id"), nullable=False)
    operateur_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    date_mesure       = Column(DateTime(timezone=True), nullable=False)
    phase             = Column(String, nullable=True)
    cote_tete         = Column(Float, nullable=True)
    cote_pied         = Column(Float, nullable=True)
    longueur_mesuree  = Column(Float, nullable=True)
    volume_fore       = Column(Float, nullable=True)
    volume_recepé     = Column(Float, nullable=True)
    volume_net        = Column(Float, nullable=True)
    commentaire       = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    element           = relationship("Element", back_populates="mesures")
    operateur         = relationship("User", back_populates="mesures")

# ── Commentaire ──────────────────────────────────────────────────
class Commentaire(Base):
    __tablename__ = "commentaires"
    id          = Column(Integer, primary_key=True, index=True)
    element_id  = Column(Integer, ForeignKey("elements.id"), nullable=False)
    auteur_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    texte       = Column(Text, nullable=False)
    parent_id   = Column(Integer, ForeignKey("commentaires.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    element     = relationship("Element", back_populates="commentaires")
    auteur      = relationship("User", back_populates="commentaires")