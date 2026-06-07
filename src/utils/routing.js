// Rotate point (px, py) around center (cx, cy) by angleDeg degrees
function rotateAround(px, py, cx, cy, angleDeg) {
  if (!angleDeg) return { x: px, y: py }
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const dx = px - cx, dy = py - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

// Orthogonal (Manhattan) routing — Z-shape via horizontal midpoint
export function routeOrthogonal(x1, y1, x2, y2) {
  const midX = (x1 + x2) / 2
  return [x1, y1, midX, y1, midX, y2, x2, y2]
}

// Absolute canvas position of a borne, accounting for element rotation
export function getBornePosition(element, symbol, borneIdx) {
  const borne = symbol?.bornes?.[borneIdx]
  if (!borne) return null
  const bx = element.x + borne.x
  const by = element.y + borne.y
  const rotation = element.rotation || 0
  if (!rotation) return { x: bx, y: by }
  const cx = element.x + symbol.displayWidth / 2
  const cy = element.y + symbol.displayHeight / 2
  return rotateAround(bx, by, cx, cy, rotation)
}

// Resolve cable start/end positions (elements bornes or floating anchors)
export function getCableEndpoints(cable, elements, symbols, anchors) {
  let fromPos = null, toPos = null

  if (cable.fromAnchorId) {
    const a = (anchors || []).find(a => a.id === cable.fromAnchorId)
    if (a) fromPos = { x: a.x, y: a.y }
  } else if (cable.fromElementId != null) {
    const el = elements.find(e => e.id === cable.fromElementId)
    const sym = symbols.find(s => s.id === el?.symbolId)
    if (el && sym) fromPos = getBornePosition(el, sym, cable.fromBorneIdx)
  }

  if (cable.toAnchorId) {
    const a = (anchors || []).find(a => a.id === cable.toAnchorId)
    if (a) toPos = { x: a.x, y: a.y }
  } else if (cable.toElementId != null) {
    const el = elements.find(e => e.id === cable.toElementId)
    const sym = symbols.find(s => s.id === el?.symbolId)
    if (el && sym) toPos = getBornePosition(el, sym, cable.toBorneIdx)
  }

  return { fromPos, toPos }
}

// Convert flat points array to [x1,y1,x2,y2] tuples
function toSegments(pts) {
  const segs = []
  for (let i = 0; i < pts.length - 2; i += 2) {
    segs.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3]])
  }
  return segs
}

// Returns true if two axis-aligned segments are collinear and overlapping
function collinearOverlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const EPS = 2
  const aH = Math.abs(ay1 - ay2) < EPS, bH = Math.abs(by1 - by2) < EPS
  if (aH && bH && Math.abs(ay1 - by1) < EPS) {
    return Math.min(ax1, ax2) < Math.max(bx1, bx2) - EPS &&
           Math.min(bx1, bx2) < Math.max(ax1, ax2) - EPS
  }
  const aV = Math.abs(ax1 - ax2) < EPS, bV = Math.abs(bx1 - bx2) < EPS
  if (aV && bV && Math.abs(ax1 - bx1) < EPS) {
    return Math.min(ay1, ay2) < Math.max(by1, by2) - EPS &&
           Math.min(by1, by2) < Math.max(ay1, ay2) - EPS
  }
  return false
}

// Route orthogonally, shifting midX to avoid overlapping prior cable segments
export function routeOrthogonalAvoid(x1, y1, x2, y2, priorPointArrays) {
  const STEP = 5
  let midX = (x1 + x2) / 2
  if (!priorPointArrays?.length) return routeOrthogonal(x1, y1, x2, y2)

  const mk = () => [x1, y1, midX, y1, midX, y2, x2, y2]

  for (let tries = 0; tries < 8; tries++) {
    const newSegs = toSegments(mk())
    let overlap = false
    outer: for (const prior of priorPointArrays) {
      for (const [ax1, ay1, ax2, ay2] of newSegs) {
        for (const [bx1, by1, bx2, by2] of toSegments(prior)) {
          if (collinearOverlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) {
            overlap = true; break outer
          }
        }
      }
    }
    if (!overlap) break
    // Alternate: shift right, then left, further each time
    midX = (x1 + x2) / 2 + (tries % 2 === 0 ? 1 : -1) * STEP * (Math.floor(tries / 2) + 1)
  }

  return mk()
}
