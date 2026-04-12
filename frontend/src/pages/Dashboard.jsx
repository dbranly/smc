import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import api from '../api'
import { useProjet } from '../ProjetContext'
import { useAuth } from '../AuthContext'

// ── Palette couleurs familles ─────────────────────────────────────
const FAM_COLORS = {
  F1: '#6366f1', F2: '#ec4899', F3: '#f97316',
  F4: '#14b8a6', F5: '#8b5cf6', F6: '#ef4444',
  FA: '#6366f1', FB: '#ec4899', FC: '#f97316',
  FD: '#14b8a6', FE: '#8b5cf6', FF: '#ef4444',
}
const STATUT_COLORS = {
  'À faire': '#cbd5e1', 'En cours': '#3b82f6', 'Foré': '#f59e0b',
  'Recépé': '#10b981', 'Validé': '#16a34a', 'Coulé': '#f59e0b', 'Décoffré': '#10b981',
}
const SEV_STYLE = {
  danger: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
}

// ── Composants ────────────────────────────────────────────────────
function KPI({ label, value, sub, color = 'text-slate-900', icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</div>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <div className={`text-2xl font-semibold ${color} mb-1`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-slate-700">{children}</h2>
      {action}
    </div>
  )
}

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>{children}</div>
}

const CustomTooltip = ({ active, payload, label, unit = 'm³' }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <div className="font-medium text-slate-700 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name} :</span>
          <span className="font-medium text-slate-800">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value} {unit}</span>
        </div>
      ))}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────
