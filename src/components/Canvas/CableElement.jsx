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

  // Angle du câble (orientation générale) pour aligner l'étiquette dessus
  let labelAngle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x) * 180 / Math.PI
  // Garder le texte lisible (jamais à l'envers)
  if (labelAngle > 90)  labelAngle -= 180
  if (labelAngle < -90) labelAngle += 180

  // Centre de l'étiquette : milieu réel du câble
  const labelCx = (fromPos.x + toPos.x) / 2 + (cable.labelOffsetX || 0)
  const labelCy = (fromPos.y + toPos.y) / 2 + (cable.labelOffsetY || 0)

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
          x={labelCx}
          y={labelCy}
          text={cable.label}
          fontSize={10}
          fontFamily="'Courier New', monospace"
          fill={color}
          width={60}
          align="center"
          lineHeight={1.6}
          offsetX={30}
          offsetY={16}
          rotation={labelAngle}
          listening={false}
        />
      ) : null}
    </>
  )
}
