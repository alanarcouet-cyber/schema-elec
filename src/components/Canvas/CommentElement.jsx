import { Group, Rect, Text } from 'react-konva'

const GRID   = 20
const PAD    = 8
const MIN_W  = 80
const MIN_H  = 40
const LINE_H = 14
const H_SIZE = 10   // resize handle size

export default function CommentElement({ comment, isSelected, tool, onSelect, onMove, onDblClick, onResize }) {
  const lines     = (comment.text || '').split('\n')
  const autoH     = Math.max(MIN_H, lines.length * LINE_H + PAD * 2 + 4)
  const width     = comment.width    || 180
  const height    = comment.height   || autoH
  const rotation  = comment.rotation ?? 0
  const highlight = comment.highlight ?? false

  const handleDragEnd = (e) => {
    const x = Math.round(e.target.x() / GRID) * GRID
    const y = Math.round(e.target.y() / GRID) * GRID
    onMove(comment.id, x, y)
    e.target.position({ x, y })
  }

  const handleResizeDragEnd = (e) => {
    e.cancelBubble = true
    const newW = Math.max(MIN_W, e.target.x() + H_SIZE / 2)
    const newH = Math.max(MIN_H, e.target.y() + H_SIZE / 2)
    if (onResize) onResize(comment.id, newW, newH)
    e.target.position({ x: newW - H_SIZE / 2, y: newH - H_SIZE / 2 })
  }

  return (
    <Group
      x={comment.x}
      y={comment.y}
      rotation={rotation}
      draggable={tool === 'select'}
      onClick={(e)    => { e.cancelBubble = true; onSelect(comment.id) }}
      onDblClick={(e) => { e.cancelBubble = true; onDblClick(comment.id, comment.text) }}
      onDragEnd={handleDragEnd}
    >
      {/* Body */}
      <Rect
        width={width} height={height}
        fill={highlight ? 'rgba(250, 204, 21, 0.35)' : 'transparent'}
        stroke={isSelected ? '#2563eb' : (highlight ? '#ca8a04' : '#94a3b8')}
        strokeWidth={isSelected ? 1.5 : 1}
        dash={isSelected ? [5, 4] : [4, 3]}
        cornerRadius={3}
      />

      {/* Text */}
      <Text
        x={PAD} y={PAD}
        text={comment.text || '(double-clic pour éditer)'}
        fontSize={11}
        fontFamily="'Segoe UI', Arial, sans-serif"
        fill={comment.text ? '#1c1917' : '#94a3b8'}
        fontStyle={comment.text ? 'normal' : 'italic'}
        width={width - PAD * 2}
        lineHeight={1.35}
        wrap="word"
        listening={false}
      />

      {/* Resize handle — bottom-right corner, only when selected */}
      {isSelected && tool === 'select' && (
        <Rect
          x={width - H_SIZE / 2}
          y={height - H_SIZE / 2}
          width={H_SIZE}
          height={H_SIZE}
          fill="#2563eb"
          cornerRadius={2}
          draggable
          onDragEnd={handleResizeDragEnd}
          onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'nwse-resize' }}
          onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default' }}
        />
      )}
    </Group>
  )
}
