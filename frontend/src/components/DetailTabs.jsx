import { useState, useEffect } from 'react'
import api from '../api'

const TYPES_SOL = [
  'Argile','Argile molle','Argile dure','Limon',
  'Sable fin','Sable moyen','Sable grossier',
  'Gravier','Grave','Roche altérée','Roche saine','Remblai','Autre'
]

// ── Couches géologiques ──────────────────────────────────────────
function CouchesGeo({ element, canEdit }) {
  const [couches, setCouches]     = useState([])
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm] = useState({
    profondeur_top: '', profondeur_bottom: '',
    type_sol: 'Argile', description: '',
    resistance_spt: '', cohesion_cu: '', angle_frottement: '',
  })

  const load = async () => {
    const res = await api.get(`/api/couches-geo/${element.id}`)
    setCouches(res.data)
  }

  useEffect(() => { load() }, [element.id])

  const handleAdd = async (e) => {
    e.preventDefault()
    const payload = { element_id: element.id }
    Object.entries(form).forEach(([k,v]) => { if (v !== '') payload[k] = isNaN(v) ? v : Number(v) })
    await api.post('/api/couches-geo/', payload)
    setShowForm(false)
    setForm({ profondeur_top:'', profondeur_bottom:'', type_sol:'Argile', description:'', resistance_spt:'', cohesion_cu:'', angle_frottement:'' })
    load()
  }

  const handleDelete = async (id) => {
    await api.delete(`/api/couches-geo/${id}`)
    load()
  }

  // Visualisation colonne de sol
  const totalH = couches.length
    ? Math.abs((Math.min(...couches.map(c => c.profondeur_bottom))) - (Math.max(...couches.map(c => c.profondeur_top))))
    : 0

  const SOL_COLORS = {
    'Argile': '#c8a882', 'Argile molle': '#d4b896', 'Argile dure': '#b8946e',
    'Limon': '#dac5a0', 'Sable fin': '#e8d5a3', 'Sable moyen': '#e0c87a',
    'Sable grossier': '#d4b84a', 'Gravier': '#b8b8b8', 'Grave': '#a0a0a0',
    'Roche altérée': '#8b7355', 'Roche saine': '#6b5b45', 'Remblai': '#9cae8c', 'Autre': '#c0c0c0',
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <button onClick={() => setShowForm(v => !v)}
          className="w-full px-3 py-2 border border-dashed border-slate-300 text-slate-500 text-xs rounded-lg hover:border-slate-400 transition-colors">
          + Ajouter une couche géologique
        </button>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-medium text-slate-600 mb-1">Nouvelle couche</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cote top (m) *</label>
              <input type="number" step="0.01" required value={form.profondeur_top}
                onChange={e => setForm(f => ({...f, profondeur_top: e.target.value}))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" placeholder="-1.00" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cote bottom (m) *</label>
              <input type="number" step="0.01" required value={form.profondeur_bottom}
                onChange={e => setForm(f => ({...f, profondeur_bottom: e.target.value}))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" placeholder="-3.50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Type de sol *</label>
            <select value={form.type_sol} onChange={e => setForm(f => ({...f, type_sol: e.target.value}))}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none">
              {TYPES_SOL.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['resistance_spt','SPT (coups)'],['cohesion_cu','Cu (kPa)'],['angle_frottement','φ (°)']].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 mb-1 block">{l}</label>
                <input type="number" step="0.1" value={form[k]}
                  onChange={e => setForm(f => ({...f,[k]:e.target.value}))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-slate-800 text-white text-xs py-1.5 rounded-lg">Enregistrer</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Annuler</button>
          </div>
        </form>
      )}

      {couches.length === 0 ? (
        <div className="text-xs text-slate-300 text-center py-6">Aucune couche géologique enregistrée</div>
      ) : (
        <div className="flex gap-3">
          {/* Colonne visuelle */}
          <div className="flex flex-col w-8 flex-shrink-0 rounded overflow-hidden border border-slate-200" style={{ minHeight: 120 }}>
            {couches.map(c => {
              const h = Math.abs(c.profondeur_top - c.profondeur_bottom)
              const pct = totalH > 0 ? (h / totalH) * 100 : 100 / couches.length
              return (
                <div key={c.id} title={c.type_sol}
                  style={{ height: `${pct}%`, minHeight: 20, background: SOL_COLORS[c.type_sol] || '#c0c0c0' }}
                  className="border-b border-white/30 last:border-0" />
              )
            })}
          </div>

          {/* Liste des couches */}
          <div className="flex-1 space-y-2">
            {couches.map(c => (
              <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: SOL_COLORS[c.type_sol] || '#c0c0c0' }} />
                    <span className="text-xs font-semibold text-slate-800">{c.type_sol}</span>
                  </div>
                  {canEdit && (
                    <button onClick={() => handleDelete(c.id)} className="text-slate-300 hover:text-red-400 text-xs transition-colors">✕</button>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mb-1">
                  {c.profondeur_top}m → {c.profondeur_bottom}m
                  <span className="ml-2 text-slate-400">({Math.abs(c.profondeur_top - c.profondeur_bottom).toFixed(2)}m)</span>
                </div>
                <div className="flex gap-3 text-xs text-slate-400">
                  {c.resistance_spt   != null && <span>SPT: <span className="text-slate-600 font-medium">{c.resistance_spt}</span></span>}
                  {c.cohesion_cu      != null && <span>Cu: <span className="text-slate-600 font-medium">{c.cohesion_cu} kPa</span></span>}
                  {c.angle_frottement != null && <span>φ: <span className="text-slate-600 font-medium">{c.angle_frottement}°</span></span>}
                </div>
                {c.description && <div className="text-xs text-slate-400 italic mt-1">{c.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Charges ──────────────────────────────────────────────────────
function Charges({ selected, editing, editVals, onEditChange }) {
  const calc    = selected.charge_admissible_calc
  const mesure  = selected.charge_admissible_mesure
  const appli   = selected.charge_appliquee
  const ref     = mesure ?? calc

  const pct = ref && appli ? Math.round((appli / ref) * 100) : null
  const depasse = pct !== null && pct > 100

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          ['charge_admissible_calc',    'Charge admissible calculée', 'kN'],
          ['charge_admissible_mesure',  'Charge admissible mesurée',  'kN'],
          ['charge_appliquee',          'Charge appliquée',           'kN'],
        ].map(([field, label, unit]) => (
          editing ? (
            <div key={field} className="bg-white border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-500 uppercase tracking-wide mb-1">{label} ({unit})</div>
              <input type="number" step="0.1" value={editVals[field] ?? ''}
                onChange={e => onEditChange(field, e.target.value)}
                className="w-full text-sm font-medium text-slate-800 bg-transparent border-none outline-none p-0" placeholder="—" />
            </div>
          ) : (
            <div key={field} className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-sm font-medium text-slate-800">
                {selected[field] != null ? `${selected[field]} ${unit}` : '—'}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Taux de charge */}
      {pct !== null && (
        <div className={`p-3 rounded-lg border ${depasse ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${depasse ? 'text-red-700' : 'text-emerald-700'}`}>
              Taux de charge
            </span>
            <span className={`text-sm font-bold ${depasse ? 'text-red-700' : 'text-emerald-700'}`}>{pct}%</span>
          </div>
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${depasse ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {depasse && (
            <div className="text-xs text-red-600 mt-1.5 font-medium">
              ⚠ Dépassement de {pct - 100}% de la capacité admissible
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Liaisons structurelles ────────────────────────────────────────
function LiaisonsTab({ element, elements, canEdit }) {
  const [chaine, setChaine]       = useState(null)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ semelle_id: '', poteau_id: '', ordre: '1' })
  const [loading, setLoading]     = useState(true)

  // Semelles et poteaux disponibles dans le même projet
  const semelles = elements.filter(e => e.type_element === 'Semelle')
  const poteaux  = elements.filter(e => e.type_element === 'Poteau')
  const pieux    = elements.filter(e => e.type_element === 'Pieu' && e.id !== element.id)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/liaisons/chaine/${element.id}`)
      setChaine(res.data)
    } catch { setChaine(null) }
    setLoading(false)
  }

  useEffect(() => { load() }, [element.id])

  const handleCreate = async (e) => {
    e.preventDefault()
    const payload = { pieu_id: element.id, semelle_id: parseInt(form.semelle_id) }
    if (form.poteau_id) payload.poteau_id = parseInt(form.poteau_id)
    if (form.ordre) payload.ordre = parseInt(form.ordre)
    await api.post('/api/liaisons/', payload)
    setShowForm(false)
    load()
  }

  const handleDelete = async (liaisonId) => {
    await api.delete(`/api/liaisons/${liaisonId}`)
    load()
  }

  if (loading) return <div className="text-xs text-slate-300 text-center py-6">Chargement…</div>

  return (
    <div className="space-y-4">

      {/* Schéma chaîne structurelle */}
      {chaine && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Chaîne structurelle</div>

          {element.type_element === 'Pieu' && (
            <div className="flex flex-col items-center gap-1">
              {/* Poteau */}
              {chaine.poteau ? (
                <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono font-semibold text-blue-700 text-center">
                  {chaine.poteau.reference}
                  <div className="text-blue-400 font-normal">Poteau</div>
                </div>
              ) : (
                <div className="px-3 py-1.5 bg-slate-100 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 text-center">Poteau non lié</div>
              )}
              <div className="text-slate-300 text-lg">↓</div>
              {/* Semelle */}
              {chaine.semelle ? (
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-mono font-semibold text-amber-700 text-center">
                  {chaine.semelle.reference}
                  <div className="text-amber-400 font-normal">Semelle</div>
                </div>
              ) : (
                <div className="px-3 py-1.5 bg-slate-100 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 text-center">Semelle non liée</div>
              )}
              <div className="text-slate-300 text-lg">↓</div>
              {/* Pieu courant */}
              <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-mono font-semibold text-white text-center">
                {element.reference}
                <div className="text-slate-400 font-normal">Ce pieu</div>
              </div>

              {/* Autres pieux de la semelle */}
              {chaine.pieux_semelle?.length > 0 && (
                <div className="mt-2 w-full">
                  <div className="text-xs text-slate-400 text-center mb-1">Autres pieux de la même semelle</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {chaine.pieux_semelle.map(p => (
                      <span key={p.id} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600">
                        {p.reference}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {element.type_element === 'Semelle' && (
            <div className="space-y-2">
              {chaine.poteau && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-xs text-slate-600">Poteau : </span>
                  <span className="text-xs font-mono font-semibold text-blue-700">{chaine.poteau.reference}</span>
                </div>
              )}
              {chaine.pieux?.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Pieux ({chaine.pieux.length}) :</div>
                  <div className="flex flex-wrap gap-1">
                    {chaine.pieux.map(p => (
                      <span key={p.id} className="px-2 py-0.5 bg-slate-800 rounded text-xs font-mono text-white">{p.reference}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulaire liaison (uniquement pour les pieux) */}
      {canEdit && element.type_element === 'Pieu' && !chaine?.semelle && (
        <>
          <button onClick={() => setShowForm(v => !v)}
            className="w-full px-3 py-2 border border-dashed border-slate-300 text-slate-500 text-xs rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors">
            + Lier à une semelle
          </button>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-medium text-slate-600">Liaison Pieu → Semelle → Poteau</div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Semelle *</label>
                <select required value={form.semelle_id} onChange={e => setForm(f => ({...f, semelle_id: e.target.value}))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none">
                  <option value="">Sélectionner une semelle…</option>
                  {semelles.map(s => <option key={s.id} value={s.id}>{s.reference}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Poteau (optionnel)</label>
                <select value={form.poteau_id} onChange={e => setForm(f => ({...f, poteau_id: e.target.value}))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none">
                  <option value="">Aucun poteau lié</option>
                  {poteaux.map(p => <option key={p.id} value={p.id}>{p.reference}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Ordre dans la semelle</label>
                <input type="number" min="1" value={form.ordre} onChange={e => setForm(f => ({...f, ordre: e.target.value}))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-slate-800 text-white text-xs py-1.5 rounded-lg">Créer la liaison</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Annuler</button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Pas de liaisons */}
      {!chaine?.semelle && !showForm && element.type_element !== 'Pieu' && (
        <div className="text-xs text-slate-300 text-center py-4">
          Les liaisons se créent depuis la fiche d'un pieu
        </div>
      )}
    </div>
  )
}

// ── Suivi recépage multiple ───────────────────────────────────────
function RecepageTab({ selected, mesures, canEdit, showMesureForm, setShowMesureForm,
                       mesureForm, setMesureForm, handleAddMesure }) {
  const [suivi, setSuivi] = useState(null)

  useEffect(() => {
    api.get(`/api/analytics/recepage/${selected.id}`)
      .then(r => setSuivi(r.data))
      .catch(() => setSuivi(null))
  }, [selected.id, mesures.length])

  const coteCible  = selected.cote_bs_theorique
  const coteActuelle = mesures.length
    ? mesures.filter(m => m.cote_tete != null).slice(-1)[0]?.cote_tete
    : null

  // Progression visuelle vers la cote cible
  const coterMax  = coteCible != null ? coteCible + 1.5 : 0
  const coterMin  = selected.cote_bi_theorique ?? coteCible - 2
  const range     = Math.abs(coterMax - coterMin) || 1

  const posY = (cote) => Math.max(0, Math.min(100, ((coterMax - cote) / range) * 100))

  const PHASE_STYLE = {
    avant_recepage: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', dot: 'bg-amber-400', label: 'Avant recépage' },
    apres_recepage: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Après recépage' },
    controle:       { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Contrôle' },
  }

  const recepages = mesures.filter(m => m.phase === 'apres_recepage')
  const volTotalRecepé = recepages.reduce((s, m) => s + (m.volume_recepé || 0), 0)
  const atteint = coteActuelle != null && coteCible != null && coteActuelle <= coteCible + 0.05

  return (
    <div className="space-y-4">

      {/* ── Statut recépage ── */}
      {coteCible != null && (
        <div className={`flex items-center justify-between p-3 rounded-xl border ${atteint ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div>
            <div className={`text-xs font-semibold ${atteint ? 'text-emerald-700' : 'text-amber-700'}`}>
              {atteint ? '✓ Cote atteinte' : '⏳ Cote non atteinte'}
            </div>
            <div className={`text-xs mt-0.5 ${atteint ? 'text-emerald-600' : 'text-amber-600'}`}>
              Cible : <span className="font-mono font-bold">{coteCible}m</span>
              {coteActuelle != null && <> · Actuelle : <span className="font-mono font-bold">{coteActuelle}m</span></>}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${atteint ? 'text-emerald-700' : 'text-amber-700'}`}>
              {recepages.length}×
            </div>
            <div className="text-xs text-slate-400">recépage{recepages.length > 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

      {/* ── Timeline visuelle ── */}
      {mesures.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Progression vers la cote cible
          </div>

          {/* Visualisation coupe verticale */}
          <div className="flex gap-4">
            {/* Colonne visuelle pieu */}
            <div className="relative w-12 flex-shrink-0" style={{ height: 160 }}>
              {/* Sol */}
              <div className="absolute top-0 left-0 right-0 h-6 bg-slate-200 rounded-t flex items-center justify-center">
                <span className="text-xs text-slate-500 font-mono">{coterMax.toFixed(1)}m</span>
              </div>
              {/* Corps pieu */}
              <div className="absolute left-2 right-2 bg-slate-300 rounded" style={{ top: 24, bottom: 0 }} />
              {/* Cote cible (ligne rouge) */}
              {coteCible != null && (
                <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 z-10"
                  style={{ top: `${posY(coteCible)}%` }}>
                  <span className="absolute -right-14 -top-2.5 text-xs font-mono text-red-500 font-bold whitespace-nowrap">
                    {coteCible}m ←
                  </span>
                </div>
              )}
              {/* Points de mesure */}
              {mesures.filter(m => m.cote_tete != null).map((m, i) => {
                const s = PHASE_STYLE[m.phase] || PHASE_STYLE.controle
                return (
                  <div key={m.id} className="absolute left-0 right-0 z-20"
                    style={{ top: `${posY(m.cote_tete)}%` }}>
                    <div className={`w-3 h-3 rounded-full ${s.dot} border-2 border-white shadow-sm mx-auto`}
                      title={`${new Date(m.date_mesure).toLocaleDateString('fr-FR')} — ${m.cote_tete}m`} />
                  </div>
                )
              })}
            </div>

            {/* Timeline textuelle */}
            <div className="flex-1 space-y-2 max-h-40 overflow-y-auto">
              {mesures.map((m, i) => {
                const s = PHASE_STYLE[m.phase] || PHASE_STYLE.controle
                const ecart = coteCible != null && m.cote_tete != null
                  ? (m.cote_tete - coteCible).toFixed(2)
                  : null
                return (
                  <div key={m.id} className="flex items-start gap-2">
                    {/* Indicateur timeline */}
                    <div className="flex flex-col items-center flex-shrink-0 mt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      {i < mesures.length - 1 && <div className="w-0.5 h-5 bg-slate-200 mt-0.5" />}
                    </div>
                    {/* Contenu */}
                    <div className={`flex-1 rounded-lg p-2 border text-xs ${s.bg} ${s.border}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${s.text}`}>{s.label}</span>
                        <span className="text-slate-500 text-xs">
                          {new Date(m.date_mesure).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                        </span>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {m.cote_tete    != null && <span className="font-mono text-slate-700">Tête: <b>{m.cote_tete}m</b></span>}
                        {m.volume_fore  != null && <span className="font-mono text-slate-700">Foré: <b>{m.volume_fore}m³</b></span>}
                        {m.volume_recepé != null && <span className="font-mono text-slate-700">Rec: <b>{m.volume_recepé}m³</b></span>}
                        {ecart != null && (
                          <span className={`font-mono font-bold ${parseFloat(ecart) <= 0.05 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            Écart cible: {ecart >= 0 ? '+' : ''}{ecart}m
                          </span>
                        )}
                      </div>
                      {m.commentaire && <div className="text-slate-500 italic mt-1">{m.commentaire}</div>}
                      {m.operateur && <div className="text-slate-400 mt-0.5">— {m.operateur.nom}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Résumé recépages */}
          {recepages.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs">
              <div>
                <span className="text-slate-400">Nb recépages</span>
                <div className="font-bold text-slate-800">{recepages.length}</div>
              </div>
              <div>
                <span className="text-slate-400">Vol. total recépé</span>
                <div className="font-bold font-mono text-emerald-700">{volTotalRecepé.toFixed(3)} m³</div>
              </div>
              {selected.volume_budgetise > 0 && (
                <div>
                  <span className="text-slate-400">% vol. recépé / budg.</span>
                  <div className="font-bold font-mono text-slate-700">
                    {(volTotalRecepé / selected.volume_budgetise * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Formulaire ajout relevé ── */}
      {canEdit && (
        <button onClick={() => setShowMesureForm(v => !v)}
          className="w-full px-3 py-2 border border-dashed border-slate-300 text-slate-500 text-xs rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors">
          + Ajouter un relevé de recépage
        </button>
      )}

      {showMesureForm && (
        <form onSubmit={handleAddMesure} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-medium text-slate-600">Nouveau relevé</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date & heure *</label>
              <input type="datetime-local" required value={mesureForm.date_mesure}
                onChange={e => setMesureForm(f => ({...f, date_mesure: e.target.value}))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Phase</label>
              <select value={mesureForm.phase} onChange={e => setMesureForm(f => ({...f, phase: e.target.value}))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none">
                <option value="avant_recepage">Avant recépage</option>
                <option value="apres_recepage">Après recépage</option>
                <option value="controle">Contrôle</option>
              </select>
            </div>
            {[
              ['cote_tete','Cote tête relevée (m)'],
              ['cote_pied','Cote pied relevée (m)'],
              ['longueur_mesuree','Longueur mesurée (m)'],
              ['volume_fore','Volume foré (m³)'],
              ['volume_recepé','Volume recépé (m³)'],
            ].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 mb-1 block">{l}</label>
                <input type="number" step="0.001" value={mesureForm[k]}
                  onChange={e => setMesureForm(f => ({...f, [k]: e.target.value}))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Commentaire</label>
            <input value={mesureForm.commentaire} onChange={e => setMesureForm(f => ({...f, commentaire: e.target.value}))}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none"
              placeholder="Observations sur site…" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-slate-800 text-white text-xs py-1.5 rounded-lg">Enregistrer</button>
            <button type="button" onClick={() => setShowMesureForm(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Annuler</button>
          </div>
        </form>
      )}

      {mesures.length === 0 && !showMesureForm && (
        <div className="text-xs text-slate-300 text-center py-6">
          Aucun relevé — ajoutez le premier relevé pour démarrer le suivi
        </div>
      )}
    </div>
  )
}

// ── Panneau détail complet ────────────────────────────────────────
export default function DetailTabs({
  selected, mesures, comments, elements,
  editing, editVals, onEditChange,
  canEdit, isChef,
  newComment, setNewComment, handleComment,
  showRejet, setShowRejet, rejetMsg, setRejetMsg,
  handleSoumettre, handleValider, handleRejeter,
  showMesureForm, setShowMesureForm,
  mesureForm, setMesureForm, handleAddMesure,
}) {
  const [tab, setTab] = useState('donnees')

  const TABS = [
    { id: 'donnees',   label: 'Données'   },
    { id: 'sol',       label: 'Sol & Charges' },
    { id: 'liaisons',  label: 'Liaisons'  },
    { id: 'mesures',   label: `Relevés (${mesures.length})` },
    { id: 'comments',  label: `Comm. (${comments.length})` },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Onglets */}
      <div className="flex themed-border border-b px-3 pt-2 overflow-x-auto flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer mr-0.5 whitespace-nowrap`}
            style={{
              borderColor: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── DONNÉES ── */}
        {tab === 'donnees' && (
          <>
            {editing && (
              <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'var(--accent-soft)', color: 'var(--text-accent)', border: '1px solid var(--border-focus)' }}>
                ✏️ Mode édition — cliquez ✓ Sauver pour enregistrer
              </div>
            )}
            <Section label="Géométrie">
              <Grid2>
                <F label="Diamètre" field="diametre" unit="mm" type="number" value={selected.diametre ? `Ø${selected.diametre}mm` : null} {...{editing, editVals, onEditChange}} />
                <F label="Famille"  field="famille"            value={selected.famille} {...{editing, editVals, onEditChange}} />
                <F label="Coord X théo."   field="coord_x"         type="number" value={selected.coord_x}         {...{editing, editVals, onEditChange}} />
                <F label="Coord Y théo."   field="coord_y"         type="number" value={selected.coord_y}         {...{editing, editVals, onEditChange}} />
                <F label="Virole X"        field="coord_virole_x"  type="number" value={selected.coord_virole_x}  {...{editing, editVals, onEditChange}} />
                <F label="Virole Y"        field="coord_virole_y"  type="number" value={selected.coord_virole_y}  {...{editing, editVals, onEditChange}} />
                <F label="Altitude virole" field="coord_virole_z"  type="number" value={selected.coord_virole_z}  {...{editing, editVals, onEditChange}} />
                <F label="Semelle"         field="semelle_ref"                   value={selected.semelle_ref}      {...{editing, editVals, onEditChange}} />
              </Grid2>
            </Section>
            <Section label="Cotes (m)">
              <Grid2>
                <F label="BS théorique" field="cote_bs_theorique" type="number" value={selected.cote_bs_theorique} {...{editing, editVals, onEditChange}} />
                <F label="BS réelle"    field="cote_bs_reelle"    type="number" value={selected.cote_bs_reelle}    {...{editing, editVals, onEditChange}} />
                <F label="BI théorique" field="cote_bi_theorique" type="number" value={selected.cote_bi_theorique} {...{editing, editVals, onEditChange}} />
                <F label="BI réelle"    field="cote_bi_reelle"    type="number" value={selected.cote_bi_reelle}    {...{editing, editVals, onEditChange}} />
                <F label="L. théorique" field="longueur_theorique" type="number" value={selected.longueur_theorique} {...{editing, editVals, onEditChange}} />
                <F label="L. réelle"    field="longueur_reelle"    type="number" value={selected.longueur_reelle}    {...{editing, editVals, onEditChange}} />
              </Grid2>
            </Section>
            <Section label="Forage">
              <Grid2>
                <F label="Cote plancher"      field="cote_plancher"      type="number" value={selected.cote_plancher}      {...{editing, editVals, onEditChange}} />
                <F label="Cote recépée"       field="cote_recepee"       type="number" value={selected.cote_recepee}       {...{editing, editVals, onEditChange}} />
                <F label="Prof. toit rocher"  field="prof_toit_rocheux"  type="number" value={selected.prof_toit_rocheux}  {...{editing, editVals, onEditChange}} />
                <F label="Prof. roche totale" field="prof_roche"         type="number" value={selected.prof_roche}         {...{editing, editVals, onEditChange}} />
                <F label="Ancrage (m)"        field="ancrage"            type="number" value={selected.ancrage}            {...{editing, editVals, onEditChange}} />
                <F label="Altitude TN"        field="altitude_tn"        type="number" value={selected.altitude_tn}        {...{editing, editVals, onEditChange}} />
              </Grid2>
              {selected.date_forage && (
                <div className="mt-2 px-3 py-2 rounded-xl text-xs themed-secondary" style={{ background: 'var(--bg-hover)' }}>
                  📅 Foré le {new Date(selected.date_forage).toLocaleDateString('fr-FR')}
                </div>
              )}
            </Section>
            <Section label="Volumes (m³)">
              <Grid2>
                <F label="Budgétisé" field="volume_budgetise" type="number" value={selected.volume_budgetise} {...{editing, editVals, onEditChange}} />
                <F label="Foré"      field="volume_fore"      type="number" value={selected.volume_fore}      {...{editing, editVals, onEditChange}} />
                <F label="Recépé"    field="volume_recepé"    type="number" value={selected.volume_recepé}    {...{editing, editVals, onEditChange}} />
                <F label="Final"     field="volume_final"     type="number" value={selected.volume_final}     {...{editing, editVals, onEditChange}} />
              </Grid2>
              {selected.volume_budgetise && selected.volume_fore && (
                <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${selected.volume_fore > selected.volume_budgetise ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  Delta : {(selected.volume_fore - selected.volume_budgetise).toFixed(3)} m³ {selected.volume_fore > selected.volume_budgetise ? '(dépassement)' : '(OK)'}
                </div>
              )}
            </Section>
            <Section label="Statut & matériaux">
              <Grid2>
                {editing ? (
                  <div className="bg-white border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-500 uppercase tracking-wide mb-1">Statut chantier</div>
                    <select value={editVals.statut_element || ''} onChange={e => onEditChange('statut_element', e.target.value)}
                      className="w-full text-sm text-slate-800 bg-transparent border-none outline-none p-0">
                      {['À faire','En cours','Foré','Recépé','Validé'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                ) : (
                  <F label="Statut chantier" field="statut_element" value={selected.statut_element} edit={false} editVals={{}} onChange={() => {}} />
                )}
                <F label="Matériau" field="materiau" value={selected.materiau} {...{editing, editVals, onEditChange}} />
              </Grid2>
            </Section>
            {selected.commentaire_rejet && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <div className="text-xs font-medium text-red-600 mb-1">Motif de rejet</div>
                <div className="text-sm text-red-700">{selected.commentaire_rejet}</div>
              </div>
            )}
            {canEdit && !editing && (
              <Section label="Workflow">
                <div className="flex gap-2 flex-wrap">
                  {(selected.statut_validation === 'Brouillon' || selected.statut_validation === 'Rejeté') && (
                    <button onClick={handleSoumettre} className="px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-900">Soumettre</button>
                  )}
                  {isChef && selected.statut_validation === 'En revue' && (
                    <>
                      <button onClick={handleValider} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">✓ Valider</button>
                      <button onClick={() => setShowRejet(true)} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg">✗ Rejeter</button>
                    </>
                  )}
                  {selected.statut_validation === 'Validé' && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Validé</span>
                  )}
                </div>
                {showRejet && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <textarea value={rejetMsg} onChange={e => setRejetMsg(e.target.value)} rows={2}
                      className="w-full px-2 py-1.5 border border-red-200 rounded text-xs resize-none focus:outline-none" placeholder="Motif obligatoire…" />
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={handleRejeter} className="px-2.5 py-1 bg-red-600 text-white text-xs rounded">Confirmer</button>
                      <button onClick={() => setShowRejet(false)} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded">Annuler</button>
                    </div>
                  </div>
                )}
              </Section>
            )}
          </>
        )}

        {/* ── SOL & CHARGES ── */}
        {tab === 'sol' && (
          <>
            <Section label="Altitudes (m NGF)">
              <Grid2>
                <F label="TN local"       field="altitude_tn"          type="number" value={selected.altitude_tn}          {...{editing, editVals, onEditChange}} />
                <F label="Plateforme loc." field="altitude_plateforme"   type="number" value={selected.altitude_plateforme}   {...{editing, editVals, onEditChange}} />
              </Grid2>
              {(!selected.altitude_tn || !selected.altitude_plateforme) && (
                <div className="text-xs text-slate-400 mt-1">
                  Valeurs globales du projet utilisées si non renseignées localement.
                </div>
              )}
            </Section>
            <Section label="Sol global de l'élément">
              <div className="space-y-2">
                {editing ? (
                  <>
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <div className="text-xs text-blue-500 uppercase tracking-wide mb-1">Type de sol (synthèse)</div>
                      <input value={editVals.type_sol ?? ''} onChange={e => onEditChange('type_sol', e.target.value)}
                        className="w-full text-sm text-slate-800 bg-transparent border-none outline-none p-0" placeholder="ex: Argile molle puis sable" />
                    </div>
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <div className="text-xs text-blue-500 uppercase tracking-wide mb-1">Notes géotechniques</div>
                      <textarea value={editVals.description_sol ?? ''} onChange={e => onEditChange('description_sol', e.target.value)}
                        rows={3} className="w-full text-sm text-slate-800 bg-transparent border-none outline-none p-0 resize-none" placeholder="Notes libres…" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Type de sol</div>
                      <div className="text-sm font-medium text-slate-800">{selected.type_sol || '—'}</div>
                    </div>
                    {selected.description_sol && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes géotechniques</div>
                        <div className="text-xs text-slate-600">{selected.description_sol}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Section>
            <Section label="Couches géologiques détaillées">
              <CouchesGeo element={selected} canEdit={canEdit} />
            </Section>
            <Section label="Charges">
              <Charges selected={selected} editing={editing} editVals={editVals} onEditChange={onEditChange} />
            </Section>
          </>
        )}

        {/* ── LIAISONS ── */}
        {tab === 'liaisons' && (
          <LiaisonsTab element={selected} elements={elements} canEdit={canEdit} />
        )}

        {/* ── RELEVÉS & RECÉPAGE ── */}
        {tab === 'mesures' && (
          <RecepageTab
            selected={selected}
            mesures={mesures}
            canEdit={canEdit}
            showMesureForm={showMesureForm}
            setShowMesureForm={setShowMesureForm}
            mesureForm={mesureForm}
            setMesureForm={setMesureForm}
            handleAddMesure={handleAddMesure}
          />
        )}

        {/* ── COMMENTAIRES ── */}
        {tab === 'comments' && (
          <>
            {comments.length === 0 ? (
              <div className="text-xs text-slate-300 text-center py-6">Aucun commentaire</div>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-slate-600">
                      {c.auteur?.nom?.charAt(0)}
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">{c.auteur?.nom}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(c.created_at).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{c.texte}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              <div className="flex gap-2">
                <input value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                  placeholder="Écrire un commentaire…"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <button onClick={handleComment} className="px-3 py-2 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-900">↵</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Composants utilitaires ────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold themed-muted uppercase tracking-wider mb-2">{label}</div>
      {children}
    </div>
  )
}
function Grid2({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}
function F({ label, field, value, edit, editing, editVals, onChange, onEditChange, type = 'text', unit = '' }) {
  const isEdit = edit || editing
  const handleChange = onChange || onEditChange
  if (!isEdit) return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
      <div className="text-xs themed-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</div>
    </div>
  )
  return (
    <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--accent)' }}>
      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-accent)' }}>{label}{unit ? ` (${unit})` : ''}</div>
      <input type={type} step={type==='number'?'0.001':undefined} value={editVals[field]??''}
        onChange={e => handleChange(field, e.target.value)}
        className="w-full text-sm font-semibold bg-transparent border-none outline-none p-0" style={{ color: 'var(--text-primary)' }} placeholder="—" />
    </div>
  )
}
