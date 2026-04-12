import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, GizmoHelper, GizmoViewcube, Grid } from '@react-three/drei'

// ── Couleurs ──────────────────────────────────────────────────────
const STATUT_COLORS = {
  'À faire':'#94a3b8','En cours':'#3b82f6','Foré':'#f59e0b',
  'Recépé':'#10b981','Validé':'#16a34a','Coulé':'#f59e0b','Décoffré':'#10b981',
}
const FAMILLE_COLORS = {
  F1:'#6366f1',F2:'#ec4899',F3:'#f97316',F4:'#14b8a6',
  F5:'#8b5cf6',F6:'#ef4444',F7:'#06b6d4',F8:'#64748b',F9:'#a16207',
}
const TYPE_COLORS = {
  Pieu:'#64748b', Semelle:'#b45309', Longrine:'#92400e',
  Poteau:'#1d4ed8', Voile:'#0f766e', Poutre:'#1e3a8a',
  Dalle:'#172554', Escalier:'#4c1d95', Autre:'#6b7280',
}
const LOT_COLORS = {
  'Fondations':'#0f172a','Gros œuvre':'#1e3a8a','Finitions':'#14532d',
}

// ── Rendu 3D par type ─────────────────────────────────────────────
function ElementMesh({ element, position, selected, onClick, showLabels, colorBy }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)
  const type = element.type_element

  const baseColor = colorBy === 'famille'
    ? (FAMILLE_COLORS[element.famille] || '#94a3b8')
    : colorBy === 'type'
    ? (TYPE_COLORS[type] || '#94a3b8')
    : (STATUT_COLORS[element.statut_element] || '#94a3b8')

  const color = selected ? '#ffffff' : baseColor

  useFrame(() => {
    if (!meshRef.current) return
    const t = (hovered || selected) ? 1.06 : 1
    meshRef.current.scale.x += (t - meshRef.current.scale.x) * 0.12
    meshRef.current.scale.z += (t - meshRef.current.scale.z) * 0.12
  })

  const handlers = {
    onClick: e => { e.stopPropagation(); onClick(element) },
    onPointerOver: e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { setHovered(false); document.body.style.cursor = 'auto' },
  }

  const labelBg = TYPE_COLORS[type] || '#1e293b'
  const label = showLabels && (
    <Html position={[0, 0.3, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
      <div style={{ background: selected ? '#1e293b' : labelBg, color: '#fff',
        padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace',
        fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
        {element.reference}
      </div>
    </Html>
  )

  // ── PIEU : cylindre vertical enfoncé dans le sol ──────────────────
  if (type === 'Pieu') {
    const r  = (element.diametre || 800) / 2000
    const bs = element.cote_bs_theorique ?? 0
    const bi = element.cote_bi_theorique ?? (bs - 1.2)
    const h  = Math.abs(bi - bs)
    const yC = bi + h / 2
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh ref={meshRef} castShadow receiveShadow>
          <cylinderGeometry args={[r, r * 1.02, h, 16]} />
          <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} opacity={0.88} transparent />
        </mesh>
        <mesh position={[0, h/2 - 0.03, 0]}>
          <cylinderGeometry args={[r*1.06, r, 0.07, 16]} />
          <meshStandardMaterial color={selected ? '#fff' : baseColor} roughness={0.3} />
        </mesh>
        {[0,1,2,3,4,5].map(i => {
          const a = (i/6)*Math.PI*2
          return <mesh key={i} position={[Math.cos(a)*r*0.75, h/2+0.05, Math.sin(a)*r*0.75]}>
            <cylinderGeometry args={[0.008,0.008,0.12,6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} />
          </mesh>
        })}
        {selected && <mesh position={[0,h/2+0.03,0]}>
          <torusGeometry args={[r*1.4,0.025,8,24]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} />
        </mesh>}
        <group position={[0, h/2+0.3, 0]}>{label}</group>
      </group>
    )
  }

  // ── SEMELLE : boîte plate légèrement enterrée sous sol ────────────
  if (type === 'Semelle') {
    const larg = element.largeur   || 1.4
    const long = element.longueur  || 2.5
    const ep   = element.epaisseur || 0.65
    // Légèrement sous le niveau sol (y=0 = plateforme)
    const yC   = -(ep / 2) - 0.10
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[larg, ep, long]} />
          <meshStandardMaterial color={color} roughness={0.7} opacity={0.88} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[larg+0.06,ep+0.06,long+0.06]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, ep/2+0.2, 0]}>{label}</group>
      </group>
    )
  }

  // ── LONGRINE : poutre basse horizontale, enterrée entre semelles ──
  if (type === 'Longrine') {
    const larg = element.largeur  || 0.30
    const long = element.longueur || 5.0
    const haut = element.hauteur  || 0.50
    const bs   = element.cote_bs_theorique ?? -0.50
    const yC   = bs - haut / 2  // positionnée à sa cote réelle
    // Orientation : si largeur > longueur → axe X, sinon axe Z
    const geoX = larg >= long ? larg : long
    const geoZ = larg >= long ? long : larg
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[geoX, haut, geoZ]} />
          <meshStandardMaterial color={color} roughness={0.7} opacity={0.9} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[geoX+0.05,haut+0.05,geoZ+0.05]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, haut/2+0.15, 0]}>{label}</group>
      </group>
    )
  }

  // ── RADIER : dalle épaisse de fondation, enterrée ─────────────────
  if (type === 'Radier') {
    const larg = element.largeur  || 5.0
    const long = element.longueur || 5.0
    const ep   = element.epaisseur || element.hauteur || 0.50
    const bs   = element.cote_bs_theorique ?? -0.60
    const yC   = bs - ep / 2
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[larg, ep, long]} />
          <meshStandardMaterial color={color} roughness={0.6} opacity={0.9} transparent />
        </mesh>
        {/* Hachures pour indiquer le béton armé */}
        <mesh position={[0, ep/2+0.01, 0]}>
          <boxGeometry args={[larg, 0.02, long]} />
          <meshStandardMaterial color={baseColor} roughness={0.9} opacity={0.5} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[larg+0.06,ep+0.06,long+0.06]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, ep/2+0.2, 0]}>{label}</group>
      </group>
    )
  }

  // ── POTEAU : prisme vertical posé sur sol ─────────────────────────
  if (type === 'Poteau') {
    const sec  = element.largeur  || 0.4
    const secZ = element.longueur || sec
    const h    = element.hauteur  || 3.8
    const yC   = h / 2  // base à y=0 (plateforme)
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh ref={meshRef} castShadow receiveShadow>
          <boxGeometry args={[sec, h, secZ]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} opacity={0.92} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[sec+0.06,h+0.06,secZ+0.06]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, h/2+0.25, 0]}>{label}</group>
      </group>
    )
  }

  // ── VOILE : panneau vertical mince ───────────────────────────────
  if (type === 'Voile') {
    const dims = [element.largeur, element.longueur, element.epaisseur].filter(v => v != null)
    const ep   = dims.length ? Math.min(...dims) : 0.18
    const long = dims.length >= 2 ? Math.max(...dims) : 3.0
    const h    = element.hauteur || 3.8
    const geoX = (element.largeur || 3.0) >= (element.longueur || 0.18) ? long : ep
    const geoZ = (element.largeur || 3.0) >= (element.longueur || 0.18) ? ep   : long
    return (
      <group position={[position.x, h/2, position.z]} {...handlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[geoX, h, geoZ]} />
          <meshStandardMaterial color={color} roughness={0.5} opacity={0.9} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[geoX+0.06,h+0.06,geoZ+0.06]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, h/2+0.25, 0]}>{label}</group>
      </group>
    )
  }

  // ── POUTRE : boîte horizontale posée en tête de poteau ───────────
  // La portée (grande dim) est horizontale, la section (petite dim) est verticale
  if (type === 'Poutre') {
    const dims  = [element.largeur, element.longueur].filter(v => v != null)
    const larg  = dims.length ? Math.min(...dims) : 0.30   // section larg
    const portee= dims.length >= 2 ? Math.max(...dims) : 9.0  // portée horiz
    const haut  = element.hauteur || 0.55                  // section haut
    // Posée en tête de poteau : y = hauteur_poteau - haut/2
    // hauteur_poteau est dans les données, sinon on estime selon famille
    const h_poteau = element.hauteur_poteau
      || (element.famille && ['F1','F4'].includes(element.famille) ? 4.50 : 3.80)
    const yC       = h_poteau - haut / 2
    // Orientation selon la grande dimension
    const isX  = (element.largeur || 0) >= (element.longueur || 0)
    const geoX = isX ? portee : larg
    const geoZ = isX ? larg   : portee
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[geoX, haut, geoZ]} />
          <meshStandardMaterial color={color} roughness={0.55} opacity={0.92} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[geoX+0.05,haut+0.05,geoZ+0.05]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, haut/2+0.15, 0]}>{label}</group>
      </group>
    )
  }

  // ── DALLE : dalle plate horizontale posée sur les poutres ─────────
  if (type === 'Dalle') {
    const larg = element.largeur  || 9.0
    const long = element.longueur || 6.0
    const ep   = element.epaisseur || element.hauteur || 0.15
    // Posée en tête de poteau, au-dessus des poutres
    const h_poteau = element.hauteur_poteau
      || (element.famille && ['F1','F4'].includes(element.famille) ? 4.50 : 3.80)
    const yC       = h_poteau + ep / 2   // dessus des poutres
    return (
      <group position={[position.x, yC, position.z]} {...handlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[larg, ep, long]} />
          <meshStandardMaterial color={color} roughness={0.8} opacity={0.88} transparent />
        </mesh>
        {selected && <mesh><boxGeometry args={[larg+0.06,ep+0.06,long+0.06]} />
          <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
        <group position={[0, ep/2+0.15, 0]}>{label}</group>
      </group>
    )
  }

  // ── FALLBACK : boîte générique ────────────────────────────────────
  const sec  = element.largeur  || 0.5
  const secZ = element.longueur || sec
  const h    = element.hauteur  || 1.0
  return (
    <group position={[position.x, h/2, position.z]} {...handlers}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[sec, h, secZ]} />
        <meshStandardMaterial color={color} roughness={0.6} opacity={0.85} transparent />
      </mesh>
      {selected && <mesh><boxGeometry args={[sec+0.06,h+0.06,secZ+0.06]} />
        <meshStandardMaterial color="#fff" wireframe opacity={0.4} transparent /></mesh>}
      <group position={[0, h/2+0.2, 0]}>{label}</group>
    </group>
  )
}

