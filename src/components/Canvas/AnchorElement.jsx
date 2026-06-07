import { Circle } from 'react-konva'

const GRID = 20

export default function AnchorElement({ anchor, isSelected, showBornes, activeBorneKey, tool, onSelect, onMove, onAnchorBorneClick }) {
  const isActive = activeBorneKey === `anchor:${anchor.id}`

  const handleDragEnd = (e) => {
    const x = Math.round(e.target.x() / GRID) * GRID
    const y = Math.round(e.target.y() / GRID) * GRID
    onMove(anchor.id, x, y)
    e.target.position({ x, y })
  }

  const handleClick = (e) => {
    e.cancelBubble = true
    if (tool === 'cable') {
      onAnchorBorneClick(anchor.id)
    } else if (tool === 'select') {
      onSelect(anchor.id)
    }
  }

  return (
    <Circle
      x={anchor.x}
      y={anchor.y}
      radius={isSelected ? 7 : (isActive || showBornes) ? 6 : 4}
      fill={isActive ? '#f97316' : isSelected ? '#2563eb' : '#555'}
      stroke={isSelected ? '#2563eb' : isActive ? '#f97316' : '#888'}
      strokeWidth={isSelected ? 2 : 1.5}
      draggable={tool === 'select'}
      onClick={handleClick}
      onDragEnd={handleDragEnd}
    />
  )
}
