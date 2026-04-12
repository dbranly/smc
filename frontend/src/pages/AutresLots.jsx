export function GrosOeuvre() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Gros œuvre</h1>
        <p className="text-sm text-slate-400 mt-0.5">Voiles, poteaux, poutres, dalles, escaliers</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <div className="text-4xl mb-4">▣</div>
        <div className="text-base font-medium text-slate-700 mb-2">Module en cours de développement</div>
        <div className="text-sm text-slate-400 mb-6">La même architecture que Fondations sera appliquée :<br/>vue plan, vue 3D, suivi des volumes, import Excel, export DXF.</div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-xs text-slate-500">
          Disponible prochainement
        </div>
      </div>
    </div>
  )
}

export function Finitions() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Finitions</h1>
        <p className="text-sm text-slate-400 mt-0.5">Revêtements, menuiseries, peintures, équipements</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <div className="text-4xl mb-4">◈</div>
        <div className="text-base font-medium text-slate-700 mb-2">Module en cours de développement</div>
        <div className="text-sm text-slate-400 mb-6">Ce module sera développé après la finalisation<br/>des modules Fondations et Gros œuvre.</div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-xs text-slate-500">
          Disponible prochainement
        </div>
      </div>
    </div>
  )
}