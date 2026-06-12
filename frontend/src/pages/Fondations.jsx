import { useEffect, useState, useRef } from 'react'
import api from '../api'
import { useAuth } from '../AuthContext'
import { useProjet } from '../ProjetContext'
import PlanVue from '../components/PlanVue'
import DetailTabs from '../components/DetailTabs'

const TYPES = ['Pieu','Semelle','Poteau','Longrine','Radier','Voile','Poutre','Dalle','Escalier','Autre']
const STATUTS = ['À faire','En cours','Foré','Recépé','Validé']

const STATUT_DOT = {
  'À faire':  '#cbd5e1',
  'En cours': '#60a5fa',
  'Foré':     '#f97316',
  'Recépé':   '#a855f7',
  'Validé':   '#22c55e',
  'Coulé':    '#fbbf24',
  'Décoffré': '#34d399',
}

function StatusBadge({ statut }) {
  const color = STATUT_DOT[statut] || '#94a3b8'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: color + '22', color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {statut}
    </span>
  )
}

const EMPTY_FORM = {
  reference: '', type_element: 'Pieu',
  coord_x: '', coord_y: '', diametre: '800',
  cote_bs_theorique: '', cote_bi_theorique: '',
  volume_budgetise: '', materiau: 'Béton C30/37', armature: '500A/B',
}

