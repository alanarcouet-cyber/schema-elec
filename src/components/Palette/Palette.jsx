import { useRef, useState, useCallback } from 'react'
import PaletteItem from './PaletteItem'
import './Palette.css'

export default function Palette({ symbols, onAddSymbol, onConfigureSymbol, onReorderSymbols }) {
  const fileRef = useRef(null)
  const [dragIdx, setDragIdx]       = useState(null)   // index being dragged
  const [overIdx, setOverIdx]       = useState(null)   // index currently hovered
  const [insertPos, setInsertPos]   = useState(null)   // 'before' | 'after'

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
    // Determine insert position from cursor position within the item
    const rect = e.currentTarget.getBoundingClientRect()
    const mid  = rect.top + rect.height / 2
    setOverIdx(index)
    setInsertPos(e.clientY < mid ? 'before' : 'after')
  }, [])

  const handleDragEnd = useCallback(() => {
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

    // Compute real destination index
    let destIdx = index
    if (insertPos === 'after') destIdx = index + 1
    // Adjust for the gap left by removing the source
    if (srcIdx < destIdx) destIdx -= 1
    if (srcIdx !== destIdx) onReorderSymbols(srcIdx, destIdx)

    setDragIdx(null)
    setOverIdx(null)
    setInsertPos(null)
  }, [insertPos, onReorderSymbols])

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
