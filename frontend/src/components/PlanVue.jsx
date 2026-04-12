import { useRef, useState, useEffect, useCallback } from 'react'

const STATUT_COLORS = {
  'À faire':  '#94a3b8',
  'En cours': '#3b82f6',
  'Foré':     '#f59e0b',
  'Recépé':   '#10b981',
  'Validé':   '#16a34a',
}

const FAMILLE_COLORS = {
  F1: '#6366f1', F2: '#ec4899', F3: '#f97316',
  F4: '#14b8a6', F5: '#8b5cf6', F6: '#ef4444',
  F7: '#06b6d4', F8: '#64748b', F9: '#a16207',
}

export default function PlanVue({ elements, onSelect, selected, colorBy = 'statut' }) {
  const canvasRef = useRef(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [hovered, setHovered] = useState(null)

  // Calcul des bounds des coordonnées
  const pieux = elements.filter(e => e.coord_x && e.coord_y)

  const bounds = useCallback(() => {
    if (pieux.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const xs = pieux.map(e => e.coord_x)
    const ys = pieux.map(e => e.coord_y)
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    }
  }, [pieux])

  // Init transform pour centrer le plan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pieux.length === 0) return
    const b = bounds()
    const W = canvas.width, H = canvas.height
    const rangeX = b.maxX - b.minX || 1
    const rangeY = b.maxY - b.minY || 1
    const scale = Math.min((W - 80) / rangeX, (H - 80) / rangeY) * 0.9
    const cx = W / 2 - ((b.minX + b.maxX) / 2 - b.minX) * scale
    const cy = H / 2 - ((b.minY + b.maxY) / 2 - b.minY) * scale
    setTransform({ x: cx - (b.minX * scale) + 40, y: cy - (b.minY * scale) + 40, scale })
  }, [pieux.length])

  const worldToCanvas = useCallback((wx, wy) => ({
    x: wx * transform.scale + transform.x,
    y: wy * transform.scale + transform.y,
  }), [transform])

  const canvasToWorld = useCallback((cx, cy) => ({
    x: (cx - transform.x) / transform.scale,
    y: (cy - transform.y) / transform.scale,
  }), [transform])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fond
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grille
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 0.5
    const gridStep = Math.round(5 / transform.scale) * transform.scale
    const startX = Math.floor(-transform.x / transform.scale / 5) * 5
    const startY = Math.floor(-transform.y / transform.scale / 5) * 5
    for (let wx = startX; wx < startX + canvas.width / transform.scale + 10; wx += 5) {
      const { x } = worldToCanvas(wx, 0)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let wy = startY; wy < startY + canvas.height / transform.scale + 10; wy += 5) {
      const { y } = worldToCanvas(0, wy)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    // Pieux
    const r = Math.max(4, Math.min(12, transform.scale * 0.4))

    pieux.forEach(e => {
      const { x, y } = worldToCanvas(e.coord_x, e.coord_y)
      if (x < -20 || x > canvas.width + 20 || y < -20 || y > canvas.height + 20) return

      const isSelected = selected?.id === e.id
      const isHovered  = hovered?.id === e.id
      const color = colorBy === 'famille'
        ? (FAMILLE_COLORS[e.famille] || '#94a3b8')
        : (STATUT_COLORS[e.statut_element] || '#94a3b8')

      // Ombre si sélectionné
      if (isSelected) {
        ctx.shadowColor = color
        ctx.shadowBlur = 12
      }

      // Cercle extérieur
      ctx.beginPath()
      ctx.arc(x, y, r + (isSelected ? 3 : isHovered ? 1.5 : 0), 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? color : 'white'
      ctx.strokeStyle = color
      ctx.lineWidth = isSelected ? 2.5 : 1.5
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0

      // Point intérieur
      if (!isSelected) {
        ctx.beginPath()
        ctx.arc(x, y, r * 0.45, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }

      // Label si zoom suffisant
      if (transform.scale > 8) {
        ctx.fillStyle = isSelected ? 'white' : '#334155'
        ctx.font = `${Math.min(9, r * 0.8)}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(e.reference, x, y + r + 2)
      }
    })
  }, [pieux, transform, selected, hovered, colorBy, worldToCanvas])

  useEffect(() => { draw() }, [draw])

  const getElementAt = useCallback((cx, cy) => {
    const r = Math.max(8, Math.min(16, transform.scale * 0.6))
    const { x: wx, y: wy } = canvasToWorld(cx, cy)
    return pieux.find(e => {
      if (!e.coord_x || !e.coord_y) return false
      return Math.sqrt((e.coord_x - wx) ** 2 + (e.coord_y - wy) ** 2) < r / transform.scale
    })
  }, [pieux, transform, canvasToWorld])

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    if (dragging && dragStart) {
      setTransform(t => ({ ...t, x: t.x + (e.clientX - dragStart.x), y: t.y + (e.clientY - dragStart.y) }))
      setDragStart({ x: e.clientX, y: e.clientY })
    } else {
      const elem = getElementAt(cx, cy)
      setHovered(elem || null)
      canvasRef.current.style.cursor = elem ? 'pointer' : 'grab'
    }
  }, [dragging, dragStart, getElementAt])

  const handleMouseDown = useCallback((e) => {
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    const moved = Math.abs(e.clientX - dragStart?.x) + Math.abs(e.clientY - dragStart?.y)
    if (moved < 5) {
      const elem = getElementAt(e.clientX - rect.left, e.clientY - rect.top)
      if (elem) onSelect(elem)
    }
    setDragging(false)
    setDragStart(null)
  }, [dragging, dragStart, getElementAt, onSelect])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.85 : 1.18
    setTransform(t => {
      const newScale = Math.max(0.5, Math.min(60, t.scale * delta))
      return {
        scale: newScale,
        x: cx - (cx - t.x) * (newScale / t.scale),
        y: cy - (cy - t.y) * (newScale / t.scale),
      }
    })
  }, [])

  const resetView = () => {
    const canvas = canvasRef.current
    if (!canvas || pieux.length === 0) return
    const b = bounds()
    const W = canvas.width, H = canvas.height
    const scale = Math.min((W - 80) / (b.maxX - b.minX || 1), (H - 80) / (b.maxY - b.minY || 1)) * 0.9
    setTransform({
      x: W / 2 - (b.minX + (b.maxX - b.minX) / 2) * scale,
      y: H / 2 - (b.minY + (b.maxY - b.minY) / 2) * scale,
      scale,
    })
  }

  return (
    <div className="relative w-full h-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
      <canvas
        ref={canvasRef}
        width={800} height={560}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(false); setHovered(null) }}
        onWheel={handleWheel}
      />

      {/* Tooltip */}
      {hovered && (
        <div className="absolute top-3 left-3 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm pointer-events-none">
          <div className="text-xs font-semibold text-slate-800 font-mono">{hovered.reference}</div>
          <div className="text-xs text-slate-500">{hovered.famille} · {hovered.statut_element}</div>
          {hovered.diametre && <div className="text-xs text-slate-400">Ø{hovered.diametre}mm</div>}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={() => setTransform(t => ({ ...t, scale: t.scale * 1.3 }))}
          className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-bold shadow-sm">+</button>
        <button onClick={() => setTransform(t => ({ ...t, scale: t.scale * 0.77 }))}
          className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-bold shadow-sm">−</button>
        <button onClick={resetView}
          className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 text-xs shadow-sm">⊙</button>
      </div>

      {/* Légende */}
      <div className="absolute top-3 right-3 bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
        <div className="text-xs font-medium text-slate-400 mb-1.5">
          {colorBy === 'famille' ? 'Familles' : 'Statut'}
        </div>
        {colorBy === 'statut'
          ? Object.entries(STATUT_COLORS).map(([s, c]) => (
              <div key={s} className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span className="text-xs text-slate-600">{s}</span>
              </div>
            ))
          : Object.entries(FAMILLE_COLORS).map(([f, c]) => (
              <div key={f} className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span className="text-xs text-slate-600">{f}</span>
              </div>
            ))
        }
      </div>

      {/* Info zoom */}
      <div className="absolute bottom-3 left-3 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded">
        Zoom: {Math.round(transform.scale * 100)}% · {pieux.length} éléments · Molette = zoom · Glisser = déplacer
      </div>
    </div>
  )
}