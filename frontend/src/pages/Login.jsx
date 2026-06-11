import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await login(form.email, form.password); navigate('/') }
    catch { setError('Email ou mot de passe incorrect') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-app)' }}>

      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--accent)', color: 'var(--text-active)' }}>
        {/* Texture de fond */}
        <div className="absolute inset-0 opacity-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute border rounded-full"
              style={{
                width: `${120 + i * 60}px`, height: `${120 + i * 60}px`,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                borderColor: 'currentColor',
              }} />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold tracking-tight">SMC</span>
          </div>
          <p className="text-sm opacity-60">Suivi Massifs & Chantier</p>
        </div>

        <div className="relative z-10">
          <blockquote className="text-2xl font-light leading-relaxed opacity-90 mb-6">
            "Chaque pieu foré, chaque cote mesurée — tout en un seul endroit."
          </blockquote>
          <div className="flex items-center gap-4 text-sm opacity-60">
            <div className="flex items-center gap-2">
              <span>◉</span><span>Fondations</span>
            </div>
            <div className="flex items-center gap-2">
              <span>▣</span><span>Gros œuvre</span>
            </div>
            <div className="flex items-center gap-2">
              <span>◈</span><span>Maquette 3D</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center themed-btn-primary">
              <span className="font-bold text-lg">S</span>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>SMC</div>
              <div className="text-xs themed-muted">Suivi Massifs & Chantier</div>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Connexion
            </h1>
            <p className="text-sm themed-muted">Accédez à votre espace de suivi de chantier</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="themed-input w-full px-4 py-3 border rounded-xl text-sm transition-all"
                placeholder="votre@email.com" />
            </div>

            <div>
              <label className="block text-xs font-semibold themed-secondary mb-1.5 uppercase tracking-wide">
                Mot de passe
              </label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="themed-input w-full px-4 py-3 pr-11 border rounded-xl text-sm transition-all"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 themed-muted hover:opacity-80 transition-opacity cursor-pointer text-lg"
                  tabIndex={-1}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="themed-btn-primary w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : 'Se connecter →'}
            </button>
          </form>

          <div className="mt-6 pt-6 themed-border border-t">
            <p className="text-xs themed-muted mb-3 uppercase tracking-wide font-medium">Comptes démo</p>
            <div className="space-y-1">
              {[
                { role: 'Chef de mission',    email: 'chef@smc.com',   pw: 'chef123'  },
                { role: 'Ing. Suivi',         email: 'suivi@smc.com',  pw: 'suivi123' },
                { role: "Rachelle SIMO",   email: 'admin@smc.app',    pw: 'ChangeMe2025!'   },
              ].map(d => (
                <button key={d.email} onClick={() => setForm({ email: d.email, password: d.pw })}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg themed-hover transition-all cursor-pointer text-left">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{d.role}</span>
                  <span className="text-xs themed-muted font-mono">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
