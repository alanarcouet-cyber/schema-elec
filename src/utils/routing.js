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

// ── Symbol bounding boxes (AABB) for avoidance ───────────────────────────────

const AVOID_PADDING = 12   // extra px around each symbol

/** Axis-aligned bounding box of a (possibly rotated) element, with padding */
export function getElementAABB(element, symbol) {
  if (!symbol) return null
  const w   = symbol.displayWidth  || 80
  const h   = symbol.displayHeight || 80
  const cx  = element.x + w / 2
  const cy  = element.y + h / 2
  const rot = ((element.rotation || 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rot))
  const sin = Math.abs(Math.sin(rot))
  const hw  = (w * cos + h * sin) / 2 + AVOID_PADDING
  const hh  = (w * sin + h * cos) / 2 + AVOID_PADDING
  return { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh }
}

/** Build AABB list for all elements, optionally excluding some IDs */
export function buildElementBoxes(elements, symbols, excludeIds = []) {
  const excl = new Set(excludeIds.filter(Boolean))
  return elements
    .filter(el => !excl.has(el.id))
    .map(el => {
      const sym = symbols.find(s => s.id === el.symbolId)
      return getElementAABB(el, sym)
    })
    .filter(Boolean)
}

/** Does an axis-aligned segment cross (or touch) a box? */
function segCrossesBox(sx1, sy1, sx2, sy2, box) {
  const EPS = 1
  if (Math.abs(sy1 - sy2) < EPS) {
    // Horizontal segment
    const y = sy1
    if (y <= box.y1 + EPS || y >= box.y2 - EPS) return false
    const xMin = Math.min(sx1, sx2), xMax = Math.max(sx1, sx2)
    return xMax > box.x1 + EPS && xMin < box.x2 - EPS
  }
  if (Math.abs(sx1 - sx2) < EPS) {
    // Vertical segment
    const x = sx1
    if (x <= box.x1 + EPS || x >= box.x2 - EPS) return false
    const yMin = Math.min(sy1, sy2), yMax = Math.max(sy1, sy2)
    return yMax > box.y1 + EPS && yMin < box.y2 - EPS
  }
  return false
}

/** Does any segment of a route cross any box? */
function routeCrossesBoxes(pts, boxes) {
  for (const [ax1, ay1, ax2, ay2] of toSegments(pts)) {
    for (const box of boxes) {
      if (segCrossesBox(ax1, ay1, ax2, ay2, box)) return true
    }
  }
  return false
}

// Route orthogonally, shifting midX to avoid overlapping prior cable segments
// and element bounding boxes.
export function routeOrthogonalAvoid(x1, y1, x2, y2, priorPointArrays, elementBoxes = []) {
  const STEP    = 20
  const MAX_TRY = 16
  let midX = (x1 + x2) / 2
  const hasPrior = priorPointArrays?.length > 0
  const hasBoxes = elementBoxes.length > 0
  if (!hasPrior && !hasBoxes) return routeOrthogonal(x1, y1, x2, y2)

  const mk = () => [x1, y1, midX, y1, midX, y2, x2, y2]

  for (let tries = 0; tries < MAX_TRY; tries++) {
    const pts     = mk()
    const newSegs = toSegments(pts)

    // Check overlap with prior cable segments
    let overlap = false
    if (hasPrior) {
      outer: for (const prior of priorPointArrays) {
        for (const [ax1, ay1, ax2, ay2] of newSegs) {
          for (const [bx1, by1, bx2, by2] of toSegments(prior)) {
            if (collinearOverlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) {
              overlap = true; break outer
            }
          }
        }
      }
    }

    // Check intersection with element boxes
    if (!overlap && hasBoxes) {
      overlap = routeCrossesBoxes(pts, elementBoxes)
    }

    if (!overlap) break
    // Alternate: shift right then left, further each time
    midX = (x1 + x2) / 2 + (tries % 2 === 0 ? 1 : -1) * STEP * (Math.floor(tries / 2) + 1)
  }

  return mk()
}
