import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'
import api from '../api'
import { useProjet } from '../ProjetContext'
import { useAuth } from '../AuthContext'

const STATUT_COLORS = {
  'À faire': '#cbd5e1', 'En cours': '#60a5fa', 'Foré': '#f97316',
  'Recépé': '#a855f7', 'Validé': '#22c55e', 'Coulé': '#fbbf24', 'Décoffré': '#34d399',
}

function KPICard({ label, value, sub, accent = false, icon, trend }) {
  return (
    <div className="themed-card rounded-2xl p-5 border flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: accent ? 'var(--accent)' : 'var(--bg-hover)' }}>
            <span>{icon}</span>
          </div>
          <span className="text-xs font-semibold themed-muted uppercase tracking-wide">{label}</span>
        </div>
        {trend != null && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
          {value}
        </div>
        {sub && <div className="text-xs themed-muted mt-1">{sub}</div>}
      </div>
    </div>
  )
}

function ProgressRing({ pct, size = 80, stroke = 8, color = '#22c55e' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="themed-card border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="themed-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="themed-secondary">{p.name}</span>
          <span className="font-semibold ml-auto pl-3" style={{ color: 'var(--text-primary)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { projetActif } = useProjet()
  const { isChef } = useAuth()
  const navigate = useNavigate()
  const [kpis, setKpis]       = useState(null)
  const [courbeAll, setCourbeAll] = useState([])
  const [alertes, setAlertes] = useState([])
  const [semelles, setSemelles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prixM3, setPrixM3]   = useState(150000)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin]     = useState('')

  useEffect(() => {
    if (!projetActif) return
    setLoading(true)
    const id = projetActif.id
    Promise.all([
      api.get(`/api/analytics/kpis/${id}?prix_m3=${prixM3}`),
      api.get(`/api/analytics/courbe-hebdo/${id}?prix_m3=${prixM3}`),
      api.get(`/api/analytics/alertes/${id}`),
      api.get(`/api/analytics/recap-semelles/${id}`).catch(() => null),
    ]).then(([k, c, a, s]) => {
      setKpis(k.data)
      // Construire courbe aplatie avec tous les champs cumulés
      const pts = []
      ;(c.data.semaines || []).forEach(sem => {
        sem.jours?.forEach(j => {
          pts.push({
            date: j.date,
            jour: `${j.jour} ${j.date?.slice(8,10)}/${j.date?.slice(5,7)}/${j.date?.slice(2,4)}`,
            reel: j.reel, prevu: j.prevu,
            cumul_reel: j.cumul_reel, cumul_prevu: j.cumul_prevu,
            cumul_volume: j.cumul_volume, cumul_cout: j.cumul_cout,
            avancement_pct: j.avancement_pct, avancement_prevu_pct: j.avancement_prevu_pct,
          })
        })
      })
      setCourbeAll(pts)
      setAlertes(a.data)
      setSemelles(s?.data || null)
    }).finally(() => setLoading(false))
  }, [projetActif, prixM3])

  // Bornes disponibles dans les données
  const minDate = courbeAll[0]?.date || ''
  const maxDate = courbeAll[courbeAll.length - 1]?.date || ''

  // Initialiser dateDebut/dateFin sur la dernière semaine dès que les données arrivent
  useEffect(() => {
    if (courbeAll.length && !dateDebut && !dateFin) {
      const last7 = courbeAll.slice(-7)
      setDateDebut(last7[0]?.date || minDate)
      setDateFin(maxDate)
    }
  }, [courbeAll])

  // Filtrer la courbe selon la plage de dates choisie
  const courbe = (() => {
    if (!courbeAll.length) return []
    if (!dateDebut && !dateFin) return courbeAll
    return courbeAll.filter(p => {
      if (dateDebut && p.date < dateDebut) return false
      if (dateFin && p.date > dateFin) return false
      return true
    })
  })()

  // Raccourcis de période
  const setRange = (n) => {
    if (n === 'tout') { setDateDebut(minDate); setDateFin(maxDate); return }
    const all = courbeAll
    const slice = all.slice(-n)
    setDateDebut(slice[0]?.date || minDate)
    setDateFin(maxDate)
  }

  const lastPoint = courbeAll[courbeAll.length - 1]

  if (!projetActif) return (
    <div className="flex items-center justify-center h-full themed-muted text-sm">
      Sélectionnez un projet
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-full themed-muted text-sm gap-2">
      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      Chargement…
    </div>
  )

  const avancement = kpis?.pieux?.avancement_pct ?? kpis?.avancement_global ?? 0
  const nbPieux    = kpis?.pieux?.total ?? kpis?.par_type?.['Pieu'] ?? 0
  const nbRealises = kpis?.pieux?.realises ?? 0
  const volFore    = kpis?.volumes?.fore ?? 0
  const taux_rec   = kpis?.volumes?.taux_recepage ?? 0
  const cout       = kpis?.cout_global?.total_fcfa ?? 0
  const par_statut = kpis?.par_statut ?? {}
  const par_type   = kpis?.par_type ?? {}

  // Données donut statut
  const donutData = Object.entries(par_statut).map(([k, v]) => ({ name: k, value: v, color: STATUT_COLORS[k] || '#94a3b8' }))

  // Formatter FCFA
  const fcfa = (v) => v >= 1e9
    ? `${(v/1e9).toFixed(2)} Md FCFA`
    : v >= 1e6
    ? `${(v/1e6).toFixed(1)} M FCFA`
    : `${v.toLocaleString('fr-FR')} FCFA`

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-app)' }}>
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{projetActif.nom}</h1>
            <p className="text-sm themed-muted mt-0.5">
              {projetActif.localisation && <span>{projetActif.localisation} · </span>}
              {projetActif.client && <span>{projetActif.client} · </span>}
              <span>{kpis?.total ?? 0} éléments</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alertes.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                <span>⚠</span> {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
              </div>
            )}
            <button onClick={() => navigate('/fondations')}
              className="themed-btn-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all">
              Voir les fondations →
            </button>
          </div>
        </div>

        {/* Avancement + KPIs */}
        <div className="grid grid-cols-12 gap-4 mb-6">

          {/* Avancement global — grande carte */}
          <div className="col-span-12 md:col-span-4 themed-card rounded-2xl border p-6 flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <ProgressRing pct={avancement} size={96} stroke={10}
                color={avancement >= 80 ? '#22c55e' : avancement >= 40 ? '#f97316' : '#60a5fa'} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{avancement}%</span>
              </div>
            </div>
            <div>
              <div className="text-xs themed-muted uppercase tracking-wide font-semibold mb-1">Avancement</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {nbRealises} <span className="text-base font-normal themed-muted">/ {nbPieux}</span>
              </div>
              <div className="text-xs themed-muted mt-1">pieux réalisés</div>
              {/* Barre progression par statut */}
              <div className="flex h-2 rounded-full overflow-hidden mt-3 gap-px" style={{ width: 160 }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ width: `${(d.value / (kpis?.total || 1)) * 100}%`, background: d.color }}
                    title={`${d.name}: ${d.value}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs themed-muted">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4 KPI cards */}
          <div className="col-span-12 md:col-span-8 grid grid-cols-2 gap-4">
            {/* Décomposition par type */}
            <div className="themed-card rounded-2xl border p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📐</span>
                <span className="text-xs font-semibold themed-muted uppercase tracking-wide">Éléments</span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(par_type).map(([type, nb]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs themed-secondary">{type}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{nb}</span>
                  </div>
                ))}
              </div>
            </div>

            <KPICard label="Volume béton" value={`${volFore.toFixed(1)} m³`}
              sub={`Budgétisé : ${(kpis?.volumes?.budgetise ?? 0).toFixed(1)} m³`}
              icon="🪣" />

            <KPICard label="Taux recépage" value={`${taux_rec.toFixed(1)}%`}
              sub={`Vol. recépé : ${(kpis?.volumes?.recepé ?? 0).toFixed(1)} m³`}
              icon="✂️" />

            <KPICard label="Coût global" value={fcfa(cout)}
              sub={
                <div className="flex items-center gap-1.5 mt-1">
                  <span>Prix/m³ :</span>
                  <input type="number" value={prixM3} onChange={e => setPrixM3(Number(e.target.value))}
                    className="w-20 px-1.5 py-0.5 rounded text-xs themed-input border"
                    step="10000" min="0" />
                  <span>FCFA</span>
                </div>
              }
              icon="💰" />
          </div>
        </div>

        {/* Courbe d'activité — cumulée avec sélecteur période */}
        <div className="themed-card rounded-2xl border p-5 mb-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Activité — cumul</h2>
              <p className="text-xs themed-muted mt-0.5">Pieux réalisés vs prévus · cumul Jeu → Mer</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Raccourcis */}
              <div className="flex rounded-lg overflow-hidden themed-border border">
                {[[7,'7j'],[30,'30j'],['tout','Tout']].map(([v,l]) => (
                  <button key={l} onClick={() => setRange(v)}
                    className="px-3 py-1.5 text-xs font-medium transition-all cursor-pointer themed-hover themed-secondary">
                    {l}
                  </button>
                ))}
              </div>
              {/* Sélecteur de plage de dates */}
              <div className="flex items-center gap-1.5">
                <input type="date" value={dateDebut} min={minDate} max={dateFin || maxDate}
                  onChange={e => setDateDebut(e.target.value)}
                  className="themed-input px-2 py-1.5 border rounded-lg text-xs cursor-pointer" />
                <span className="themed-muted text-xs">→</span>
                <input type="date" value={dateFin} min={dateDebut || minDate} max={maxDate}
                  onChange={e => setDateFin(e.target.value)}
                  className="themed-input px-2 py-1.5 border rounded-lg text-xs cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Sous-KPIs du dernier point */}
          {lastPoint && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
                <div className="text-xs themed-muted uppercase tracking-wide mb-0.5">Avancement</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {lastPoint.avancement_pct}%
                  <span className="text-xs themed-muted font-normal ml-1">
                    (prévu {lastPoint.avancement_prevu_pct}%)
                  </span>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
                <div className="text-xs themed-muted uppercase tracking-wide mb-0.5">Volume cumulé</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {lastPoint.cumul_volume?.toFixed(1)} m³
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
                <div className="text-xs themed-muted uppercase tracking-wide mb-0.5">Coût cumulé</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {fcfa(lastPoint.cumul_cout || 0)}
                </div>
              </div>
            </div>
          )}

          {courbe.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={courbe} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPrevu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="jour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cumul_prevu" name="Prévu (cumul)" stroke="#60a5fa" strokeWidth={1.5}
                  strokeDasharray="4 2" fill="url(#gPrevu)" dot={false} />
                <Area type="monotone" dataKey="cumul_reel" name="Réalisé (cumul)" stroke="#22c55e" strokeWidth={2}
                  fill="url(#gReel)" dot={{ r: 3, fill: '#22c55e' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center themed-muted text-xs">
              Aucune donnée — importez les fiches de forage avec dates
            </div>
          )}
        </div>


        {/* Top semelles en retard / proches de la fin */}
        {semelles?.par_semelle?.length > 0 && (
          <div className="themed-card rounded-2xl border p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Groupes de semelle — aperçu
              </h2>
              <button onClick={() => navigate('/fondations')}
                className="text-xs themed-accent hover:opacity-70 cursor-pointer transition-opacity">
                Voir tout →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {semelles.par_semelle.slice(0, 6).map(s => (
                <div key={s.semelle_ref} className="flex items-center gap-3 px-3 py-2.5 rounded-xl themed-hover">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--text-accent)' }}>
                    {s.semelle_ref}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {s.nb_pieux} pieu{s.nb_pieux > 1 ? 'x' : ''}
                      </span>
                      <span className="text-xs themed-muted">{s.avancement_pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${s.avancement_pct}%`, background: s.avancement_pct === 100 ? '#22c55e' : 'var(--accent)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertes */}
        {alertes.length > 0 && (
          <div className="themed-card rounded-2xl border p-5">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Alertes ({alertes.length})
            </h2>
            <div className="space-y-2">
              {alertes.slice(0, 5).map((a, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border text-xs ${
                  a.severite === 'danger' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <span className="font-bold flex-shrink-0 mt-0.5">{a.severite === 'danger' ? '🔴' : '🟡'}</span>
                  <div>
                    <span className="font-mono font-semibold">{a.reference}</span>
                    <span className="ml-2">{a.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
