# SMC — Suivi Massifs & Chantier

> Application web de suivi de chantier de construction — React + FastAPI + PostgreSQL

[![Deploy SMC](https://github.com/dbranly/smc/actions/workflows/deploy.yml/badge.svg)](https://github.com/dbranly/smc/actions)

**🌐 Production** → [dbranly.github.io/smc](https://dbranly.github.io/smc)  
**📡 API** → [smc-cp8d.onrender.com](https://smc-cp8d.onrender.com)  
**📖 Swagger** → [smc-cp8d.onrender.com/docs](https://smc-cp8d.onrender.com/docs)

---

## Présentation

SMC permet à toutes les parties prenantes d'un chantier de collaborer sur une plateforme unique :

- Suivi des éléments structurels (pieux, semelles, poteaux, voiles, dalles…)
- Saisie des mesures topographiques et comparaison théorique / réel
- Workflow de validation : saisie → soumission → validation ou rejet
- Visualisation 3D interactive du bâtiment
- Génération de rapports PDF avec KPIs et signatures
- Import Excel / Export DXF

---

## Stack technique

| Couche | Technologie | Hébergement |
|--------|------------|-------------|
| Frontend | React 18 + Vite + Tailwind CSS | GitHub Pages |
| Backend | Python FastAPI 0.115 | Render.com (Free) |
| Base de données | PostgreSQL 15 (Supabase) | Supabase (Free) |
| Auth | JWT (python-jose + bcrypt) | — |
| ORM | SQLAlchemy 2.0 | — |

---

## Structure du projet

```
smc/
├── backend/
│   ├── main.py              # Point d'entrée FastAPI + CORS
│   ├── models.py            # Modèles SQLAlchemy (7 tables)
│   ├── schemas.py           # Schémas Pydantic
│   ├── auth.py              # JWT + hachage bcrypt
│   ├── database.py          # Connexion PostgreSQL / SQLite local
│   ├── requirements.txt     # Dépendances Python
│   └── routers/
│       ├── auth.py          # POST /api/auth/login
│       ├── projets.py       # CRUD /api/projets/
│       ├── elements.py      # CRUD + import Excel + export DXF
│       ├── mesures.py       # Relevés topographiques
│       ├── commentaires.py  # Commentaires par élément
│       ├── couches_geo.py   # Couches géologiques
│       ├── liaisons.py      # Liaisons pieu ↔ semelle ↔ poteau
│       ├── analytics.py     # KPIs + courbes d'avancement
│       ├── users.py         # Gestion utilisateurs
│       └── rapport.py       # Génération PDF ReportLab
├── frontend/
│   └── src/
│       ├── App.jsx          # HashRouter + routes protégées
│       ├── AuthContext.jsx  # Session JWT (clé: smc_token)
│       ├── ProjetContext.jsx# Projet actif global
│       ├── api.js           # Axios + interceptors JWT
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Fondations.jsx
│       │   ├── GrosOeuvre.jsx
│       │   ├── Maquette3D.jsx
│       │   └── Utilisateurs.jsx
│       └── components/
│           ├── Layout.jsx
│           ├── DetailTabs.jsx
│           ├── Vue3D.jsx
│           ├── PlanVue.jsx
│           └── ProtectedRoute.jsx
└── .github/workflows/
    └── deploy.yml           # CI/CD → GitHub Pages + Render auto-deploy
```

---

## Lancer en local

### Prérequis

- Python 3.10+
- Node.js 18+
- Git

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

API disponible sur `http://localhost:8001`  
Swagger : `http://localhost:8001/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App disponible sur `http://localhost:5173`

### Compte par défaut (local)

```
Email    : admin@smc.app
Password : ChangeMe2025!
```

> ⚠️ Changer ce mot de passe immédiatement après la première connexion.

---

## Déploiement

### Variables d'environnement (Render)

| Variable | Description                                                                |
|----------|----------------------------------------------------------------------------|
| `DATABASE_URL` | `postgresql+psycopg2://user:pass@host:6543/postgres?sslmode=require` |
| `SECRET_KEY` | Clé secrète JWT — générer avec Render (Generate Value)                 |

### CI/CD

Tout push sur `main` déclenche automatiquement :
1. **GitHub Actions** → `npm run build` → déploiement GitHub Pages (~2 min)
2. **Render auto-deploy** → `pip install` + redémarrage uvicorn (~3-5 min)

---

## Rôles et permissions

| Rôle         | Label            | Accès                                         |
|--------------|------------------|-----------------------------------------------|
| `chef`       | Chef de Mission  | Total — validation, utilisateurs, suppression |
| `suivi`      | Ingénieur Suivi  | Création, modification, soumission            |
| `topo`       | Ingénieur Topo   | Relevés et mesures topographiques             |
| `civil`      | Ingénieur Civil  | Éléments, liaisons, couches géologiques       |
| `moa`        | Maître d'Ouvrage | Lecture seule + commentaires                  |

---

## Import Excel

Format accepté pour l'import en masse d'éléments :

| Colonne               | Obligatoire | Description                                                          |
|-----------------------|-------------|----------------------------------------------------------------------|
| `reference`           | ✅         | Référence unique (ex: Pi.1)                                          |
| `type_element`        | ✅         | Pieu / Semelle / Poteau / Voile / Poutre / Dalle / Longrine / Radier |
| `lot`                 | ✅         | Fondations / Gros œuvre                                              |
| `famille`             | —          | Groupe (ex: F1, F2)                                                   |
| `cote_bs_theorique`   | —          | Cote tête (m NGF)                                                     |
| `cote_bi_theorique`   | —          | Cote pied (m NGF)                                                     |
| `diametre`            | —          | En mètres (ex: 0.80)                                                  |
| `volume_budgetise`    | —          | Volume béton (m³)                                                     |
| `coord_x` / `coord_y` | —          | Coordonnées NGF                                                       |
| `statut_element`      | —          | À faire (défaut)                                                      |

> Les templates Excel par type d'élément sont disponibles dans `/docs/templates/`.

---

## Notes développeur

- Utiliser **HashRouter** (pas BrowserRouter) — URLs avec `#` pour GitHub Pages
- Tous les appels API doivent avoir le préfixe `/api/` (ex: `api.get('/api/elements/')`)
- Le token JWT est stocké sous la clé `smc_token` dans localStorage
- En local : SQLite (`backend/smc_v2.db`) — En prod : PostgreSQL Supabase via `DATABASE_URL`
- Render Free : service en veille après 15 min d'inactivité — configurer UptimeRobot
- Supabase Free : base pausée après 1 semaine d'inactivité

---

## Projet

**Immeuble CNPS Warda** — SS R+18 — Yaoundé, Cameroun  
Marché N°24/M/CNPS/DG/CIPM-BEC/25 du 17 Janvier 2025  
136 pieux Ø800 · Familles F1 à F9

---

Développé par **Branly DJIME** — ESILV, Data & Intelligence Artificielle
