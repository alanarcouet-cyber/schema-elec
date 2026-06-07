import { useTransparentSrc } from '../../hooks/useTransparentImage'

export default function PaletteItem({
  symbol, index, onConfigure,
  onDragStart, onDragOver, onDragEnd, onDrop,
  isDragging, insertBefore, insertAfter,
}) {
  const src = useTransparentSrc(symbol.pngPath)

  return (
    <div
      className="palette-item-wrapper"
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
    >
      {insertBefore && <div className="palette-insert-line" />}
      <div
        className={`palette-item${isDragging ? ' dragging' : ''}`}
        draggable
        onDragStart={e => onDragStart(e, index, symbol.id)}
        onDragEnd={onDragEnd}
        title={symbol.name}
      >
        <div className="palette-drag-handle" title="Réorganiser">⠿</div>
        <div className="palette-item-img-wrap">
          <img
            src={src}
            alt={symbol.name}
            draggable={false}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
        <div className="palette-item-info">
          <span className="palette-item-name">{symbol.name}</span>
          <span className={`palette-item-type ${symbol.type}`}>{symbol.type}</span>
        </div>
        <button
          className="palette-item-config-btn"
          title="Configurer le symbole"
          onClick={e => { e.stopPropagation(); onConfigure(symbol) }}
        >⚙</button>
      </div>
      {insertAfter && <div className="palette-insert-line" />}
    </div>
  )
}