export default function Fondations() {
  const { canEdit, isChef } = useAuth()
  const { projetActif } = useProjet()
  const [elements, setElements]     = useState([])
  const [extraElements, setExtra]   = useState([])
  const [selected, setSelected]     = useState(null)
  const [mesures, setMesures]       = useState([])
  const [comments, setComments]     = useState([])
  const [editing, setEditing]       = useState(false)
  const [editVals, setEditVals]     = useState({})
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState('liste')
  const [filter, setFilter]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [colorBy, setColorBy]       = useState('statut')
  const [showForm, setShowForm]     = useState(false)
  const [newForm, setNewForm]       = useState(EMPTY_FORM)
  const [importing, setImporting]   = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [showRejet, setShowRejet]   = useState(false)
  const [rejetMsg, setRejetMsg]     = useState('')
  const [showMesureForm, setShowMesureForm] = useState(false)
  const [mesureForm, setMesureForm] = useState({ date_mesure: '', phase: '', cote_tete: '', cote_pied: '', volume_fore: '', commentaire: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    if (!projetActif) return
    setLoading(true)
    try {
      const [fond, autres] = await Promise.all([
        api.get(`/api/elements/?projet_id=${projetActif.id}&lot=Fondations`),
        api.get(`/api/elements/?projet_id=${projetActif.id}`),
      ])
      setElements(fond.data)
      setExtra(autres.data.filter(e => e.lot !== 'Fondations'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projetActif?.id])

  const selectElement = async (e) => {
    setSelected(e); setEditing(false); setEditVals({})
    const [m, c] = await Promise.all([
      api.get(`/api/mesures/?element_id=${e.id}`),
      api.get(`/api/commentaires/?element_id=${e.id}`),
    ])
    setMesures(m.data); setComments(c.data)
  }

  const startEdit = () => { setEditing(true); setEditVals({ ...selected }) }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await api.put(`/api/elements/${selected.id}`, editVals)
      setSelected(res.data)
      setElements(prev => prev.map(e => e.id === res.data.id ? res.data : e))
      setEditing(false); setEditVals({})
    } finally { setSaving(false) }
  }

  const handleCreate = async (ev) => {
    ev.preventDefault()
    const payload = { projet_id: projetActif.id, lot: 'Fondations' }
    Object.entries(newForm).forEach(([k, v]) => { if (v !== '') payload[k] = isNaN(v) || k === 'reference' || k === 'materiau' || k === 'armature' || k === 'type_element' ? v : Number(v) })
    await api.post('/api/elements/', payload)
    setShowForm(false); setNewForm(EMPTY_FORM); load()
  }

  const handleDelete = async (id) => {
    await api.delete(`/api/elements/${id}`)
    setConfirmDelete(null)
    if (selected?.id === id) { setSelected(null); setEditing(false) }
    load()
  }

  const handleImport = async (ev) => {
    const f = ev.target.files[0]; if (!f) return
    setImporting(true); setImportResult(null)
    const fd = new FormData(); fd.append('file', f)
    try {
      const res = await api.post(`/api/elements/import/excel?projet_id=${projetActif.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult({ success: true, ...res.data }); load()
    } catch { setImportResult({ success: false, message: 'Erreur lors de l\'import' }) }
    finally { setImporting(false); ev.target.value = '' }
  }

  const handleDownloadTemplate = async () => {
    const res = await api.get('/api/elements/export/template-excel', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a'); a.href = url; a.download = 'template_pieux.xlsx'; a.click()
  }

  const handleExportDXF = async () => {
    const res = await api.get(`/api/elements/export/dxf/${projetActif.id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a'); a.href = url; a.download = `smc_${projetActif.id}.dxf`; a.click()
  }

  const handleSoumettre = async () => {
    const res = await api.post(`/api/elements/${selected.id}/soumettre`)
    setSelected(res.data); setElements(p => p.map(e => e.id === res.data.id ? res.data : e))
  }
  const handleValider = async () => {
    const res = await api.post(`/api/elements/${selected.id}/valider`, { action: 'valider' })
    setSelected(res.data); setElements(p => p.map(e => e.id === res.data.id ? res.data : e))
  }
  const handleRejeter = async () => {
    if (!rejetMsg) return
    const res = await api.post(`/api/elements/${selected.id}/valider`, { action: 'rejeter', commentaire: rejetMsg })
    setSelected(res.data); setElements(p => p.map(e => e.id === res.data.id ? res.data : e))
    setShowRejet(false); setRejetMsg('')
  }
  const handleComment = async () => {
    if (!newComment.trim()) return
    await api.post('/api/commentaires/', { element_id: selected.id, texte: newComment })
    setNewComment('')
    const res = await api.get(`/api/commentaires/?element_id=${selected.id}`)
    setComments(res.data)
  }
  const handleAddMesure = async (e) => {
    e.preventDefault()
    const payload = { element_id: selected.id }
    Object.entries(mesureForm).forEach(([k, v]) => { if (v !== '') payload[k] = k === 'date_mesure' || k === 'phase' || k === 'commentaire' ? v : Number(v) })
    await api.post('/api/mesures/', payload)
    setShowMesureForm(false)
    const res = await api.get(`/api/mesures/?element_id=${selected.id}`)
    setMesures(res.data)
  }

  const filtered = elements.filter(e => {
    if (typeFilter && e.type_element !== typeFilter) return false
    if (statutFilter && e.statut_element !== statutFilter) return false
    if (filter && !e.reference.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  if (!projetActif) return (
    <div className="flex items-center justify-center h-full themed-muted text-sm">
      Sélectionnez un projet
    </div>
  )

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-app)' }}>

      {/* ── GAUCHE ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="themed-card themed-border border-b px-5 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: 'var(--bg-sidebar)' }}>
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Fondations</h1>
            <p className="text-xs themed-muted">{projetActif.nom} · {elements.length} éléments</p>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Filtres */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="themed-input px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer">
              <option value="">Tous types</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
              className="themed-input px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer">
              <option value="">Tous statuts</option>
              {STATUTS.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Vue toggle */}
            <div className="flex rounded-lg overflow-hidden themed-border border">
              {[['liste', '☰'], ['plan', '⊞']].map(([v, icon]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${view === v ? 'themed-active' : 'themed-hover themed-secondary'}`}>
                  {icon} {v === 'liste' ? 'Liste' : 'Plan'}
                </button>
              ))}
            </div>

            {canEdit && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                <button onClick={() => fileRef.current.click()} disabled={importing}
                  className="px-3 py-1.5 themed-border border themed-hover themed-secondary text-xs rounded-lg cursor-pointer transition-all">
                  {importing ? '…' : '↑ Excel'}
                </button>
                <button onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 themed-border border themed-hover themed-secondary text-xs rounded-lg cursor-pointer transition-all">
                  ↓ Template
                </button>
                <button onClick={handleExportDXF}
                  className="px-3 py-1.5 themed-border border themed-hover themed-secondary text-xs rounded-lg cursor-pointer transition-all">
                  ↓ DXF
                </button>
                <button onClick={() => setShowForm(true)}
                  className="themed-btn-primary px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all">
                  + Élément
                </button>
              </>
            )}
          </div>
        </div>

        {/* Import result */}
        {importResult && (
          <div className={`mx-5 mt-3 px-4 py-2.5 rounded-xl text-xs border ${importResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {importResult.success
              ? `✓ ${importResult.créés} créés, ${importResult.mis_à_jour} mis à jour`
              : `✗ ${importResult.message}`}
            <button onClick={() => setImportResult(null)} className="ml-2 opacity-60 hover:opacity-100 cursor-pointer">×</button>
          </div>
        )}

        {/* Contenu */}
        <div className="flex-1 p-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full themed-muted text-sm gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Chargement…
            </div>
          ) : view === 'plan' ? (
            <PlanVue elements={filtered} onSelect={selectElement} selected={selected} colorBy={colorBy} />
          ) : (
            <div className="themed-card themed-border border rounded-2xl overflow-hidden h-full flex flex-col">
              {/* Recherche */}
              <div className="px-4 py-2.5 themed-border border-b flex items-center gap-3" style={{ background: 'var(--bg-sidebar)' }}>
                <span className="themed-muted text-sm">🔍</span>
                <input type="text" placeholder="Rechercher par référence…" value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="flex-1 text-sm bg-transparent outline-none" style={{ color: 'var(--text-primary)' }} />
                {filter && <button onClick={() => setFilter('')} className="themed-muted hover:opacity-70 cursor-pointer text-sm">×</button>}
                <span className="text-xs themed-muted">{filtered.length} élément{filtered.length > 1 ? 's' : ''}</span>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 themed-border border-b" style={{ background: 'var(--bg-sidebar)' }}>
                    <tr>
                      {['Référence', 'Type', 'Semelle', 'Statut', 'Prof. roche', 'Vol. foré', 'Ancrage', 'Date forage'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold themed-muted uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                      {(canEdit || isChef) && <th className="px-4 py-2.5 w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id} onClick={() => selectElement(e)}
                        className={`themed-border border-b cursor-pointer transition-all ${selected?.id === e.id ? '' : 'themed-hover'}`}
                        style={selected?.id === e.id ? { background: 'var(--accent-soft)' } : {}}>
                        <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{e.reference}</td>
                        <td className="px-4 py-3 text-xs themed-secondary">{e.type_element}</td>
                        <td className="px-4 py-3 text-xs themed-muted font-mono">{e.semelle_ref || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge statut={e.statut_element} /></td>
                        <td className="px-4 py-3 text-xs font-mono themed-secondary">{e.prof_roche != null ? `${e.prof_roche} m` : '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono themed-secondary">{e.volume_fore != null ? `${e.volume_fore?.toFixed(2)} m³` : '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono themed-secondary">{e.ancrage != null ? `${e.ancrage?.toFixed(2)} m` : '—'}</td>
                        <td className="px-4 py-3 text-xs themed-muted">{e.date_forage ? new Date(e.date_forage).toLocaleDateString('fr-FR') : '—'}</td>
                        {(canEdit || isChef) && (
                          <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                            <button onClick={() => setConfirmDelete(e)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1 transition-all cursor-pointer opacity-0 group-hover:opacity-100 text-xs">
                              🗑
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 themed-muted">
                    <div className="text-4xl mb-3">⬡</div>
                    <div className="text-sm font-medium">Aucun élément</div>
                    <div className="text-xs mt-1">{canEdit ? 'Créez un élément ou importez un fichier Excel' : 'Aucun résultat'}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DROITE détail ── */}
      {selected && (
        <div className="w-[420px] themed-border border-l flex flex-col flex-shrink-0 overflow-hidden"
          style={{ background: 'var(--bg-sidebar)' }}>
          <div className="px-5 py-4 themed-border border-b flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{selected.reference}</span>
              <StatusBadge statut={selected.statut_element} />
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && !editing && (
                <button onClick={startEdit}
                  className="px-2.5 py-1 themed-border border themed-hover themed-secondary text-xs rounded-lg cursor-pointer transition-all">
                  ✏️ Modifier
                </button>
              )}
              {editing && (
                <>
                  <button onClick={saveEdit} disabled={saving}
                    className="px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-all text-white"
                    style={{ background: 'var(--accent)' }}>
                    {saving ? '…' : '✓ Sauver'}
                  </button>
                  <button onClick={() => { setEditing(false); setEditVals({}) }}
                    className="px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-all themed-hover themed-secondary">
                    Annuler
                  </button>
                </>
              )}
              {(isChef || canEdit) && !editing && (
                <button onClick={() => setConfirmDelete(selected)}
                  className="px-2.5 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs rounded-lg cursor-pointer transition-all border border-transparent hover:border-red-200">
                  🗑
                </button>
              )}
              <button onClick={() => { setSelected(null); setEditing(false) }}
                className="themed-muted hover:opacity-70 text-xl ml-1 cursor-pointer transition-opacity">×</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DetailTabs
              selected={selected} mesures={mesures} comments={comments}
              elements={elements}
              editing={editing} editVals={editVals}
              onEditChange={(f, v) => setEditVals(e => ({ ...e, [f]: v }))}
              canEdit={canEdit} isChef={isChef}
              newComment={newComment} setNewComment={setNewComment} handleComment={handleComment}
              showRejet={showRejet} setShowRejet={setShowRejet}
              rejetMsg={rejetMsg} setRejetMsg={setRejetMsg}
              handleSoumettre={handleSoumettre} handleValider={handleValider} handleRejeter={handleRejeter}
              showMesureForm={showMesureForm} setShowMesureForm={setShowMesureForm}
              mesureForm={mesureForm} setMesureForm={setMesureForm} handleAddMesure={handleAddMesure}
            />
          </div>
        </div>
      )}

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="themed-card rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Nouvel élément — {projetActif.nom}
              </h2>
              <button onClick={() => setShowForm(false)} className="themed-muted text-xl cursor-pointer hover:opacity-70">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">Référence *</label>
                  <input required value={newForm.reference} onChange={e => setNewForm(f => ({ ...f, reference: e.target.value }))}
                    className="themed-input w-full px-3 py-2 border rounded-xl text-sm font-mono" placeholder="Pi.137" />
                </div>
                <div>
                  <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">Type *</label>
                  <select value={newForm.type_element} onChange={e => setNewForm(f => ({ ...f, type_element: e.target.value }))}
                    className="themed-input w-full px-3 py-2 border rounded-xl text-sm cursor-pointer">
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['coord_x', 'Coord X', 'number', ''], ['coord_y', 'Coord Y', 'number', '']].map(([k, l, type, ph]) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">{l}</label>
                    <input type={type} step="0.001" value={newForm[k]}
                      onChange={e => setNewForm(f => ({ ...f, [k]: e.target.value }))}
                      className="themed-input w-full px-3 py-2 border rounded-xl text-sm" placeholder={ph} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['diametre', 'Ø (mm)'], ['cote_bs_theorique', 'BS théo.'], ['cote_bi_theorique', 'BI théo.']].map(([k, l]) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">{l}</label>
                    <input type="number" step="0.001" value={newForm[k]}
                      onChange={e => setNewForm(f => ({ ...f, [k]: e.target.value }))}
                      className="themed-input w-full px-3 py-2 border rounded-xl text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">Matériau</label>
                  <input value={newForm.materiau} onChange={e => setNewForm(f => ({ ...f, materiau: e.target.value }))}
                    className="themed-input w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">Vol. budgétisé (m³)</label>
                  <input type="number" step="0.001" value={newForm.volume_budgetise}
                    onChange={e => setNewForm(f => ({ ...f, volume_budgetise: e.target.value }))}
                    className="themed-input w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="themed-btn-primary flex-1 font-semibold py-2.5 rounded-xl text-sm cursor-pointer transition-all">
                  Créer
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl text-sm cursor-pointer themed-hover transition-all"
                  style={{ background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="themed-card rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Supprimer l'élément ?
            </h2>
            <p className="text-sm themed-secondary mb-5">
              <strong className="font-mono">{confirmDelete.reference}</strong> sera supprimé définitivement avec toutes ses mesures et commentaires.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm cursor-pointer transition-all">
                Supprimer
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl text-sm cursor-pointer themed-hover transition-all"
                style={{ background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
