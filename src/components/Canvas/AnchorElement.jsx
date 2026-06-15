import { Circle, Group, Text } from 'react-konva'

const GRID = 20

export default function AnchorElement({ anchor, isSelected, showBornes, activeBorneKey, tool, onSelect, onMove, onAnchorBorneClick, onDelete }) {
  const isActive = activeBorneKey === `anchor:${anchor.id}`
  const r = isSelected ? 7 : (isActive || showBornes) ? 6 : 5

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

  // Clic droit → suppression directe
  const handleContextMenu = (e) => {
    e.evt.preventDefault()
    e.cancelBubble = true
    if (onDelete) onDelete()
  }

  return (
    <Group x={anchor.x} y={anchor.y}>
      {/* Cercle principal */}
      <Circle
        radius={r}
        fill={isActive ? '#f97316' : isSelected ? '#2563eb' : '#6b7280'}
        stroke={isSelected ? '#1d4ed8' : isActive ? '#f97316' : '#9ca3af'}
        strokeWidth={isSelected ? 2 : 1.5}
        draggable={tool === 'select'}
        hitStrokeWidth={16}     /* zone de clic élargie */
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragEnd={handleDragEnd}
      />

      {/* × rouge affiché quand sélectionné (en mode select) */}
      {isSelected && tool === 'select' && (
        <Text
          text="×"
          x={r + 2}
          y={-r - 2}
          fontSize={13}
          fontStyle="bold"
          fill="#ef4444"
          listening={true}
          onClick={(e) => { e.cancelBubble = true; if (onDelete) onDelete() }}
          onContextMenu={handleContextMenu}
        />
      )}
    </Group>
  )
}
