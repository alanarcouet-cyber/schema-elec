import { useRef, useState, useCallback } from 'react'
import PaletteItem from './PaletteItem'
import './Palette.css'

export default function Palette({ symbols, onAddSymbol, onConfigureSymbol, onReorderSymbols }) {
  const fileRef      = useRef(null)
  const insertPosRef = useRef(null)   // ref pour éviter closure périmée dans handleDrop
  const [dragIdx,    setDragIdx]    = useState(null)
  const [overIdx,    setOverIdx]    = useState(null)
  const [insertPos,  setInsertPos]  = useState(null)  // gardé pour l'affichage des lignes

  const handleDragStart = useCallback((e, index, symbolId) => {
    e.dataTransfer.setData('symbolId', symbolId)
    e.dataTransfer.setData('paletteindex', String(index))
    e.dataTransfer.effectAllowed = 'copyMove'
    setDragIdx(index)
  }, [])

  const handleDragOver = useCallback((e, index) => {
    if (!e.dataTransfer.types.includes('paletteindex')) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const pos  = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    insertPosRef.current = pos   // toujours à jour, lu directement dans handleDrop
    setOverIdx(index)
    setInsertPos(pos)
  }, [])

  const handleDragEnd = useCallback(() => {
    insertPosRef.current = null
    setDragIdx(null)
    setOverIdx(null)
    setInsertPos(null)
  }, [])

  const handleDrop = useCallback((e, index) => {
    e.preventDefault()
    e.stopPropagation()
    const raw = e.dataTransfer.getData('paletteindex')
    if (raw === '') return
    const srcIdx = parseInt(raw, 10)
    if (isNaN(srcIdx)) return

    // Lire la ref, pas le state (pas de closure périmée)
    let destIdx = index
    if (insertPosRef.current === 'after') destIdx = index + 1
    if (srcIdx < destIdx) destIdx -= 1
    if (srcIdx !== destIdx) onReorderSymbols(srcIdx, destIdx)

    insertPosRef.current = null
    setDragIdx(null)
    setOverIdx(null)
    setInsertPos(null)
  }, [onReorderSymbols])   // plus de dépendance sur insertPos !

  return (
    <div className="palette">
      <div className="palette-header">
        <span className="palette-title">Symboles</span>
        <button className="palette-add-btn" onClick={() => fileRef.current?.click()} title="Ajouter un symbole PNG">+</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          style={{ display: 'none' }}
          onChange={e => { onAddSymbol(e.target.files[0]); e.target.value = '' }}
        />
      </div>
      <div className="palette-list">
        {symbols.map((sym, idx) => (
          <PaletteItem
            key={sym.id}
            symbol={sym}
            index={idx}
            onConfigure={onConfigureSymbol}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            isDragging={dragIdx === idx}
            insertBefore={overIdx === idx && insertPos === 'before' && dragIdx !== idx}
            insertAfter={overIdx === idx && insertPos === 'after' && dragIdx !== idx}
          />
        ))}
      </div>
    </div>
  )
}
