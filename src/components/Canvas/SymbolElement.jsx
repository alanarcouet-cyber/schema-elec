import { Group, Image, Text, Circle, Rect } from 'react-konva'
import { useTransparentKonvaImage } from '../../hooks/useTransparentImage'

const GRID = 20

export default function SymbolElement({
  element,
  symbol,
  isSelected,
  showBornes,
  activeBorneKey,
  tool,
  hideControls,
  onSelect,
  onMove,
  onRotate,
  onBorneClick,
  onLabelDblClick,
}) {
  const img = useTransparentKonvaImage(symbol.pngPath)
  const rotation = element.rotation || 0
  const W = symbol.displayWidth
  const H = symbol.displayHeight

  const handleDragEnd = (e) => {
    const x = Math.round(e.target.x() / GRID) * GRID
    const y = Math.round(e.target.y() / GRID) * GRID
    onMove(element.id, x, y)
    e.target.position({ x, y })
  }

  const isDraggable = tool === 'select'
  const borneColor = (type) => type === 'HTA' ? '#ef4444' : '#2563eb'

  return (
    <Group
      x={element.x}
      y={element.y}
      draggable={isDraggable}
      onClick={(e) => { e.cancelBubble = true; onSelect(element.id) }}
      onDragEnd={handleDragEnd}
    >
      {/* ── Rotated sub-group: image + bornes + selection rect ── */}
      <Group
        x={W / 2}
        y={H / 2}
        offsetX={W / 2}
        offsetY={H / 2}
        rotation={rotation}
      >
        {isSelected && (
          <Rect
            x={-4} y={-4}
            width={W + 8} height={H + 8}
            stroke="#2563eb" strokeWidth={1.5}
            dash={[5, 4]}
            fill="rgba(37,99,235,0.04)"
            cornerRadius={3}
            listening={false}
          />
        )}

        <Image
          image={img}
          width={W}
          height={H}
          listening={tool === 'select'}
          onDblClick={(e) => {
            e.cancelBubble = true
            if (onRotate) onRotate(element.id, 90)
          }}
        />

        {showBornes && symbol.bornes.map((borne, idx) => {
          const key = `${element.id}:${idx}`
          const isActive = activeBorneKey === key
          const color = borneColor(symbol.type)
          return (
            <Circle
              key={idx}
              x={borne.x} y={borne.y}
              radius={isActive ? 7 : 5}
              fill={isActive ? color : 'white'}
              stroke={color}
              strokeWidth={2}
              opacity={0.9}
              onClick={(e) => { e.cancelBubble = true; onBorneClick(element.id, idx) }}
            />
          )
        })}
      </Group>

      {/* ── Label: always horizontal ── */}
      <Text
        x={0}
        y={H + 6 + (element.labelOffsetY || 0)}
        text={element.label}
        fontSize={11}
        fontFamily="'Courier New', monospace"
        fill="#1a1a1a"
        width={W}
        align="center"
        onDblClick={(e) => { e.cancelBubble = true; onLabelDblClick(element.id, element.label) }}
      />

      {/* ── Gear widget (select mode only, hidden during export) ── */}
      {tool === 'select' && !hideControls && (
        <>
          <Circle
            name="gear"
            x={W / 2}
            y={-16}
            radius={8}
            fill="#f5f5f5"
            stroke="#bbb"
            strokeWidth={1}
            onWheel={(e) => {
              e.cancelBubble = true
              e.evt.preventDefault()
              if (onRotate) onRotate(element.id, e.evt.deltaY > 0 ? 1 : -1)
            }}
          />
          <Text
            x={W / 2 - 5}
            y={-23}
            text="↻"
            fontSize={12}
            fill="#888"
            listening={false}
          />
        </>
      )}
    </Group>
  )
}