// ── Terrain ───────────────────────────────────────────────────────
function Terrain({ size, visible }) {
  if (!visible) return null
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[size*1.5, size*1.5]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.95} />
      </mesh>
      <Grid args={[size*1.5,size*1.5]} position={[0,0.003,0]}
        cellSize={1} cellThickness={0.3} cellColor="#cbd5e1"
        sectionSize={5} sectionThickness={0.7} sectionColor="#94a3b8"
        fadeDistance={size*2.5} fadeStrength={1} followCamera={false} infiniteGrid={false} />
    </>
  )
}

// ── Axes ──────────────────────────────────────────────────────────
function Axes({ size }) {
  const s = Math.min(size*0.12, 2.5)
  const Arrow = ({ dir, color, label }) => {
    const rot = dir==='x'?[0,0,-Math.PI/2]:dir==='z'?[Math.PI/2,0,0]:[0,0,0]
    const pos = dir==='x'?[s/2,0,0]:dir==='z'?[0,0,s/2]:[0,s/2,0]
    const cp  = dir==='x'?[s+0.15,0,0]:dir==='z'?[0,0,s+0.15]:[0,s+0.15,0]
    const lp  = dir==='x'?[s+0.45,0.05,0]:dir==='z'?[0,0.05,s+0.45]:[0.1,s+0.45,0]
    return <group>
      <mesh position={pos} rotation={rot}><cylinderGeometry args={[0.025,0.025,s,8]}/><meshBasicMaterial color={color}/></mesh>
      <mesh position={cp}  rotation={rot}><coneGeometry args={[0.07,0.22,8]}/><meshBasicMaterial color={color}/></mesh>
      <Html position={lp} center><span style={{color,fontWeight:800,fontSize:11,fontFamily:'monospace'}}>{label}</span></Html>
    </group>
  }
  return <group position={[-size*0.5,0.05,-size*0.5]}>
    <Arrow dir="x" color="#ef4444" label="X"/>
    <Arrow dir="y" color="#22c55e" label="Y"/>
    <Arrow dir="z" color="#3b82f6" label="Z"/>
  </group>
}

