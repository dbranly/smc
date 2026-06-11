import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useProjet } from '../ProjetContext'
import { useTheme, THEMES } from '../ThemeContext'

const ROLE_BADGE = {
  chef:  'bg-orange-100 text-orange-700',
  suivi: 'bg-teal-100 text-teal-700',
  topo:  'bg-blue-100 text-blue-700',
  civil: 'bg-green-100 text-green-700',
  moa:   'bg-purple-100 text-purple-700',
}
const ROLE_LABEL = {
  chef: 'Chef de Mission', suivi: 'Ing. Suivi',
  topo: 'Ing. Topo', civil: 'Ing. Civil', moa: "Maître d'Ouvrage",
}
const LOTS = [
  { to: '/fondations',  label: 'Fondations',  icon: '⬡', active: true  },
  { to: '/gros-oeuvre', label: 'Gros œuvre',  icon: '▣', active: true  },
  { to: '/finitions',   label: 'Finitions',   icon: '◈', active: false },
  { to: '/maquette-3d', label: 'Maquette 3D', icon: '◉', active: true  },
]

function ProjetModal({ onClose, onSave, initial = null }) {
  const [form, setForm] = useState(initial || { nom: '', description: '', localisation: '', client: '' })
  const [saving, setSaving] = useState(false)
  const handle = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="themed-card rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {initial ? 'Modifier le projet' : 'Nouveau projet'}
          </h2>
          <button onClick={onClose} className="themed-muted hover:opacity-70 text-xl transition-opacity">×</button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          {[
            { key: 'nom', label: 'Nom du projet *', required: true, placeholder: 'Immeuble CNPS Yaoundé' },
            { key: 'client', label: 'Client', placeholder: 'Nom du client' },
            { key: 'localisation', label: 'Localisation', placeholder: 'Ville, Pays' },
          ].map(({ key, label, required, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium themed-secondary mb-1">{label}</label>
              <input required={required} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="themed-input w-full px-3 py-2 border rounded-lg text-sm transition-all"
                placeholder={placeholder} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium themed-secondary mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="themed-input w-full px-3 py-2 border rounded-lg text-sm resize-none transition-all"
              placeholder="Description…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="themed-btn-primary flex-1 font-medium py-2.5 rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50">
              {saving ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Créer'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm themed-hover cursor-pointer transition-all"
              style={{ background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const current = THEMES.find(t => t.id === theme)

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all themed-hover cursor-pointer"
        title="Changer le thème">
        <span className="text-base">{current?.icon}</span>
        <div className="flex-1 text-left">
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{current?.label}</div>
          <div className="text-xs themed-muted">{current?.desc}</div>
        </div>
        <span className="themed-muted text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 themed-card border rounded-xl shadow-lg z-50 overflow-hidden p-1">
          {THEMES.map(t => (
            <button key={t.id} onClick={() => { setTheme(t.id); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${theme === t.id ? 'themed-active' : 'themed-hover'}`}>
              <span className="text-base">{t.icon}</span>
              <div>
                <div className="text-xs font-semibold" style={{ color: theme === t.id ? 'var(--text-active)' : 'var(--text-primary)' }}>
                  {t.label}
                </div>
                <div className="text-xs opacity-60">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout, canEdit, isChef } = useAuth()
  const { projets, projetActif, selectProjet, createProjet, updateProjet, deleteProjet } = useProjet()
  const navigate = useNavigate()
  const [showDrop, setShowDrop]     = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-app)' }}>

      {/* Sidebar */}
      <aside className="w-60 flex flex-col flex-shrink-0 themed-sidebar border-r">

        {/* Logo */}
        <div className="px-5 py-4 themed-border border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center themed-btn-primary">
              <span className="font-bold text-sm">S</span>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SMC</div>
              <div className="text-xs themed-muted">Suivi de chantier</div>
            </div>
          </div>
        </div>

        {/* Sélecteur projet */}
        <div className="px-3 py-3 themed-border border-b">
          <div className="text-xs font-medium themed-muted uppercase tracking-wider mb-2 px-1">Projet actif</div>
          <div className="relative">
            <button onClick={() => setShowDrop(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 themed-input themed-hover border rounded-lg text-left transition-all cursor-pointer">
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
              <span className="themed-muted text-xs ml-1 flex-shrink-0">▾</span>
            </button>

            {showDrop && (
              <div className="absolute top-full left-0 right-0 mt-1 themed-card border rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  {projets.map(p => (
                    <button key={p.id} onClick={() => { selectProjet(p); setShowDrop(false) }}
                      className={`w-full px-3 py-2.5 text-left transition-all cursor-pointer themed-border border-b last:border-0 ${projetActif?.id === p.id ? '' : 'themed-hover'}`}
                      style={projetActif?.id === p.id ? { background: 'var(--accent-soft)' } : {}}>
                      <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.nom}</div>
                      {p.localisation && <div className="text-xs themed-muted truncate">{p.localisation}</div>}
                      {p.client && <div className="text-xs themed-muted truncate opacity-60">{p.client}</div>}
                    </button>
                  ))}
                  {projets.length === 0 && <div className="px-3 py-3 text-xs themed-muted text-center">Aucun projet</div>}
                </div>
                {canEdit && (
                  <div className="themed-border border-t">
                    <button onClick={() => { setShowCreate(true); setShowDrop(false) }}
                      className="w-full px-3 py-2.5 text-left text-xs font-medium themed-accent themed-hover flex items-center gap-2 cursor-pointer transition-all">
                      <span className="text-sm">+</span> Nouveau projet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {projetActif && canEdit && (
            <div className="flex gap-1 mt-2">
              <button onClick={() => setShowEdit(true)}
                className="flex-1 px-2 py-1 text-xs themed-secondary themed-hover rounded-lg transition-all cursor-pointer">
                ✏️ Modifier
              </button>
              {isChef && (
                <button onClick={() => setConfirmDel(true)}
                  className="flex-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                  🗑️ Suppr.
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nav principale */}
        <nav className="px-3 pt-3 pb-1">
          <NavLink to="/" end className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${isActive ? 'themed-active font-medium' : 'themed-secondary themed-hover'}`}>
            <span>▦</span> Dashboard
          </NavLink>
        </nav>

        <div className="px-4 pt-3 pb-1">
          <div className="text-xs font-medium themed-muted uppercase tracking-wider">Lots</div>
        </div>
        <nav className="px-3 pb-3 space-y-0.5 flex-1">
          {LOTS.map(({ to, label, icon, active }) => active ? (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${isActive ? 'themed-active font-medium' : 'themed-secondary themed-hover'}`}>
              <span>{icon}</span> {label}
            </NavLink>
          ) : (
            <div key={to} className="flex items-center gap-2.5 px-3 py-2 text-sm themed-muted cursor-not-allowed">
              <span>{icon}</span> <span>{label}</span>
              <span className="ml-auto text-xs px-1.5 py-0.5 rounded themed-muted" style={{ background: 'var(--bg-badge)' }}>bientôt</span>
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="px-4 py-4 themed-border border-t space-y-2">

          {/* Sélecteur thème */}
          <ThemeSelector />

          <div className="themed-border border-t pt-2">
            <div className="text-sm font-medium truncate mb-1" style={{ color: 'var(--text-primary)' }}>{user?.nom}</div>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[user?.role]}`}>
              {ROLE_LABEL[user?.role]}
            </span>
            {isChef && (
              <NavLink to="/utilisateurs"
                className={({ isActive }) =>
                  `mt-2 flex items-center gap-1.5 text-xs transition-all cursor-pointer ${isActive ? 'font-medium' : 'themed-muted hover:opacity-80'}`
                }
                style={({ isActive }) => ({ color: isActive ? 'var(--text-primary)' : undefined })}>
                <span>👥</span> Gérer les utilisateurs
              </NavLink>
            )}
            <button onClick={() => { logout(); navigate('/login') }}
              className="mt-2 w-full text-left text-xs themed-muted hover:opacity-80 transition-opacity cursor-pointer">
              Se déconnecter →
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto"><Outlet /></main>

      {/* Modals */}
      {showCreate && <ProjetModal onClose={() => setShowCreate(false)} onSave={async (d) => { await createProjet(d); setShowCreate(false) }} />}
      {showEdit && projetActif && (
        <ProjetModal onClose={() => setShowEdit(false)}
          onSave={async (d) => { await updateProjet(projetActif.id, d); setShowEdit(false) }}
          initial={{ nom: projetActif.nom, description: projetActif.description || '', localisation: projetActif.localisation || '', client: projetActif.client || '' }} />
      )}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="themed-card rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Supprimer le projet ?</h2>
            <p className="text-sm themed-secondary mb-5">
              <strong>{projetActif?.nom}</strong> et tous ses éléments seront supprimés. Action irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteProjet(projetActif.id); setConfirmDel(false) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition-all cursor-pointer">
                Supprimer
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="flex-1 rounded-lg text-sm cursor-pointer themed-hover transition-all"
                style={{ background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      {showDrop && <div className="fixed inset-0 z-40" onClick={() => setShowDrop(false)} />}
    </div>
  )
}
