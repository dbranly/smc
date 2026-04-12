import { useEffect, useState, lazy, Suspense } from 'react'
import api from '../api'
import { useProjet } from '../ProjetContext'

const Vue3D = lazy(() => import('../components/Vue3D'))

export default function Maquette3D() {
  const { projetActif } = useProjet()
  const [elements, setElements] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!projetActif) return
    setLoading(true)
    setSelected(null)
    // Charge tous les lots d'un coup
    api.get(`/api/elements/?projet_id=${projetActif.id}`)
      .then(r => setElements(r.data))
      .finally(() => setLoading(false))
  }, [projetActif?.id])

  if (!projetActif) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Sélectionnez un projet dans la barre latérale
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex-shrink-0">
        <h1 className="text-base font-semibold text-slate-900">Maquette 3D</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {projetActif.nom} · {elements.length} éléments · tous lots
        </p>
      </div>

      {/* Vue 3D plein écran */}
      <div className="flex-1 p-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Chargement…
          </div>
        ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Chargement 3D…
            </div>
          }>
            <Vue3D
              elements={elements}
              selected={selected}
              onSelect={setSelected}
              colorBy="type"
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}