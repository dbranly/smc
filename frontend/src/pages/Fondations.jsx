import { useEffect, useState, useRef } from 'react'
import api from '../api'
import { useAuth } from '../AuthContext'
import { useProjet } from '../ProjetContext'
import PlanVue from '../components/PlanVue'
import DetailTabs from '../components/DetailTabs'


const TYPES = ['Pieu','Semelle','Poteau','Longrine','Radier','Voile','Poutre','Dalle','Escalier','Autre']
const STATUTS_ELEMENT = ['À faire','En cours','Foré','Recépé','Validé']
const STATUT_BADGE = {
  'À faire':  'bg-slate-100 text-slate-600',
  'En cours': 'bg-blue-50 text-blue-700',
  'Foré':     'bg-amber-50 text-amber-700',
  'Recépé':   'bg-emerald-50 text-emerald-700',
  'Validé':   'bg-green-50 text-green-700',
}

function Badge({ statut }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${STATUT_BADGE[statut] || 'bg-slate-100 text-slate-600'}`}>{statut}</span>
}

function Field({ label, field, value, edit, editVals, onChange, type = 'text', unit = '' }) {
  if (!edit) return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value ?? '—'}</div>
    </div>
  )
  return (
    <div className="bg-white border border-blue-200 rounded-lg p-3">
      <div className="text-xs text-blue-500 uppercase tracking-wide mb-1">{label}{unit ? ` (${unit})` : ''}</div>
      <input type={type} step={type === 'number' ? '0.001' : undefined}
        value={editVals[field] ?? ''} onChange={e => onChange(field, e.target.value)}
        className="w-full text-sm font-medium text-slate-800 bg-transparent border-none outline-none p-0" placeholder="—" />
    </div>
  )
}

const EMPTY_FORM = { reference:'', type_element:'Pieu', famille:'', coord_x:'', coord_y:'',
  diametre:'800', cote_bs_theorique:'', cote_bi_theorique:'', longueur_theorique:'',
  volume_budgetise:'', materiau:'Béton C30/37', armature:'500A/B' }

export default function Fondations() {
  const { canEdit, isChef } = useAuth()
  const { projetActif } = useProjet()
  const [elements, setElements]   = useState([])
  const [extraElements, setExtraElements] = useState([])  // éléments autres lots pour vue 3D
  const [selected, setSelected]   = useState(null)
  const [mesures, setMesures]     = useState([])
  const [comments, setComments]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [view, setView]           = useState('plan')
  const [typeFilter, setTypeFilter]   = useState('Pieu')
  const [statutFilter, setStatutFilter] = useState('')
  const [colorBy, setColorBy]     = useState('statut')
  const [filter, setFilter]       = useState('')
  const [editing, setEditing]     = useState(false)
  const [editVals, setEditVals]   = useState({})
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [showMesureForm, setShowMesureForm] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [showRejet, setShowRejet] = useState(false)
  const [rejetMsg, setRejetMsg]   = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [newForm, setNewForm]     = useState(EMPTY_FORM)
  const [mesureForm, setMesureForm] = useState({
    date_mesure: new Date().toISOString().slice(0,16),
    phase: 'avant_recepage', cote_tete:'', cote_pied:'',
    longueur_mesuree:'', volume_fore:'', volume_recepé:'', commentaire:'',
  })
  const fileRef = useRef()

  const load = async () => {
    if (!projetActif) return
    setLoading(true)
    const res = await api.get(`/api/elements/?projet_id=${projetActif.id}&lot=Fondations`)
    setElements(res.data)
    // Charger aussi les éléments gros oeuvre pour vue 3D combinée
    const resGO = await api.get(`/api/elements/?projet_id=${projetActif.id}&lot=Gros%20%C5%93uvre`)
    setExtraElements(resGO.data)
    setLoading(false)
  }

  useEffect(() => {
    setElements([])
    setSelected(null)
    load()
  }, [projetActif?.id])

  const selectElement = async (e) => {
    setSelected(e); setEditing(false); setEditVals({})
    const [m, c] = await Promise.all([api.get(`/api/mesures/${e.id}`), api.get(`/api/commentaires/${e.id}`)])
    setMesures(m.data); setComments(c.data)
  }

  const startEdit = () => {
    const fields = ['coord_x','coord_y','coord_z','diametre','largeur','longueur','hauteur',
      'cote_bs_theorique','cote_bi_theorique','cote_bs_reelle','cote_bi_reelle',
      'longueur_theorique','longueur_reelle','volume_budgetise','volume_fore','volume_recepé',
      'materiau','armature','famille','statut_element']
    const v = {}; fields.forEach(f => { v[f] = selected[f] ?? '' })
    setEditVals(v); setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    const payload = {}
    Object.entries(editVals).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : (Number(v) || v) })
    await api.put(`/api/elements/${selected.id}`, payload)
    const updated = await api.get(`/api/elements/${selected.id}`)
    setSelected(updated.data); setEditing(false); setEditVals({}); setSaving(false); load()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const payload = { projet_id: projetActif.id, lot: 'Fondations' }
    Object.entries(newForm).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : (Number(v) || v) })
    await api.post('/api/elements/', payload)
    setShowForm(false); setNewForm(EMPTY_FORM); load()
  }

  const handleAddMesure = async (e) => {
    e.preventDefault()
    const payload = { element_id: selected.id }
    Object.entries(mesureForm).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : (Number(v) || v) })
    await api.post('/api/mesures/', payload)
    const m = await api.get(`/api/mesures/${selected.id}`)
    setMesures(m.data); setShowMesureForm(false)
  }

  const handleSoumettre = async () => {
    await api.post(`/api/elements/${selected.id}/soumettre`)
    const u = await api.get(`/api/elements/${selected.id}`); setSelected(u.data); load()
  }
  const handleValider = async () => {
    await api.post(`/api/elements/${selected.id}/valider`, { action: 'valider' })
    const u = await api.get(`/api/elements/${selected.id}`); setSelected(u.data); load()
  }
  const handleRejeter = async () => {
    if (!rejetMsg.trim()) return
    await api.post(`/api/elements/${selected.id}/valider`, { action: 'rejeter', commentaire: rejetMsg })
    const u = await api.get(`/api/elements/${selected.id}`)
    setSelected(u.data); setShowRejet(false); setRejetMsg(''); load()
  }
  const handleComment = async () => {
    if (!newComment.trim()) return
    await api.post('/api/commentaires/', { element_id: selected.id, texte: newComment })
    const c = await api.get(`/api/commentaires/${selected.id}`); setComments(c.data); setNewComment('')
  }
  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportResult(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await api.post(`/api/elements/import/excel?projet_id=${projetActif.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult({ success: true, ...res.data }); load()
    } catch (err) {
      setImportResult({ success: false, message: err.response?.data?.detail || 'Erreur import' })
    } finally { setImporting(false); e.target.value = '' }
  }
  const handleExportDXF = async () => {
    try {
      const res = await api.get(`/api/elements/export/dxf/${projetActif?.id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url
      a.download = `pieux_${projetActif?.nom?.replace(/\s+/g,'_')}.dxf`
      a.click(); URL.revokeObjectURL(url)
    } catch (err) { alert('Erreur export DXF') }
  }
  const handleDownloadTemplate = () => window.open('/api/elements/export/template-excel', '_blank')

  const filtered = elements.filter(e => {
    const mT = !typeFilter   || e.type_element === typeFilter
    const mS = !statutFilter || e.statut_element === statutFilter
    const mF = !filter       || e.reference.toLowerCase().includes(filter.toLowerCase()) || (e.famille||'').toLowerCase().includes(filter.toLowerCase())
    return mT && mS && mF
  })

  if (!projetActif) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Sélectionnez un projet dans la barre latérale
    </div>
  )

  return (
    <div className="flex h-full">
      {/* ── GAUCHE ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Fondations</h1>
            <p className="text-xs text-slate-400">{projetActif.nom} · {elements.length} éléments</p>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
              <option value="">Tous types</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
              <option value="">Tous statuts</option>
              {STATUTS_ELEMENT.map(s => <option key={s}>{s}</option>)}
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
                <button onClick={handleDownloadTemplate} className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg">↓ Template</button>
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
                      {['Référence','Type','Famille','Statut','Diamètre','BS th.','BI th.','Vol. budg.'].map(h => (
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
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{e.diametre ? `Ø${e.diametre}` : '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{e.cote_bs_theorique ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{e.cote_bi_theorique ?? '—'}</td>
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

      {/* ── DROITE détail ── */}
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
              <h2 className="text-base font-semibold text-slate-900">Nouvel élément — {projetActif.nom}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Référence *</label>
                  <input required value={newForm.reference} onChange={e=>setNewForm(f=>({...f,reference:e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono" placeholder="Pi.137" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
                  <select value={newForm.type_element} onChange={e=>setNewForm(f=>({...f,type_element:e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['famille','Famille','F1'],['coord_x','Coord X',''],['coord_y','Coord Y','']].map(([k,l,p]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input type={k==='famille'?'text':'number'} step="0.001" value={newForm[k]} onChange={e=>setNewForm(f=>({...f,[k]:e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" placeholder={p} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['diametre','Diamètre (mm)'],['cote_bs_theorique','Cote BS th.'],['cote_bi_theorique','Cote BI th.']].map(([k,l]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input type="number" step="0.001" value={newForm[k]} onChange={e=>setNewForm(f=>({...f,[k]:e.target.value}))}
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
                  <input type="number" step="0.001" value={newForm.volume_budgetise} onChange={e=>setNewForm(f=>({...f,volume_budgetise:e.target.value}))}
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
