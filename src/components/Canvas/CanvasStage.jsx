import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import SymbolElement from './SymbolElement'
import CableElement, { CABLE_STYLES } from './CableElement'
import AnchorElement from './AnchorElement'
import CommentElement from './CommentElement'
import RemoteCursors from './RemoteCursors'
import { getCableEndpoints, routeOrthogonal, getBornePosition } from '../../utils/routing'
import './CanvasStage.css'

const CANVAS_W = 3000
const CANVAS_H = 2000
const GRID = 20

export default function CanvasStage({ canvas, stageRef, remoteCursors = {}, onCursorMove, exporting = false }) {
  const containerRef = useRef(null)
  const refBarInputRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [editLabel, setEditLabel] = useState(null)
  const [editComment, setEditComment] = useState(null)
  const [editCableLabel, setEditCableLabel] = useState(null)
  const [mouseCanvasPos, setMouseCanvasPos] = useState(null)

  // Resize observer
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (editLabel || editComment || editCableLabel) return

      // Undo / Redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); canvas.undo(); return }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); canvas.redo(); return }
      }

      if (e.key === 'Delete') canvas.deleteSelected()
      if (e.key === 'Escape') { canvas.setTool('select'); canvas.selectElement(null) }
      if (e.key === 's' && !e.ctrlKey) canvas.setTool('select')
      if (e.key === 'c' && !e.ctrlKey) canvas.setTool('cable')
      if (e.key === 'n' && !e.ctrlKey) canvas.setTool('comment')
      // #8 — Rotation (R)
      if (e.key === 'r' && !e.ctrlKey && canvas.selectedId) {
        canvas.rotateElement(canvas.selectedId, 90)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canvas, editLabel, editComment, editCableLabel])

  // Zoom with wheel — skip when cursor is over a gear widget
  const handleWheel = useCallback((e) => {
    if (e.target?.name?.() === 'gear') return
    e.evt.preventDefault()
    const stage = stageRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    const origin = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const factor = e.evt.deltaY < 0 ? 1.08 : 1 / 1.08
    const newScale = Math.min(4, Math.max(0.15, oldScale * factor))
    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - origin.x * newScale,
      y: pointer.y - origin.y * newScale,
    })
  }, [stageRef])

  // Drop from palette
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const symbolId = e.dataTransfer.getData('symbolId')
    if (!symbolId) return
    const stage = stageRef.current
    stage.setPointersPositions(e)
    const pointer = stage.getPointerPosition()
    const tf = stage.getAbsoluteTransform().copy().invert()
    const { x, y } = tf.point(pointer)
    canvas.addElement(symbolId, Math.round(x / GRID) * GRID, Math.round(y / GRID) * GRID)
    // Focus la barre de référence après le rendu
    setTimeout(() => refBarInputRef.current?.focus(), 50)
  }, [canvas, stageRef])

  const handleMouseMove = useCallback((e) => {
    const stage = stageRef.current
    const pointer = stage.getPointerPosition()
    const tf = stage.getAbsoluteTransform().copy().invert()
    const { x, y } = tf.point(pointer)
    setMouseCanvasPos({ x, y })
    if (onCursorMove) onCursorMove(x, y)
  }, [onCursorMove, stageRef])

  // #6 — Resolve cable preview start position
  const previewStart = useMemo(() => {
    if (!canvas.cableStart) return null
    if (canvas.cableStart.type === 'element') {
      const el  = canvas.elements.find(e => e.id === canvas.cableStart.elementId)
      const sym = canvas.symbols.find(s => s.id === el?.symbolId)
      if (!el || !sym) return null
      return getBornePosition(el, sym, canvas.cableStart.borneIdx)
    }
    const anchor = canvas.anchors.find(a => a.id === canvas.cableStart.anchorId)
    return anchor ? { x: anchor.x, y: anchor.y } : null
  }, [canvas.cableStart, canvas.elements, canvas.symbols, canvas.anchors])

  // Click on empty canvas
  const handleStageClick = useCallback((e) => {
    if (e.target !== e.target.getStage()) return

    const stage = stageRef.current
    const pointer = stage.getPointerPosition()
    const tf = stage.getAbsoluteTransform().copy().invert()
    const { x, y } = tf.point(pointer)
    const cx = Math.round(x / GRID) * GRID
    const cy = Math.round(y / GRID) * GRID

    if (canvas.tool === 'comment') {
      const id = canvas.addComment(cx, cy)
      const screenPos = stage.getAbsoluteTransform().point({ x: cx, y: cy })
      setEditComment({ id, value: '', screenX: screenPos.x, screenY: screenPos.y })
    } else if (canvas.tool === 'cable') {
      if (canvas.cableStart) {
        // End cable on empty canvas → create floating anchor there
        const anchorId = canvas.addAnchor(cx, cy)
        canvas.endCableToAnchor(anchorId)
      } else {
        // Start cable from empty canvas → create anchor as origin
        const anchorId = canvas.addAnchor(cx, cy)
        canvas.startCableFromAnchor(anchorId)
      }
    } else {
      canvas.selectElement(null)
    }
  }, [canvas, stageRef])

  // ── Label editor ─────────────────────────────────────────────────────────

  const openLabelEdit = (elementId, currentLabel) => {
    const el = canvas.elements.find(e => e.id === elementId)
    const sym = canvas.symbols.find(s => s.id === el?.symbolId)
    if (!el || !sym) return
    const stage = stageRef.current
    const tf = stage.getAbsoluteTransform()
    const pos = tf.point({ x: el.x, y: el.y + sym.displayHeight + 6 + (el.labelOffsetY || 0) })
    setEditLabel({ id: elementId, value: currentLabel, screenX: pos.x, screenY: pos.y })
  }

  const commitLabel = () => {
    if (editLabel) { canvas.updateLabel(editLabel.id, editLabel.value); setEditLabel(null) }
  }

  const openCableLabelEdit = (cableId, currentLabel, canvasX, canvasY) => {
    const stage = stageRef.current
    const tf = stage.getAbsoluteTransform()
    const pos = tf.point({ x: canvasX, y: canvasY })
    setEditCableLabel({ id: cableId, value: currentLabel, screenX: pos.x, screenY: pos.y })
  }

  const commitCableLabel = () => {
    if (editCableLabel) { canvas.updateCableLabel(editCableLabel.id, editCableLabel.value); setEditCableLabel(null) }
  }

  // ── Comment editor ────────────────────────────────────────────────────────

  const openCommentEdit = (commentId, currentText) => {
    const comment = canvas.comments.find(c => c.id === commentId)
    if (!comment) return
    const stage = stageRef.current
    const tf = stage.getAbsoluteTransform()
    const pos = tf.point({ x: comment.x, y: comment.y })
    setEditComment({ id: commentId, value: currentText, screenX: pos.x, screenY: pos.y })
  }

  const commitComment = () => {
    if (editComment) {
      canvas.updateComment(editComment.id, editComment.value)
      setEditComment(null)
      canvas.setTool('select')
    }
  }

  // ── Cable interactions ────────────────────────────────────────────────────

  const handleBorneClick = (elementId, borneIdx) => {
    if (!canvas.cableStart) {
      canvas.startCable(elementId, borneIdx)
    } else {
      canvas.endCable(elementId, borneIdx)
    }
  }

  const handleAnchorBorneClick = (anchorId) => {
    if (!canvas.cableStart) {
      canvas.startCableFromAnchor(anchorId)
    } else {
      canvas.endCableToAnchor(anchorId)
    }
  }

  const activeBorneKey = canvas.cableStart
    ? (canvas.cableStart.type === 'element'
        ? `${canvas.cableStart.elementId}:${canvas.cableStart.borneIdx}`
        : `anchor:${canvas.cableStart.anchorId}`)
    : null

  const showBornes = canvas.tool === 'cable'

  // Élément sélectionné (symbole uniquement, pas câble/commentaire/ancre)
  const selectedElement = canvas.elements.find(el => el.id === canvas.selectedId) ?? null
  const selectedSymbol  = selectedElement ? canvas.symbols.find(s => s.id === selectedElement.symbolId) : null

  // ── Pre-compute cable routes for overlap avoidance ───────────────────────

  const allCableRoutes = useMemo(() => {
    return canvas.cables.map(cable => {
      const { fromPos, toPos } = getCableEndpoints(
        cable, canvas.elements, canvas.symbols, canvas.anchors
      )
      if (!fromPos || !toPos) return null
      return routeOrthogonal(fromPos.x, fromPos.y, toPos.x, toPos.y)
    })
  }, [canvas.cables, canvas.elements, canvas.symbols, canvas.anchors])

  return (
    <div
      ref={containerRef}
      className={`canvas-container${canvas.tool === 'comment' ? ' cursor-comment' : ''}`}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable={canvas.tool === 'pan'}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onClick={handleStageClick}
      >
        {/* Layer 1 — Grid (static, never re-renders on content changes) */}
        <Layer listening={false}>
          {Array.from({ length: Math.ceil(CANVAS_H / GRID) + 1 }, (_, i) => (
            <Line key={`h${i}`} points={[0, i * GRID, CANVAS_W, i * GRID]} stroke="#e8eaf0" strokeWidth={0.5} />
          ))}
          {Array.from({ length: Math.ceil(CANVAS_W / GRID) + 1 }, (_, i) => (
            <Line key={`v${i}`} points={[i * GRID, 0, i * GRID, CANVAS_H]} stroke="#e8eaf0" strokeWidth={0.5} />
          ))}
        </Layer>

        {/* Layer 2 — All canvas content (comments, cables, symbols, anchors) */}
        <Layer>
          {canvas.comments.map(comment => (
            <CommentElement
              key={comment.id}
              comment={comment}
              isSelected={canvas.selectedId === comment.id}
              tool={canvas.tool}
              onSelect={(id) => { canvas.setTool('select'); canvas.selectElement(id) }}
              onMove={canvas.moveComment}
              onDblClick={openCommentEdit}
              onResize={canvas.updateCommentSize}
            />
          ))}
          {canvas.cables.map((cable, idx) => (
            <CableElement
              key={cable.id}
              cable={cable}
              elements={canvas.elements}
              symbols={canvas.symbols}
              anchors={canvas.anchors}
              priorRoutes={allCableRoutes.slice(0, idx).filter(Boolean)}
              isSelected={canvas.selectedId === cable.id}
              onSelect={canvas.selectElement}
              onDblClick={openCableLabelEdit}
            />
          ))}
          {canvas.elements.map(el => {
            const sym = canvas.symbols.find(s => s.id === el.symbolId)
            if (!sym) return null
            return (
              <SymbolElement
                key={el.id}
                element={el}
                symbol={sym}
                isSelected={canvas.selectedId === el.id}
                showBornes={showBornes}
                activeBorneKey={activeBorneKey}
                tool={canvas.tool}
                hideControls={exporting}
                onSelect={(id) => { canvas.setTool('select'); canvas.selectElement(id) }}
                onMove={canvas.moveElement}
                onRotate={canvas.rotateElement}
                onBorneClick={handleBorneClick}
                onLabelDblClick={openLabelEdit}
              />
            )
          })}
          {canvas.anchors.map(anchor => (
            <AnchorElement
              key={anchor.id}
              anchor={anchor}
              isSelected={canvas.selectedId === anchor.id}
              showBornes={showBornes}
              activeBorneKey={activeBorneKey}
              tool={canvas.tool}
              onSelect={canvas.selectElement}
              onMove={canvas.moveAnchor}
              onAnchorBorneClick={handleAnchorBorneClick}
              onDelete={() => canvas.deleteById(anchor.id)}
            />
          ))}

          {/* #6 — Cable preview ghost line */}
          {canvas.cableStart && previewStart && mouseCanvasPos && (() => {
            const style = CABLE_STYLES[canvas.cableType] || CABLE_STYLES.BT_EXIST
            const pts = routeOrthogonal(previewStart.x, previewStart.y, mouseCanvasPos.x, mouseCanvasPos.y)
            return (
              <Line
                points={pts}
                stroke={style.color}
                strokeWidth={style.width}
                dash={[8, 6]}
                opacity={0.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )
          })()}
        </Layer>

        {/* Layer 3 — Remote cursors (high-frequency, isolated to avoid redrawing content) */}
        <Layer listening={false}>
          <RemoteCursors cursors={remoteCursors} />
        </Layer>
      </Stage>

      {/* Inline label editor */}
      {editLabel && (
        <input
          className="label-editor"
          style={{ left: editLabel.screenX, top: editLabel.screenY }}
          value={editLabel.value}
          autoFocus
          onChange={e => setEditLabel(prev => ({ ...prev, value: e.target.value }))}
          onBlur={commitLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') commitLabel()
            if (e.key === 'Escape') setEditLabel(null)
          }}
        />
      )}

      {/* Inline cable label editor */}
      {editCableLabel && (
        <input
          className="label-editor"
          style={{ left: editCableLabel.screenX, top: editCableLabel.screenY }}
          value={editCableLabel.value}
          placeholder="Étiquette câble…"
          autoFocus
          onChange={e => setEditCableLabel(prev => ({ ...prev, value: e.target.value }))}
          onBlur={commitCableLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') commitCableLabel()
            if (e.key === 'Escape') setEditCableLabel(null)
          }}
        />
      )}

      {/* Inline comment editor */}
      {editComment && (
        <textarea
          className="comment-editor"
          style={{ left: editComment.screenX, top: editComment.screenY }}
          value={editComment.value}
          placeholder="Saisir un commentaire…"
          autoFocus
          onChange={e => setEditComment(prev => ({ ...prev, value: e.target.value }))}
          onBlur={commitComment}
          onKeyDown={e => {
            if (e.key === 'Escape') { canvas.updateComment(editComment.id, editComment.value); setEditComment(null); canvas.setTool('select') }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitComment() }
          }}
        />
      )}

      {canvas.tool === 'comment' && !editComment && (
        <div className="cable-hint">Cliquez sur le canvas pour placer un commentaire — N ou Échap pour annuler</div>
      )}
      {canvas.tool === 'cable' && canvas.cableStart && (
        <div className="cable-hint">Cliquez sur une borne, une ancre ou le canvas libre pour terminer le câble</div>
      )}
      {canvas.tool === 'cable' && !canvas.cableStart && (
        <div className="cable-hint">Cliquez sur une borne ou le canvas libre pour démarrer un câble</div>
      )}

      {/* Barre de référence — visible dès qu'un symbole est sélectionné */}
      {selectedElement && selectedSymbol && (
        <div className="ref-bar">
          <span className="ref-bar-symbol">{selectedSymbol.name}</span>
          <label className="ref-bar-label" htmlFor="ref-bar-input">Référence</label>
          <input
            id="ref-bar-input"
            ref={refBarInputRef}
            className="ref-bar-input"
            value={selectedElement.label}
            onChange={e => canvas.updateLabel(selectedElement.id, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') e.target.blur()
            }}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  )
}
