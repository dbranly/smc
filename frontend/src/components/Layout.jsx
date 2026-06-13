import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useProjet } from '../ProjetContext'
import { useTheme, THEMES } from '../ThemeContext'

const ROLE_BADGE = {
  chef:  'tag-orange',
  suivi: 'tag-teal',
  topo:  'tag-blue',
  civil: 'tag-green',
  moa:   'tag-purple',
}
const ROLE_LABEL = {
  chef: 'Chef de Mission', suivi: 'Ing. Suivi',
  topo: 'Ing. Topo', civil: 'Ing. Civil', moa: "Maître d'Ouvrage",
}

const NAV = [
  { to: '/',            label: 'Dashboard',   icon: '◫', color: 'blue',   end: true,  active: true },
  { to: '/fondations',  label: 'Fondations',  icon: '⬡', color: 'orange', active: true },
  { to: '/gros-oeuvre', label: 'Gros œuvre',  icon: '▣', color: 'purple', active: true },
  { to: '/finitions',   label: 'Finitions',   icon: '◈', color: 'teal',   active: false },
  { to: '/maquette-3d', label: 'Maquette 3D', icon: '◉', color: 'green',  active: true },
]

function ProjetModal({ onClose, onSave, initial = null }) {
  const [form, setForm] = useState(initial || { nom: '', description: '', localisation: '', client: '' })
  const [saving, setSaving] = useState(false)
  const handle = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="themed-card rounded-2xl shadow-themed-lg w-full max-w-md p-6 border">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {initial ? 'Modifier le projet' : 'Nouveau projet'}
          </h2>
          <button onClick={onClose} className="themed-muted hover:opacity-70 text-xl transition-opacity cursor-pointer">×</button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          {[
            { key: 'nom', label: 'Nom du projet *', required: true, placeholder: 'Immeuble CNPS Yaoundé' },
            { key: 'client', label: 'Client', placeholder: 'Nom du client' },
            { key: 'localisation', label: 'Localisation', placeholder: 'Ville, Pays' },
          ].map(({ key, label, required, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium themed-secondary mb-1.5">{label}</label>
              <input required={required} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="themed-input w-full px-3.5 py-2.5 border rounded-xl text-sm transition-all"
                placeholder={placeholder} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium themed-secondary mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="themed-input w-full px-3.5 py-2.5 border rounded-xl text-sm resize-none transition-all"
              placeholder="Description…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="themed-btn-primary flex-1 font-semibold py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50">
              {saving ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Créer'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm themed-hover cursor-pointer transition-all"
              style={{ background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ThemeDots() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="flex items-center gap-1.5 px-1">
      {THEMES.map(t => (
        <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
          className="w-5 h-5 rounded-full border-2 transition-all cursor-pointer flex-shrink-0"
          style={{
            background: t.id === 'slate' ? '#f8fafc' : t.id === 'stone' ? '#fafaf9' : '#0b1120',
            borderColor: theme === t.id ? 'var(--accent)' : 'var(--border)',
            transform: theme === t.id ? 'scale(1.15)' : 'scale(1)',
          }} />
      ))}
    </div>
  )
}

export default function Layout() {
  const { user, logout, canEdit, isChef } = useAuth()
  const { projets, projetActif, selectProjet, createProjet, updateProjet, deleteProjet } = useProjet()
  const navigate = useNavigate()
  const [showDrop, setShowDrop]     = useState(false)
  const [showUser, setShowUser]     = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-app)' }}>

      {/* TOPBAR */}
      <header className="themed-topbar border-b flex items-center gap-4 px-4 h-14 flex-shrink-0 z-30">

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center themed-btn-primary font-bold text-sm">S</div>
          <span className="text-sm font-bold tracking-tight hidden sm:inline" style={{ color: 'var(--text-primary)' }}>SMC</span>
        </div>

        <div className="w-px h-6 themed-border border-r flex-shrink-0" />

        <div className="relative flex-1 max-w-xs">
          <button onClick={() => setShowDrop(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl themed-hover transition-all cursor-pointer text-left">
            <span className="text-base flex-shrink-0">📁</span>
            <div className="min-w-0 flex-1">
              {projetActif ? (
                <>
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{projetActif.nom}</div>
                  {projetActif.localisation && <div className="text-xs themed-muted truncate">{projetActif.localisation}</div>}
                </>
              ) : (
                <div className="text-xs themed-muted">Aucun projet</div>
              )}
            </div>
            <span className="themed-muted text-xs flex-shrink-0">▾</span>
          </button>

          {showDrop && (
            <div className="absolute top-full left-0 mt-1.5 themed-card border rounded-2xl shadow-themed-lg z-50 overflow-hidden w-72">
              <div className="max-h-64 overflow-y-auto p-1.5">
                {projets.map(p => (
                  <button key={p.id} onClick={() => { selectProjet(p); setShowDrop(false) }}
                    className={`w-full px-3 py-2.5 text-left transition-all cursor-pointer rounded-xl ${projetActif?.id === p.id ? '' : 'themed-hover'}`}
                    style={projetActif?.id === p.id ? { background: 'var(--accent-soft)' } : {}}>
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.nom}</div>
                    {p.localisation && <div className="text-xs themed-muted truncate">{p.localisation}</div>}
                    {p.client && <div className="text-xs themed-muted truncate opacity-60">{p.client}</div>}
                  </button>
                ))}
                {projets.length === 0 && <div className="px-3 py-3 text-xs themed-muted text-center">Aucun projet</div>}
              </div>

              {projetActif && canEdit && (
                <div className="px-1.5 pb-1.5 flex gap-1">
                  <button onClick={() => { setShowEdit(true); setShowDrop(false) }}
                    className="flex-1 px-2 py-1.5 text-xs themed-secondary themed-hover rounded-xl transition-all cursor-pointer">
                    ✏️ Modifier
                  </button>
                  {isChef && (
                    <button onClick={() => { setConfirmDel(true); setShowDrop(false) }}
                      className="flex-1 px-2 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                      🗑 Supprimer
                    </button>
                  )}
                </div>
              )}

              {canEdit && (
                <div className="themed-border border-t p-1.5">
                  <button onClick={() => { setShowCreate(true); setShowDrop(false) }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                    style={{ background: 'var(--accent-soft)', color: 'var(--text-accent)' }}>
                    <span className="text-sm">+</span> Nouveau projet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <ThemeDots />

        <div className="w-px h-6 themed-border border-r flex-shrink-0" />

        <div className="relative flex-shrink-0">
          <button onClick={() => setShowUser(v => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl themed-hover transition-all cursor-pointer">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--text-accent)' }}>
              {user?.nom?.charAt(0)?.toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold truncate max-w-24" style={{ color: 'var(--text-primary)' }}>{user?.nom}</div>
            </div>
            <span className="themed-muted text-xs hidden md:inline">▾</span>
          </button>

          {showUser && (
            <div className="absolute top-full right-0 mt-1.5 themed-card border rounded-2xl shadow-themed-lg z-50 overflow-hidden w-56 p-1.5">
              <div className="px-3 py-2.5">
                <div className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--text-primary)' }}>{user?.nom}</div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user?.role]}`}>
                  {ROLE_LABEL[user?.role]}
                </span>
              </div>
              {isChef && (
                <NavLink to="/utilisateurs" onClick={() => setShowUser(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs themed-secondary themed-hover rounded-xl transition-all cursor-pointer">
                  <span>👥</span> Gérer les utilisateurs
                </NavLink>
              )}
              <button onClick={() => { logout(); navigate('/login') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs themed-muted hover:opacity-80 rounded-xl transition-all cursor-pointer text-left">
                <span>↪</span> Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">

        <aside className="w-56 flex flex-col flex-shrink-0 themed-sidebar border-r p-3 gap-1">
          {NAV.map(({ to, label, icon, color, end, active }) => active === false ? (
            <div key={to} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm themed-muted cursor-not-allowed">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 tag-${color}`}>{icon}</span>
              <span>{label}</span>
              <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full themed-muted" style={{ background: 'var(--bg-badge)' }}>bientôt</span>
            </div>
          ) : (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${isActive ? 'shadow-themed' : 'themed-hover themed-secondary'}`
              }
              style={({ isActive }) => isActive ? { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' } : {}}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 tag-${color}`}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="flex-1" />

          {projetActif && (
            <div className="px-3 py-3 rounded-xl text-xs" style={{ background: 'var(--bg-hover)' }}>
              <div className="themed-muted uppercase tracking-wide font-semibold mb-1" style={{ fontSize: '10px' }}>Projet actif</div>
              <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{projetActif.nom}</div>
              {projetActif.client && <div className="themed-muted truncate mt-0.5">{projetActif.client}</div>}
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>

      {showCreate && <ProjetModal onClose={() => setShowCreate(false)} onSave={async (d) => { await createProjet(d); setShowCreate(false) }} />}
      {showEdit && projetActif && (
        <ProjetModal onClose={() => setShowEdit(false)}
          onSave={async (d) => { await updateProjet(projetActif.id, d); setShowEdit(false) }}
          initial={{ nom: projetActif.nom, description: projetActif.description || '', localisation: projetActif.localisation || '', client: projetActif.client || '' }} />
      )}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="themed-card rounded-2xl shadow-themed-lg w-full max-w-sm p-6 border">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Supprimer le projet ?</h2>
            <p className="text-sm themed-secondary mb-5">
              <strong>{projetActif?.nom}</strong> et tous ses éléments seront supprimés. Action irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteProjet(projetActif.id); setConfirmDel(false) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all cursor-pointer">
                Supprimer
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="flex-1 rounded-xl text-sm cursor-pointer themed-hover transition-all"
                style={{ background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      {(showDrop || showUser) && <div className="fixed inset-0 z-40" onClick={() => { setShowDrop(false); setShowUser(false) }} />}
    </div>
  )
}
