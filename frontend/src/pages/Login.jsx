import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const DEMO = [
  { role: 'Chef de mission',    email: 'chef@smc.com',   pw: 'chef123'  },
  { role: 'Ingénieur de suivi', email: 'suivi@smc.com',  pw: 'suivi123' },
  { role: 'Ingénieur topo',     email: 'topo@smc.com',   pw: 'topo123'  },
  { role: 'Ingénieur civil',    email: 'civil@smc.com',  pw: 'civil123' },
  { role: "Maître d'ouvrage",   email: 'moa@smc.com',    pw: 'moa123'   },
]

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch {
      setError('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-xl mb-4">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">SMC v2</h1>
          <p className="text-sm text-slate-500 mt-1">Suivi de chantier · Fondations & Structure</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm mb-4">
          <h2 className="text-base font-medium text-slate-800 mb-5">Connexion</h2>
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="votre@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
              <input type="password" required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Comptes démo</p>
          <div className="space-y-1">
            {DEMO.map(d => (
              <button key={d.email} onClick={() => setForm({ email: d.email, password: d.pw })}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left">
                <span className="text-sm text-slate-700">{d.role}</span>
                <span className="text-xs text-slate-400 font-mono">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}