function CameraInit({ size }) {
  const { camera } = useThree()
  useEffect(() => { camera.position.set(size*0.55, size*0.45, size*0.75); camera.lookAt(0,0,0) }, [size])
  return null
}

// ── Scène ─────────────────────────────────────────────────────────
function Scene({ visibleElements, selected, onSelect, showLabels, colorBy, showSol, size, cx, cz }) {
  const toPos = e => ({ x: e.coord_x - cx, z: e.coord_y - cz })
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[size*0.7,size*1.1,size*0.5]} intensity={0.85} castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-left={-size} shadow-camera-right={size}
        shadow-camera-top={size} shadow-camera-bottom={-size} shadow-camera-far={size*6} />
      <directionalLight position={[-size*0.3,size*0.4,-size*0.3]} intensity={0.25} />
      <hemisphereLight args={['#dbeafe','#94a3b8',0.4]} />
      <Terrain size={size} visible={showSol} />
      <Axes size={size} />
      {visibleElements.map(e => (
        <ElementMesh key={e.id} element={e} position={toPos(e)}
          selected={selected?.id === e.id} onClick={onSelect}
          showLabels={showLabels} colorBy={colorBy} />
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.06}
        minDistance={0.5} maxDistance={size*5} target={[0,0,0]} />
      <GizmoHelper alignment="bottom-right" margin={[90,120]}>
        <GizmoViewcube color="#1e293b" textColor="#f1f5f9" hoverColor="#3b82f6"
          faces={['DROITE','GAUCHE','HAUT','BAS','AVANT','ARRIÈRE']} />
      </GizmoHelper>
      <CameraInit size={size} />
    </>
  )
}

