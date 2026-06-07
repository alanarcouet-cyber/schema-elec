import { Group, Circle, Text } from 'react-konva'

export default function RemoteCursors({ cursors }) {
  return (
    <>
      {Object.entries(cursors).map(([userId, cursor]) => (
        <Group key={userId} x={cursor.x} y={cursor.y} listening={false}>
          <Circle radius={5} fill={cursor.color} opacity={0.85} />
          <Text
            x={8} y={-10}
            text={cursor.email?.split('@')[0] ?? 'user'}
            fontSize={10}
            fontStyle="bold"
            fill={cursor.color}
          />
        </Group>
      ))}
    </>
  )
}
