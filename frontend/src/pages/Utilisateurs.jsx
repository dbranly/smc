import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../AuthContext'

const ROLES = ['chef', 'suivi', 'topo', 'civil', 'moa']
const ROLE_LABEL = {
  chef:  'Chef de Mission', suivi: 'Ing. Suivi',
  topo:  'Ing. Topo',       civil: 'Ing. Civil', moa: "Maître d'Ouvrage",
}
const ROLE_BADGE = {
  chef:  'bg-orange-100 text-orange-700',
  suivi: 'bg-teal-100 text-teal-700',
  topo:  'bg-blue-100 text-blue-700',
  civil: 'bg-green-100 text-green-700',
  moa:   'bg-purple-100 text-purple-700',
}

const EMPTY_FORM = { nom: '', email: '', password: '', role: 'suivi' }

function UserModal({ onClose, onSave, initial = null }) {
  const [form, setForm]   = useState(initial || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const isEdit = !!initial

  const handle = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom complet *</label>
            <input required value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {isEdit ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}
            </label>
            <input type="password" required={!isEdit} value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder={isEdit ? '••••••••' : 'Minimum 6 caractères'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rôle *</label>
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le compte'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Utilisateurs() {
  const { user: me } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [search, setSearch]         = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users/')
      setUsers(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (form) => {
    await api.post('/users/', form)
    load()
  }

  const handleUpdate = async (form) => {
    const payload = { ...form }
    if (!payload.password) delete payload.password
    await api.put(`/users/${editUser.id}`, payload)
    load()
  }

  const handleToggleActif = async (user) => {
    await api.put(`/users/${user.id}`, { actif: !user.actif })
    load()
  }

  const handleDelete = async () => {
    await api.delete(`/users/${confirmDel.id}`)
    setConfirmDel(null); load()
  }

  const filtered = users.filter(u =>
    !search ||
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const actifs   = users.filter(u => u.actif).length
  const inactifs = users.filter(u => !u.actif).length

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Utilisateurs</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {actifs} actif{actifs > 1 ? 's' : ''}
            {inactifs > 0 && ` · ${inactifs} désactivé${inactifs > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors">
          + Nouveau compte
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-4">
        <input type="text" placeholder="Rechercher par nom ou email…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-slate-400 text-sm text-center py-12">Chargement…</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-100">
              <tr>
                {['Utilisateur','Rôle','Statut','Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} className={`border-b border-slate-50 last:border-0 ${!u.actif ? 'opacity-50' : ''}`}>
                  {/* Utilisateur */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0
                        ${u.actif ? 'bg-slate-700' : 'bg-slate-300'}`}>
                        {u.nom.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                          {u.nom}
                          {u.id === me?.id && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">vous</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Rôle */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  {/* Statut */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${u.actif ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className={`text-xs ${u.actif ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {u.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Depuis {new Date(u.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditUser(u)}
                        className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 text-xs rounded-lg transition-colors">
                        ✏️ Modifier
                      </button>
                      {u.id !== me?.id && (
                        <>
                          <button onClick={() => handleToggleActif(u)}
                            className={`px-3 py-1.5 border text-xs rounded-lg transition-colors ${
                              u.actif
                                ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}>
                            {u.actif ? '⏸ Désactiver' : '▶ Activer'}
                          </button>
                          <button onClick={() => setConfirmDel(u)}
                            className="px-3 py-1.5 border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs rounded-lg transition-colors">
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-sm">
                  Aucun utilisateur trouvé
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende rôles */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Permissions par rôle</div>
        <div className="grid grid-cols-5 gap-3">
          {[
            { role: 'chef',  perms: ['Tout faire', 'Valider', 'Gérer users', 'Supprimer'] },
            { role: 'suivi', perms: ['Créer éléments', 'Modifier', 'Soumettre', 'Commenter'] },
            { role: 'topo',  perms: ['Ajouter relevés', 'Mesures', 'Consulter', 'Commenter'] },
            { role: 'civil', perms: ['Modifier éléments', 'Liaisons', 'Sol', 'Commenter'] },
            { role: 'moa',   perms: ['Consulter', 'Commenter', 'Voir rapports'] },
          ].map(({ role, perms }) => (
            <div key={role} className="space-y-1.5">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[role]}`}>
                {ROLE_LABEL[role]}
              </span>
              <ul className="space-y-0.5">
                {perms.map(p => (
                  <li key={p} className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="text-slate-300">·</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <UserModal onClose={() => setShowCreate(false)} onSave={handleCreate} />
      )}
      {editUser && (
        <UserModal
          onClose={() => setEditUser(null)}
          onSave={handleUpdate}
          initial={{ nom: editUser.nom, email: editUser.email, password: '', role: editUser.role }}
        />
      )}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Supprimer ce compte ?</h2>
            <p className="text-sm text-slate-500 mb-5">
              Le compte de <strong>{confirmDel.nom}</strong> sera définitivement supprimé.
            </p>
            <div className="flex gap-2">
              <button onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm">
                Supprimer
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}