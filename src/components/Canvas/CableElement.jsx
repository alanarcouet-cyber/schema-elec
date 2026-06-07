import { Line, Text } from 'react-konva'
import { getCableEndpoints, routeOrthogonalAvoid, buildElementBoxes } from '../../utils/routing'

export const CABLE_STYLES = {
  HTA_EXIST: { color: '#dc2626', width: 3,   dash: [] },
  HTA_NEW:   { color: '#dc2626', width: 2.5, dash: [20, 8] },
  BT_EXIST:  { color: '#2563eb', width: 3,   dash: [] },
  BT_NEW:    { color: '#2563eb', width: 2.5, dash: [20, 8] },
  // Backward compat
  HTA:       { color: '#dc2626', width: 3,   dash: [] },
  BT:        { color: '#2563eb', width: 3,   dash: [] },
}

export default function CableElement({
  cable,
  elements,
  symbols,
  anchors,
  priorRoutes,
  isSelected,
  onSelect,
  onDblClick,
}) {
  const { fromPos, toPos } = getCableEndpoints(cable, elements, symbols, anchors)
  if (!fromPos || !toPos) return null

  // Boîtes de tous les symboles sauf ceux connectés à ce câble
  const elementBoxes = buildElementBoxes(elements, symbols, [
    cable.fromElementId, cable.toElementId,
  ])

  const points = routeOrthogonalAvoid(fromPos.x, fromPos.y, toPos.x, toPos.y, priorRoutes, elementBoxes)
  const style = CABLE_STYLES[cable.type] || CABLE_STYLES.BT_EXIST
  const { color, width, dash } = style

  // Label at midpoint of the bridge segment
  const midX = (fromPos.x + toPos.x) / 2
  const midY = fromPos.y

  return (
    <>
      <Line
        points={points}
        stroke={color}
        strokeWidth={isSelected ? width + 1.5 : width}
        dash={dash}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={12}
        onClick={(e) => { e.cancelBubble = true; onSelect(cable.id) }}
        onDblClick={(e) => { e.cancelBubble = true; if (onDblClick) onDblClick(cable.id, cable.label || '', midX, midY) }}
      />
      {cable.label ? (
        <Text
          x={midX + (cable.labelOffsetX || 0) - 30}
          y={midY + (cable.labelOffsetY || 0) - 14}
          text={cable.label}
          fontSize={10}
          fontFamily="'Courier New', monospace"
          fill={color}
          width={60}
          align="center"
          listening={false}
        />
      ) : null}
    </>
  )
}
