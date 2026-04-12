"""
Migration v3.1 — Ajoute la colonne actif à la table users.
Lance avec : python migrate_actif.py
"""
import sqlite3, os

DB_PATH = "smc_v2.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"❌ Base '{DB_PATH}' introuvable.")
        return
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cur.fetchall()]
    if 'actif' not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN actif INTEGER NOT NULL DEFAULT 1")
        print("✓ Colonne users.actif ajoutée")
    else:
        print("— users.actif existe déjà")
    conn.commit(); conn.close()
    print("✅ Migration v3.1 terminée")

if __name__ == "__main__":
    migrate()