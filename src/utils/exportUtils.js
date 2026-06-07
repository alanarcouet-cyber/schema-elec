import jsPDF from 'jspdf'

const PADDING = 40

/** Bounding box de tout le contenu du canvas (en coordonnées canvas). */
function getBoundingBox(canvas) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const el of canvas.elements) {
    const sym = canvas.symbols.find(s => s.id === el.symbolId)
    if (!sym) continue
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y - 20)           // place pour la roue au-dessus
    maxX = Math.max(maxX, el.x + sym.displayWidth)
    maxY = Math.max(maxY, el.y + sym.displayHeight + 20) // label en dessous
  }

  for (const anchor of (canvas.anchors || [])) {
    minX = Math.min(minX, anchor.x - 8)
    minY = Math.min(minY, anchor.y - 8)
    maxX = Math.max(maxX, anchor.x + 8)
    maxY = Math.max(maxY, anchor.y + 8)
  }

  for (const comment of (canvas.comments || [])) {
    minX = Math.min(minX, comment.x)
    minY = Math.min(minY, comment.y)
    maxX = Math.max(maxX, comment.x + (comment.width || 180))
    maxY = Math.max(maxY, comment.y + 60)
  }

  if (!isFinite(minX)) return null   // canvas vide

  return {
    x:      minX - PADDING,
    y:      minY - PADDING,
    width:  maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  }
}

export function exportToPNG(stageRef, canvas) {
  const stage = stageRef.current
  if (!stage) return

  const bbox = canvas ? getBoundingBox(canvas) : null
  const uri  = stage.toDataURL({ pixelRatio: 2, ...(bbox ?? {}) })

  const a = document.createElement('a')
  a.download = 'schema.png'
  a.href = uri
  a.click()
}

export function exportToPDF(stageRef, orientation = 'landscape', canvas) {
  const stage = stageRef.current
  if (!stage) return

  const bbox = canvas ? getBoundingBox(canvas) : null

  // Dimensions A4 en mm
  const pageW = orientation === 'landscape' ? 297 : 210
  const pageH = orientation === 'landscape' ? 210 : 297

  let imgX = 0, imgY = 0, imgW = pageW, imgH = pageH

  if (bbox) {
    // Maintenir le ratio du contenu et centrer dans la page
    const ratio = bbox.width / bbox.height
    const pageRatio = pageW / pageH
    if (ratio > pageRatio) {
      imgW = pageW
      imgH = pageW / ratio
      imgY = (pageH - imgH) / 2
    } else {
      imgH = pageH
      imgW = pageH * ratio
      imgX = (pageW - imgW) / 2
    }
  }

  const uri = stage.toDataURL({ pixelRatio: 2, ...(bbox ?? {}) })
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  pdf.addImage(uri, 'PNG', imgX, imgY, imgW, imgH)
  pdf.save('schema.pdf')
}