// ── Checklist hiérarchique ────────────────────────────────────────
function Checklist({ structure, checked, onToggleLot, onToggleType }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm min-w-44">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Affichage</div>
      {Object.entries(structure).map(([lot, types]) => {
        const lotChecked  = Object.values(checked[lot] || {}).every(Boolean)
        const lotPartial  = !lotChecked && Object.values(checked[lot] || {}).some(Boolean)
        const totalLot    = Object.values(types).reduce((s, n) => s + n, 0)
        return (
          <div key={lot} className="mb-2">
            {/* Lot */}
            <label className="flex items-center gap-2 cursor-pointer select-none mb-1 group">
              <input type="checkbox" checked={lotChecked} ref={el => { if (el) el.indeterminate = lotPartial }}
                onChange={() => onToggleLot(lot)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-slate-700 cursor-pointer" />
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: LOT_COLORS[lot] || '#1e293b' }} />
              <span className="text-xs font-semibold text-slate-700 flex-1">{lot}</span>
              <span className="text-xs text-slate-400">{totalLot}</span>
            </label>
            {/* Types */}
            <div className="pl-5 space-y-0.5">
              {Object.entries(types).map(([type, nb]) => (
                nb > 0 && (
                  <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox"
                      checked={checked[lot]?.[type] ?? true}
                      onChange={() => onToggleType(lot, type)}
                      className="w-3 h-3 rounded border-slate-300 cursor-pointer" />
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[type] || '#94a3b8' }} />
                    <span className="text-xs text-slate-600 flex-1">{type}</span>
                    <span className="text-xs text-slate-400">{nb}</span>
                  </label>
                )
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Composant principal exporté ───────────────────────────────────
export default function Vue3D({ elements, selected, onSelect, colorBy = 'statut', extraElements = [], defaultLot = null }) {
  const [showLabels, setShowLabels] = useState(false)
  const [showSol,    setShowSol]    = useState(true)
  const [colorMode,  setColorMode]  = useState(colorBy)

  // Tous les éléments fusionnés
  const allElements = useMemo(() => {
    const all = [...elements, ...extraElements]
    const seen = new Set()
    return all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
  }, [elements, extraElements])

  const withCoords = allElements.filter(e => e.coord_x != null && e.coord_y != null)

  // Structure lots → types → count
  const structure = useMemo(() => {
    const s = {}
    withCoords.forEach(e => {
      const lot  = e.lot || 'Fondations'
      const type = e.type_element
      if (!s[lot]) s[lot] = {}
      s[lot][type] = (s[lot][type] || 0) + 1
    })
    return s
  }, [withCoords])

  // État des checkboxes — par défaut tout coché
  const [checked, setChecked] = useState(() => {
    const c = {}
    Object.entries(structure).forEach(([lot, types]) => {
      c[lot] = {}
      Object.keys(types).forEach(type => { c[lot][type] = true })
    })
    return c
  })

  // Sync si structure change (nouveaux éléments importés)
  useEffect(() => {
    setChecked(prev => {
      const next = { ...prev }
      Object.entries(structure).forEach(([lot, types]) => {
        if (!next[lot]) next[lot] = {}
        Object.keys(types).forEach(type => {
          if (next[lot][type] === undefined) next[lot][type] = true
        })
      })
      return next
    })
  }, [JSON.stringify(structure)])

  const onToggleLot = (lot) => {
    const allOn = Object.values(checked[lot] || {}).every(Boolean)
    setChecked(prev => ({
      ...prev,
      [lot]: Object.fromEntries(Object.keys(structure[lot]).map(t => [t, !allOn]))
    }))
  }

  const onToggleType = (lot, type) => {
    setChecked(prev => ({
      ...prev,
      [lot]: { ...(prev[lot] || {}), [type]: !(prev[lot]?.[type] ?? true) }
    }))
  }

  // Éléments visibles selon checklist
  const visibleElements = useMemo(() => withCoords.filter(e => {
    const lot  = e.lot || 'Fondations'
    const type = e.type_element
    return checked[lot]?.[type] ?? true
  }), [withCoords, checked])

  // Calcul bounds pour centrage
  const { size, cx, cz } = useMemo(() => {
    if (!withCoords.length) return { size: 10, cx: 0, cz: 0 }
    const xs = withCoords.map(e => e.coord_x)
    const zs = withCoords.map(e => e.coord_y)
    return {
      cx:   (Math.min(...xs)+Math.max(...xs))/2,
      cz:   (Math.min(...zs)+Math.max(...zs))/2,
      size: Math.max(Math.max(...xs)-Math.min(...xs), Math.max(...zs)-Math.min(...zs), 10),
    }
  }, [withCoords])

  if (!withCoords.length) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-200">
      Aucun élément avec coordonnées
    </div>
  )

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-200">
      <Canvas shadows gl={{ antialias: true }} style={{ background: '#f8fafc' }}>
        <Scene visibleElements={visibleElements} selected={selected} onSelect={onSelect}
          showLabels={showLabels} colorBy={colorMode} showSol={showSol}
          size={size} cx={cx} cz={cz} />
      </Canvas>

      {/* Checklist hiérarchique */}
      <div className="absolute top-3 left-3">
        <Checklist structure={structure} checked={checked}
          onToggleLot={onToggleLot} onToggleType={onToggleType} />
        {/* Options */}
        <div className="flex flex-col gap-1 mt-2">
          <button onClick={() => setShowLabels(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-colors ${showLabels ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Étiquettes
          </button>
          <button onClick={() => setShowSol(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-colors ${showSol ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Sol
          </button>
        </div>
      </div>

      {/* Mode couleur */}
      <div className="absolute top-3 right-24 bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
        <div className="text-xs font-medium text-slate-400 mb-1.5">Couleur</div>
        {[['statut','Statut'],['famille','Famille'],['type','Type']].map(([v,l]) => (
          <label key={v} className="flex items-center gap-2 cursor-pointer mb-1 last:mb-0">
            <input type="radio" name="colorMode" value={v} checked={colorMode===v}
              onChange={() => setColorMode(v)} className="w-3 h-3 cursor-pointer" />
            <span className="text-xs text-slate-600">{l}</span>
          </label>
        ))}
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
          {colorMode === 'statut' && Object.entries(STATUT_COLORS).map(([k,c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{background:c}}/>
              <span className="text-xs text-slate-500">{k}</span>
            </div>
          ))}
          {colorMode === 'famille' && Object.entries(FAMILLE_COLORS).map(([k,c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{background:c}}/>
              <span className="text-xs text-slate-500">{k}</span>
            </div>
          ))}
          {colorMode === 'type' && Object.entries(TYPE_COLORS).map(([k,c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{background:c}}/>
              <span className="text-xs text-slate-500">{k}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info élément sélectionné */}
      {selected && (
        <div className="absolute bottom-10 left-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="text-xs font-bold text-slate-800 font-mono mb-1.5">{selected.reference}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <span className="text-slate-400">Type</span><span className="text-slate-700 font-medium">{selected.type_element}</span>
            <span className="text-slate-400">Lot</span><span className="text-slate-700">{selected.lot}</span>
            {selected.famille && <><span className="text-slate-400">Famille</span><span className="text-slate-700">{selected.famille}</span></>}
            {selected.diametre && <><span className="text-slate-400">Ø</span><span className="font-mono text-slate-700">{selected.diametre}mm</span></>}
            {selected.cote_bs_theorique != null && <><span className="text-slate-400">BS</span><span className="font-mono text-slate-700">{selected.cote_bs_theorique}m</span></>}
            {selected.cote_bi_theorique != null && <><span className="text-slate-400">BI</span><span className="font-mono text-slate-700">{selected.cote_bi_theorique}m</span></>}
            {selected.hauteur && <><span className="text-slate-400">Hauteur</span><span className="font-mono text-slate-700">{selected.hauteur}m</span></>}
            {selected.volume_budgetise && <><span className="text-slate-400">Vol.</span><span className="font-mono text-slate-700">{selected.volume_budgetise}m³</span></>}
            <span className="text-slate-400">Statut</span><span className="text-slate-700">{selected.statut_element}</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-white/90 px-2.5 py-1.5 rounded-lg border border-slate-100">
        Clic = sélectionner · Molette = zoom · Glisser = orbiter
      </div>
    </div>
  )
}