import { useState, useRef, useCallback, useEffect } from 'react'
import { useTransparentSrc } from '../../hooks/useTransparentImage'
import './SymbolEditor.css'

const PREVIEW_MAX = 260
const BORNE_R = 7

export default function SymbolEditor({ symbol, onSave, onDelete, onClose }) {
  const [name,           setName]           = useState(symbol.name)
  const [type,           setType]           = useState(symbol.type)
  const [width,          setWidth]          = useState(symbol.displayWidth)
  const [height,         setHeight]         = useState(symbol.displayHeight)
  const [labelPrefix,    setLabelPrefix]    = useState(symbol.labelPrefix    || '')
  const [defaultRotation,setDefaultRotation]= useState(symbol.defaultRotation ?? 0)
  const [bornes,         setBornes]         = useState(symbol.bornes.map(b => ({ ...b })))
  const [dragging, setDragging] = useState(null) // { index }
  const [selectedBorne, setSelectedBorne] = useState(null)
  const previewRef = useRef(null)

  const W = Number(width)  || 80
  const H = Number(height) || 80
  const transparentSrc = useTransparentSrc(symbol.pngPath)
  const scale = Math.min(PREVIEW_MAX / W, PREVIEW_MAX / H, 2)
  const previewW = Math.round(W * scale)
  const previewH = Math.round(H * scale)

  const borneColor = type === 'HTA' ? '#dc2626' : '#2563eb'

  const setBorne = (i, field, val) =>
    setBornes(prev => prev.map((b, idx) =>
      idx === i ? { ...b, [field]: field === 'name' ? val : Number(val) } : b
    ))

  const addBorne = () =>
    setBornes(prev => [...prev, { x: Math.round(W / 2), y: 0, name: String.fromCharCode(65 + prev.length) }])

  const removeBorne = (i) =>
    setBornes(prev => prev.filter((_, idx) => idx !== i))

  // ── Drag logic ────────────────────────────────────────────────────────────

  const handleBorneMouseDown = useCallback((e, i) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedBorne(i)
    setDragging({ index: i })
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (dragging === null) return
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = Math.round(Math.max(0, Math.min(W, (e.clientX - rect.left) / scale)))
    const py = Math.round(Math.max(0, Math.min(H, (e.clientY - rect.top)  / scale)))
    setBorne(dragging.index, 'x', px)
    setBorne(dragging.index, 'y', py)
  }, [dragging, scale, W, H])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup',   handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup',   handleMouseUp)
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    onSave({ ...symbol, name, type, displayWidth: W, displayHeight: H, labelPrefix, defaultRotation, bornes })
    onClose()
  }

  return (
    <div className="sym-editor-overlay" onClick={onClose}>
      <div className="sym-editor" onClick={e => e.stopPropagation()}>
        <div className="sym-editor-header">
          <span>Configurer le symbole</span>
          <button className="sym-editor-close" onClick={onClose}>✕</button>
        </div>

        <div className="sym-editor-body">
          <label>Nom
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label>Type
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="BT">BT</option>
              <option value="HTA">HTA</option>
              <option value="POSTE">POSTE</option>
            </select>
          </label>

          <label>Préfixe de référence
            <input
              value={labelPrefix}
              onChange={e => setLabelPrefix(e.target.value)}
              placeholder="ex : IAB, TCB…"
              maxLength={10}
            />
          </label>

          <label>Orientation par défaut</label>
          <div className="sym-editor-rotation-picker">
            {/* Dial interactif */}
            <div
              className="sym-editor-rotation-dial"
              title="Cliquez ou faites glisser pour tourner"
              onMouseDown={e => {
                const dial = e.currentTarget.getBoundingClientRect()
                const cx = dial.left + dial.width  / 2
                const cy = dial.top  + dial.height / 2
                const compute = (ex, ey) => {
                  const angle = Math.round(Math.atan2(ex - cx, -(ey - cy)) * 180 / Math.PI)
                  setDefaultRotation(((angle % 360) + 360) % 360)
                }
                compute(e.clientX, e.clientY)
                const onMove = ev => compute(ev.clientX, ev.clientY)
                const onUp   = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup',   onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup',   onUp)
              }}
            >
              <svg width="64" height="64" viewBox="0 0 64 64">
                {/* Cercle de fond */}
                <circle cx="32" cy="32" r="30" fill="#f0f4ff" stroke="#c7d2fe" strokeWidth="1.5"/>
                {/* Marqueurs 0/90/180/270 */}
                {[0,90,180,270].map(d => {
                  const r = Math.PI * d / 180
                  return <line key={d}
                    x1={32 + 22 * Math.sin(r)} y1={32 - 22 * Math.cos(r)}
                    x2={32 + 28 * Math.sin(r)} y2={32 - 28 * Math.cos(r)}
                    stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round"/>
                })}
                {/* Aiguille */}
                <line
                  x1="32" y1="32"
                  x2={32 + 20 * Math.sin(defaultRotation * Math.PI / 180)}
                  y2={32 - 20 * Math.cos(defaultRotation * Math.PI / 180)}
                  stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"
                />
                {/* Flèche au bout */}
                <circle
                  cx={32 + 20 * Math.sin(defaultRotation * Math.PI / 180)}
                  cy={32 - 20 * Math.cos(defaultRotation * Math.PI / 180)}
                  r="3.5" fill="#2563eb"
                />
                {/* Centre */}
                <circle cx="32" cy="32" r="3" fill="#1d4ed8"/>
              </svg>
            </div>

            {/* Boutons raccourcis */}
            <div className="sym-editor-rotation-presets">
              {[0, 90, 180, 270].map(deg => (
                <button
                  key={deg}
                  type="button"
                  className={`sym-editor-preset-btn${defaultRotation === deg ? ' active' : ''}`}
                  onClick={() => setDefaultRotation(deg)}
                >{deg}°</button>
              ))}
            </div>

            {/* Champ numérique */}
            <div className="sym-editor-rotation-input-wrap">
              <input
                type="number"
                min="0" max="359"
                value={defaultRotation}
                onChange={e => {
                  const v = ((Number(e.target.value) % 360) + 360) % 360
                  setDefaultRotation(isNaN(v) ? 0 : v)
                }}
                className="sym-editor-rotation-input"
              />
              <span className="sym-editor-rotation-unit">°</span>
            </div>
          </div>

          <div className="sym-editor-row">
            <label>Largeur (px)
              <input type="number" value={width} min={20} max={300} onChange={e => setWidth(e.target.value)} />
            </label>
            <label>Hauteur (px)
              <input type="number" value={height} min={20} max={300} onChange={e => setHeight(e.target.value)} />
            </label>
          </div>

          {/* ── Visual borne editor ────────────────────────────────────────── */}
          <div className="sym-editor-bornes-title">
            Bornes de connexion
            <button className="sym-editor-add-borne" onClick={addBorne}>+ Ajouter</button>
          </div>

          <div className="sym-editor-preview-wrap">
            {/* Conteneur externe fixe — sert de référence pour le drag des bornes */}
            <div
              ref={previewRef}
              className="sym-editor-preview"
              style={{ width: previewW, height: previewH, cursor: dragging !== null ? 'grabbing' : 'default', overflow: 'visible' }}
            >
              {/* Conteneur interne rotatif */}
              <div style={{
                width: previewW, height: previewH,
                transform: `rotate(${defaultRotation}deg)`,
                transition: 'transform 0.2s ease',
                transformOrigin: 'center center',
                position: 'relative',
              }}>
                <img
                  src={transparentSrc}
                  draggable={false}
                  style={{ width: previewW, height: previewH, display: 'block', userSelect: 'none' }}
                  alt={name}
                />
                {bornes.map((b, i) => (
                  <div
                    key={i}
                    className="sym-editor-borne-dot"
                    style={{
                      left:   b.x * scale - BORNE_R,
                      top:    b.y * scale - BORNE_R,
                      width:  BORNE_R * 2,
                      height: BORNE_R * 2,
                      borderColor: borneColor,
                      background: (dragging?.index === i || selectedBorne === i) ? borneColor : 'white',
                      cursor: 'grab',
                    }}
                    title={b.name}
                    onMouseDown={e => handleBorneMouseDown(e, i)}
                  />
                ))}
              </div>
            </div>
            <p className="sym-editor-preview-hint">Glissez les points de connexion sur l'image</p>
          </div>

          {/* ── Numeric fallback rows ─────────────────────────────────────── */}
          {bornes.map((b, i) => (
            <div
              key={i}
              className={`sym-editor-borne-row${selectedBorne === i ? ' selected' : ''}`}
              onClick={() => setSelectedBorne(i)}
            >
              <label>Nom
                <input value={b.name} onChange={e => setBorne(i, 'name', e.target.value)} style={{ width: 40 }} />
              </label>
              <label>X
                <input type="number" value={b.x} onChange={e => setBorne(i, 'x', e.target.value)} style={{ width: 55 }} />
              </label>
              <label>Y
                <input type="number" value={b.y} onChange={e => setBorne(i, 'y', e.target.value)} style={{ width: 55 }} />
              </label>
              <button className="sym-editor-remove-borne" onClick={() => removeBorne(i)} title="Supprimer">✕</button>
            </div>
          ))}
        </div>

        <div className="sym-editor-footer">
          <button className="sym-editor-btn danger" onClick={() => { onDelete(symbol.id); onClose() }}>
            Supprimer le symbole
          </button>
          <div style={{ flex: 1 }} />
          <button className="sym-editor-btn" onClick={onClose}>Annuler</button>
          <button className="sym-editor-btn primary" onClick={handleSave}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