export default function Dashboard() {
  const { projetActif } = useProjet()
  const { isChef } = useAuth()
  const navigate = useNavigate()

  const [kpis, setKpis] = useState(null)
  const [courbe, setCourbe] = useState([])
  const [parFamille, setParFamille] = useState([])
  const [alertes, setAlertes] = useState([])
  const [semaines, setSemaines] = useState([])
  const [loading, setLoading] = useState(false)

  // Filtres
  const [granularite, setGranularite] = useState('semaine')
  const [filtreFamille, setFiltreFamille] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [vueVolume, setVueVolume] = useState('cumul')   // cumul | periode

  const familles = parFamille.map(f => f.famille)

  const load = async () => {
    if (!projetActif) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ granularite })
      if (filtreFamille) params.append('famille', filtreFamille)
      if (filtreType) params.append('type_element', filtreType)

      const [k, c, pf, al, sw] = await Promise.all([
        api.get(`/analytics/kpis/${projetActif.id}`),
        api.get(`/analytics/courbe-volumes/${projetActif.id}?${params}`),
        api.get(`/analytics/volumes-par-famille/${projetActif.id}`),
        api.get(`/analytics/alertes/${projetActif.id}`),
        api.get(`/analytics/avancement-semaines/${projetActif.id}`),
      ])
      setKpis(k.data); setCourbe(c.data); setParFamille(pf.data)
      setAlertes(al.data); setSemaines(sw.data)
    } catch (err) {
      console.error("Erreur chargement dashboard", err)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [projetActif?.id, granularite, filtreFamille, filtreType])

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/rapport/${projetActif.id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_SMC_${projetActif.nom.replace(/\s+/g, '_')}.pdf`
      a.click(); URL.revokeObjectURL(url)
    } catch { alert('Erreur lors de la génération du rapport') }
  }

  // CORRECTION ICI : Fermeture de la condition et return propre
  if (!projetActif) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Veuillez sélectionner un projet pour accéder au tableau de bord.
      </div>
    )
  }

  const vol = kpis?.volumes || {}
  const total = kpis?.total || 0

  // Données pour graphique par famille (barres)
  const familleChartData = parFamille.map(f => ({
    famille: f.famille,
    Budgétisé: f.vol_budgetise,
    Foré: f.vol_fore,
    Recépé: f.vol_recepé,
    delta: f.delta,
  }))

  // Données répartition statuts
  const statutData = kpis ? Object.entries(kpis.par_statut || {}).map(([s, n]) => ({
    statut: s, count: n,
    pct: total ? Math.round(n / total * 100) : 0,
    color: STATUT_COLORS[s] || '#94a3b8',
  })) : []

  return (
    <div className="p-5 max-w-7xl overflow-y-auto h-full">

      {/* ── En-tête projet ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{projetActif.nom}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {projetActif.client && <span className="text-sm text-slate-500">{projetActif.client}</span>}
            {projetActif.localisation && <span className="text-xs text-slate-400">{projetActif.localisation}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5">
            ↓ Rapport PDF
          </button>
          <select value={filtreFamille} onChange={e => setFiltreFamille(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
            <option value="">Toutes familles</option>
            {familles.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
            <option value="">Tous types</option>
            {['Pieu', 'Semelle', 'Poteau', 'Voile', 'Poutre', 'Dalle'].map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={granularite} onChange={e => setGranularite(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none">
            <option value="semaine">Par semaine</option>
            <option value="date">Par date</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Chargement…</div>
      ) : total === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🏗️</div>
          <div className="text-sm font-medium text-slate-600 mb-4">Aucun élément enregistré</div>
          <button onClick={() => navigate('/fondations')} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg">
            Aller aux Fondations →
          </button>
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            <KPI label="Éléments total" value={total} sub={`${Object.keys(kpis?.par_type || {}).length} types`} icon="🏗️" />
            <KPI label="Avancement global" value={`${kpis?.avancement_global || 0}%`} sub="Pondéré par statut" color="text-blue-600" icon="📈" />
            <KPI label="Volume budgétisé" value={`${vol.budgetise || 0} m³`} sub="Théorique cumulé" color="text-slate-700" icon="📐" />
            <KPI label="Volume foré" value={`${vol.fore || 0} m³`}
              sub={`${(vol.delta_fore || 0) >= 0 ? '+' : ''}${vol.delta_fore || 0} m³ vs budget`}
              color={(vol.delta_fore || 0) > 0 ? 'text-red-500' : 'text-emerald-600'} icon="⛏️" />
            <KPI label="Taux recépage" value={`${kpis?.taux_recepage || 0}%`}
              sub={`${kpis?.nb_recepés || 0} éléments recépés`}
              color={(kpis?.taux_recepage || 0) > 50 ? 'text-emerald-600' : 'text-amber-600'} icon="✂️" />
          </div>

          {/* ── Alertes ── */}
          {alertes.length > 0 && (
            <div className="mb-5">
              <SectionTitle>⚠️ Alertes ({alertes.length})</SectionTitle>
              <div className="space-y-2">
                {alertes.slice(0, 5).map((a, i) => {
                  const s = SEV_STYLE[a.severite] || SEV_STYLE.warning
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${s.bg} ${s.border}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span className={`text-xs ${s.text}`}>{a.message}</span>
                      </div>
                      <button onClick={() => navigate('/fondations')} className={`text-xs font-medium ${s.text} hover:underline`}>
                        Voir →
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Ligne 1 : Courbe volumes + Statuts ── */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="col-span-2">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Volumes dans le temps</SectionTitle>
                <div className="flex gap-1">
                  {[['cumul', 'Cumulé'], ['periode', 'Périodique']].map(([v, l]) => (
                    <button key={v} onClick={() => setVueVolume(v)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${vueVolume === v ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {courbe.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs text-slate-300">
                  Aucune mesure — ajoutez des relevés depuis les fiches éléments
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={courbe}>
                    <defs>
                      <linearGradient id="gFore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRecep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="periode" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" m³" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {vueVolume === 'cumul' ? (
                      <>
                        <Area type="monotone" dataKey="cumul_fore" name="Foré cumulé" stroke="#3b82f6" fill="url(#gFore)" strokeWidth={2} />
                        <Area type="monotone" dataKey="cumul_recepé" name="Recépé cumulé" stroke="#10b981" fill="url(#gRecep)" strokeWidth={2} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="volume_fore" name="Foré" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="volume_recepé" name="Recépé" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <SectionTitle>Statuts</SectionTitle>
              <div className="space-y-2.5">
                {statutData.map(s => (
                  <div key={s.statut}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-xs text-slate-600">{s.statut}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{s.count} <span className="text-slate-400 font-normal">({s.pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                {[
                  { label: 'Budgétisé', value: `${vol.budgetise || 0} m³`, color: 'text-slate-600' },
                  { label: 'Foré', value: `${vol.fore || 0} m³`, color: 'text-blue-600' },
                  { label: 'Recépé', value: `${vol.recepé || 0} m³`, color: 'text-emerald-600' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-xs text-slate-400">{r.label}</span>
                    <span className={`text-xs font-semibold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Delta</span>
                  <span className={`text-xs font-semibold ${(vol.delta_fore || 0) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {(vol.delta_fore || 0) >= 0 ? '+' : ''}{vol.delta_fore || 0} m³
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card>
              <SectionTitle>Volumes par famille / bloc</SectionTitle>
              {parFamille.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-slate-300">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={familleChartData} barGap={2} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="famille" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" m³" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Budgétisé" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Foré" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Recépé" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <SectionTitle>Activité hebdomadaire (mesures)</SectionTitle>
              {semaines.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-slate-300">Aucune mesure enregistrée</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={semaines} barGap={2} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="semaine" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unit="mesures" />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="avant_recepage" name="Avant recépage" fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="apres_recepage" name="Après recépage" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="controle" name="Contrôle" fill="#6366f1" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Card>
            <SectionTitle>Récapitulatif par famille</SectionTitle>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Famille', 'Éléments', 'Validés', 'Avancement', 'Budgétisé', 'Foré', 'Recépé', 'Delta', '% Foré'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parFamille.map((f, i) => (
                  <tr key={f.famille} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: FAM_COLORS[f.famille] || '#94a3b8' }} />
                        <span className="font-semibold text-slate-800">{f.famille}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{f.nb_total}</td>
                    <td className="px-3 py-2.5 text-emerald-600 font-medium">{f.nb_valides}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${f.taux_avancement}%` }} />
                        </div>
                        <span className="text-slate-600">{f.taux_avancement}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">{f.vol_budgetise} m³</td>
                    <td className="px-3 py-2.5 font-mono text-blue-600">{f.vol_fore} m³</td>
                    <td className="px-3 py-2.5 font-mono text-emerald-600">{f.vol_recepé} m³</td>
                    <td className={`px-3 py-2.5 font-mono font-medium ${f.delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {f.delta >= 0 ? '+' : ''}{f.delta} m³
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${f.pct_fore > 100 ? 'bg-red-50 text-red-700' : f.pct_fore > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {f.pct_fore}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Fondations', sub: `${kpis?.par_type?.Pieu || 0} pieux · ${kpis?.par_type?.Semelle || 0} semelles`, to: '/fondations', icon: '⬡', color: 'bg-slate-800' },
              { label: 'Gros œuvre', sub: `${kpis?.par_type?.Poteau || 0} poteaux · ${kpis?.par_type?.Voile || 0} voiles`, to: '/gros-oeuvre', icon: '▣', color: 'bg-slate-600' },
              { label: 'Finitions', sub: 'En construction', to: '/finitions', icon: '◈', color: 'bg-slate-300' },
            ].map(c => (
              <button key={c.to} onClick={() => navigate(c.to)}
                className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-400 transition-colors">
                <div className={`w-8 h-8 ${c.color} rounded-lg flex items-center justify-center text-white text-base mb-2`}>{c.icon}</div>
                <div className="text-sm font-semibold text-slate-800">{c.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}