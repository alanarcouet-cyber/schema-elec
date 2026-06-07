import { useState, useRef, useCallback, useEffect } from 'react'
import { useTransparentSrc } from '../../hooks/useTransparentImage'
import './SymbolEditor.css'

const PREVIEW_MAX = 260
const BORNE_R = 7

export default function SymbolEditor({ symbol, onSave, onDelete, onClose }) {
  const [name,        setName]        = useState(symbol.name)
  const [type,        setType]        = useState(symbol.type)
  const [width,       setWidth]       = useState(symbol.displayWidth)
  const [height,      setHeight]      = useState(symbol.displayHeight)
  const [labelPrefix, setLabelPrefix] = useState(symbol.labelPrefix || '')
  const [bornes,      setBornes]      = useState(symbol.bornes.map(b => ({ ...b })))
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
    onSave({ ...symbol, name, type, displayWidth: W, displayHeight: H, labelPrefix, bornes })
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
            <div
              ref={previewRef}
              className="sym-editor-preview"
              style={{ width: previewW, height: previewH, cursor: dragging !== null ? 'grabbing' : 'default' }}
            >
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
