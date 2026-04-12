import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useProjet } from '../ProjetContext'

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{initial ? 'Modifier le projet' : 'Nouveau projet'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom du projet *</label>
            <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="Immeuble CNPS Yaoundé" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
            <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="Nom du client" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Localisation</label>
            <input value={form.localisation} onChange={e => setForm(f => ({ ...f, localisation: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="Ville, Pays" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" placeholder="Description…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium py-2.5 rounded-lg text-sm">
              {saving ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout, canEdit, isChef } = useAuth()
  const { projets, projetActif, selectProjet, createProjet, updateProjet, deleteProjet } = useProjet()
  const navigate = useNavigate()
  const [showDrop, setShowDrop]         = useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [showEdit, setShowEdit]         = useState(false)
  const [confirmDel, setConfirmDel]     = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">SMC</div>
              <div className="text-xs text-slate-400">Suivi de chantier</div>
            </div>
          </div>
        </div>

        {/* Sélecteur projet */}
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-1">Projet actif</div>
          <div className="relative">
            <button onClick={() => setShowDrop(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors">
              <div className="min-w-0 flex-1">
                {projetActif ? (
                  <>
                    <div className="text-xs font-semibold text-slate-800 truncate">{projetActif.nom}</div>
                    {projetActif.localisation && <div className="text-xs text-slate-400 truncate">{projetActif.localisation}</div>}
                  </>
                ) : (
                  <div className="text-xs text-slate-400">Aucun projet</div>
                )}
              </div>
              <span className="text-slate-400 text-xs ml-1 flex-shrink-0">▾</span>
            </button>

            {showDrop && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  {projets.map(p => (
                    <button key={p.id} onClick={() => { selectProjet(p); setShowDrop(false) }}
                      className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors ${projetActif?.id === p.id ? 'bg-blue-50' : ''}`}>
                      <div className="text-xs font-semibold text-slate-800 truncate">{p.nom}</div>
                      {p.localisation && <div className="text-xs text-slate-400 truncate">{p.localisation}</div>}
                      {p.client && <div className="text-xs text-slate-300 truncate">{p.client}</div>}
                    </button>
                  ))}
                  {projets.length === 0 && <div className="px-3 py-3 text-xs text-slate-400 text-center">Aucun projet</div>}
                </div>
                {canEdit && (
                  <div className="border-t border-slate-100">
                    <button onClick={() => { setShowCreate(true); setShowDrop(false) }}
                      className="w-full px-3 py-2.5 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2">
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
                className="flex-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                ✏️ Modifier
              </button>
              {isChef && (
                <button onClick={() => setConfirmDel(true)}
                  className="flex-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  🗑️ Suppr.
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="px-3 pt-3 pb-1">
          <NavLink to="/" end className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-slate-800 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
            <span>▦</span> Dashboard
          </NavLink>
        </nav>

        <div className="px-4 pt-3 pb-1">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Lots</div>
        </div>
        <nav className="px-3 pb-3 space-y-0.5 flex-1">
          {LOTS.map(({ to, label, icon, active }) => active ? (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-slate-800 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
              <span>{icon}</span> {label}
            </NavLink>
          ) : (
            <div key={to} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 cursor-not-allowed">
              <span>{icon}</span> <span>{label}</span>
              <span className="ml-auto text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">bientôt</span>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="text-sm font-medium text-slate-800 truncate mb-1">{user?.nom}</div>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[user?.role]}`}>
            {ROLE_LABEL[user?.role]}
          </span>
          {isChef && (
            <NavLink to="/utilisateurs"
              className={({ isActive }) =>
                `mt-2 flex items-center gap-1.5 text-xs transition-colors ${isActive ? 'text-slate-800 font-medium' : 'text-slate-400 hover:text-slate-600'}`
              }>
              <span>👥</span> Gérer les utilisateurs
            </NavLink>
          )}
          <button onClick={() => { logout(); navigate('/login') }}
            className="mt-2 w-full text-left text-xs text-slate-400 hover:text-slate-600">
            Se déconnecter →
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto"><Outlet /></main>

      {showCreate && <ProjetModal onClose={() => setShowCreate(false)} onSave={async (d) => { await createProjet(d); setShowCreate(false) }} />}
      {showEdit && projetActif && (
        <ProjetModal onClose={() => setShowEdit(false)} onSave={async (d) => { await updateProjet(projetActif.id, d); setShowEdit(false) }}
          initial={{ nom: projetActif.nom, description: projetActif.description || '', localisation: projetActif.localisation || '', client: projetActif.client || '' }} />
      )}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Supprimer le projet ?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <strong>{projetActif?.nom}</strong> et tous ses éléments seront supprimés. Action irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteProjet(projetActif.id); setConfirmDel(false) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm">Supprimer</button>
              <button onClick={() => setConfirmDel(false)} className="flex-1 bg-slate-100 text-slate-700 rounded-lg text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}
      {showDrop && <div className="fixed inset-0 z-40" onClick={() => setShowDrop(false)} />}
    </div>
  )
}