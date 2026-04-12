import { useEffect, useState, useRef } from 'react'
import api from '../api'
import { useAuth } from '../AuthContext'
import { useProjet } from '../ProjetContext'
import PlanVue from '../components/PlanVue'
import DetailTabs from '../components/DetailTabs'


const TYPES_GO = ['Poteau','Voile','Poutre','Dalle','Escalier','Longrine','Autre']
const STATUTS  = ['À faire','En cours','Coulé','Décoffré','Validé']
const STATUT_BADGE = {
  'À faire':  'bg-slate-100 text-slate-600',
  'En cours': 'bg-blue-50 text-blue-700',
  'Coulé':    'bg-amber-50 text-amber-700',
  'Décoffré': 'bg-emerald-50 text-emerald-700',
  'Validé':   'bg-green-50 text-green-700',
}

function Badge({ statut }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${STATUT_BADGE[statut] || 'bg-slate-100 text-slate-600'}`}>{statut}</span>
}

const EMPTY_FORM = {
  reference:'', type_element:'Poteau', famille:'',
  coord_x:'', coord_y:'', largeur:'', longueur:'', hauteur:'',
  volume_budgetise:'', materiau:'Béton C25/30', armature:'500A HA16/HA20'
}

export default function GrosOeuvre() {
  const { canEdit, isChef } = useAuth()
  const { projetActif } = useProjet()
  const [elements, setElements]   = useState([])
  const [selected, setSelected]   = useState(null)
  const [mesures, setMesures]     = useState([])
  const [comments, setComments]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [view, setView]           = useState('liste')
  const [typeFilter, setTypeFilter]     = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [colorBy, setColorBy]           = useState('statut')
  const [filter, setFilter]             = useState('')
  const [editing, setEditing]           = useState(false)
  const [editVals, setEditVals]         = useState({})
  const [saving, setSaving]             = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [showMesureForm, setShowMesureForm] = useState(false)
  const [newComment, setNewComment]     = useState('')
  const [showRejet, setShowRejet]       = useState(false)
  const [rejetMsg, setRejetMsg]         = useState('')
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [newForm, setNewForm]           = useState(EMPTY_FORM)
  const [mesureForm, setMesureForm]     = useState({
    date_mesure: new Date().toISOString().slice(0,16),
    phase: 'controle', cote_tete:'', cote_pied:'',
    longueur_mesuree:'', volume_fore:'', volume_recepé:'', commentaire:'',
  })
  const fileRef = useRef()

  const load = async () => {
    if (!projetActif) return
    setLoading(true)
    const res = await api.get(`/elements/?projet_id=${projetActif.id}&lot=Gros%20%C5%93uvre`)
    setElements(res.data)
    setLoading(false)
  }

  useEffect(() => { setElements([]); setSelected(null); load() }, [projetActif?.id])

  const selectElement = async (e) => {
    setSelected(e); setEditing(false); setEditVals({})
    const [m, c] = await Promise.all([api.get(`/mesures/${e.id}`), api.get(`/commentaires/${e.id}`)])
    setMesures(m.data); setComments(c.data)
  }

  const startEdit = () => {
    const fields = ['coord_x','coord_y','diametre','largeur','longueur','hauteur',
      'volume_budgetise','volume_fore','materiau','armature','famille','statut_element',
      'charge_admissible_calc','charge_admissible_mesure','charge_appliquee']
    const v = {}; fields.forEach(f => { v[f] = selected[f] ?? '' })
    setEditVals(v); setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    const payload = {}
    Object.entries(editVals).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : (Number(v) || v) })
    await api.put(`/elements/${selected.id}`, payload)
    const u = await api.get(`/elements/${selected.id}`)
    setSelected(u.data); setEditing(false); setEditVals({}); setSaving(false); load()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const payload = { projet_id: projetActif.id, lot: 'Gros œuvre' }
    Object.entries(newForm).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : (Number(v) || v) })
    await api.post('/elements/', payload)
    setShowForm(false); setNewForm(EMPTY_FORM); load()
  }

  const handleAddMesure = async (e) => {
    e.preventDefault()
    const payload = { element_id: selected.id }
    Object.entries(mesureForm).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : (Number(v) || v) })
    await api.post('/mesures/', payload)
    const m = await api.get(`/mesures/${selected.id}`)
    setMesures(m.data); setShowMesureForm(false)
  }

  const handleSoumettre = async () => {
    await api.post(`/elements/${selected.id}/soumettre`)
    const u = await api.get(`/elements/${selected.id}`); setSelected(u.data); load()
  }
  const handleValider = async () => {
    await api.post(`/elements/${selected.id}/valider`, { action: 'valider' })
    const u = await api.get(`/elements/${selected.id}`); setSelected(u.data); load()
  }
  const handleRejeter = async () => {
    if (!rejetMsg.trim()) return
    await api.post(`/elements/${selected.id}/valider`, { action: 'rejeter', commentaire: rejetMsg })
    const u = await api.get(`/elements/${selected.id}`)
    setSelected(u.data); setShowRejet(false); setRejetMsg(''); load()
  }
  const handleComment = async () => {
    if (!newComment.trim()) return
    await api.post('/commentaires/', { element_id: selected.id, texte: newComment })
    const c = await api.get(`/commentaires/${selected.id}`); setComments(c.data); setNewComment('')
  }
  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportResult(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await api.post(`/elements/import/excel?projet_id=${projetActif.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult({ success: true, ...res.data }); load()
    } catch (err) {
      setImportResult({ success: false, message: err.response?.data?.detail || 'Erreur import' })
    } finally { setImporting(false); e.target.value = '' }
  }
  const handleExportDXF = async () => {
    try {
      const res = await api.get(`/elements/export/dxf/${projetActif?.id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url
      a.download = `gros_oeuvre_${projetActif?.nom?.replace(/\s+/g,'_')}.dxf`
      a.click(); URL.revokeObjectURL(url)
    } catch { alert('Erreur export DXF') }
  }

  const filtered = elements.filter(e => {
    const mT = !typeFilter   || e.type_element === typeFilter
    const mS = !statutFilter || e.statut_element === statutFilter
    const mF = !filter || e.reference.toLowerCase().includes(filter.toLowerCase()) || (e.famille||'').toLowerCase().includes(filter.toLowerCase())
    return mT && mS && mF
  })

  if (!projetActif) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Sélectionnez un projet dans la barre latérale
    </div>
  )

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Gros œuvre</h1>
            <p className="text-xs text-slate-400">{projetActif.nom} · {elements.length} éléments</p>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
              <option value="">Tous types</option>
              {TYPES_GO.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
              <option value="">Tous statuts</option>
              {STATUTS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={colorBy} onChange={e => setColorBy(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
              <option value="statut">Couleur : statut</option>
              <option value="famille">Couleur : famille</option>
            </select>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              {[['plan','Plan 2D'],['liste','Liste']].map(([v,l]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${view===v ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
            {canEdit && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                <button onClick={() => fileRef.current.click()} disabled={importing}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg">
                  {importing ? 'Import…' : '↑ Excel'}
                </button>
                <button onClick={handleExportDXF} className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg">↓ DXF</button>
                <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg">+ Élément</button>
              </>
            )}
          </div>
        </div>

        {importResult && (
          <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-xs border ${importResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {importResult.success ? `✓ ${importResult.créés} créés, ${importResult.mis_à_jour} mis à jour` : `✗ ${importResult.message}`}
          </div>
        )}

        <div className="flex-1 p-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Chargement…</div>
          ) : elements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3">
              <div className="text-5xl">▣</div>
              <div className="text-sm font-medium text-slate-400">Aucun élément de gros œuvre</div>
              <div className="text-xs text-slate-300">Importez un fichier Excel ou créez un élément manuellement</div>
              {canEdit && (
                <button onClick={() => setShowForm(true)} className="mt-2 px-4 py-2 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-900">
                  + Créer un élément
                </button>
              )}
            </div>
          ) : view === 'plan' ? (
            <PlanVue elements={filtered} onSelect={selectElement} selected={selected} colorBy={colorBy} />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-full flex flex-col">
              <div className="p-3 border-b border-slate-100">
                <input type="text" placeholder="Rechercher…" value={filter} onChange={e => setFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-slate-100">
                    <tr>
                      {['Référence','Type','Famille','Statut','Larg.','Long.','Haut.','Vol. budg.'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id} onClick={() => selectElement(e)}
                        className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${selected?.id===e.id?'bg-blue-50':''}`}>
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 text-xs">{e.reference}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{e.type_element}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{e.famille || '—'}</td>
                        <td className="px-4 py-2.5"><Badge statut={e.statut_element} /></td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{e.largeur ? `${e.largeur}m` : '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{e.longueur ? `${e.longueur}m` : '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{e.hauteur ? `${e.hauteur}m` : '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{e.volume_budgetise ? `${e.volume_budgetise} m³` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panneau détail */}
      {selected && (
        <div className="w-96 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-slate-900">{selected.reference}</span>
              <Badge statut={selected.statut_element} />
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && !editing && (
                <button onClick={startEdit} className="px-2.5 py-1 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 text-xs rounded-lg">✏️</button>
              )}
              {editing && (
                <>
                  <button onClick={saveEdit} disabled={saving} className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg disabled:bg-blue-400">{saving ? '…' : '✓'}</button>
                  <button onClick={() => { setEditing(false); setEditVals({}) }} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg">✗</button>
                </>
              )}
              <button onClick={() => { setSelected(null); setEditing(false) }} className="text-slate-400 hover:text-slate-600 text-xl ml-1">×</button>
            </div>
          </div>
          <DetailTabs
            selected={selected} mesures={mesures} comments={comments}
            elements={elements}
            editing={editing} editVals={editVals}
            onEditChange={(f,v) => setEditVals(e => ({...e,[f]:v}))}
            canEdit={canEdit} isChef={isChef}
            newComment={newComment} setNewComment={setNewComment} handleComment={handleComment}
            showRejet={showRejet} setShowRejet={setShowRejet}
            rejetMsg={rejetMsg} setRejetMsg={setRejetMsg}
            handleSoumettre={handleSoumettre} handleValider={handleValider} handleRejeter={handleRejeter}
            showMesureForm={showMesureForm} setShowMesureForm={setShowMesureForm}
            mesureForm={mesureForm} setMesureForm={setMesureForm} handleAddMesure={handleAddMesure}
          />
        </div>
      )}

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Nouvel élément — Gros œuvre</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Référence *</label>
                  <input required value={newForm.reference} onChange={e=>setNewForm(f=>({...f,reference:e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono" placeholder="P-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
                  <select value={newForm.type_element} onChange={e=>setNewForm(f=>({...f,type_element:e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                    {TYPES_GO.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['famille','Famille','F1'],['coord_x','Coord X',''],['coord_y','Coord Y','']].map(([k,l,p]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input type={k==='famille'?'text':'number'} step="0.001" value={newForm[k]}
                      onChange={e=>setNewForm(f=>({...f,[k]:e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" placeholder={p} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['largeur','Largeur (m)'],['longueur','Longueur (m)'],['hauteur','Hauteur (m)']].map(([k,l]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input type="number" step="0.01" value={newForm[k]}
                      onChange={e=>setNewForm(f=>({...f,[k]:e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Matériau</label>
                  <input value={newForm.materiau} onChange={e=>setNewForm(f=>({...f,materiau:e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vol. budgétisé (m³)</label>
                  <input type="number" step="0.001" value={newForm.volume_budgetise}
                    onChange={e=>setNewForm(f=>({...f,volume_budgetise:e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm">Créer</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}