import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { INITIAL_SYMBOLS } from '../data/symbols'

const MAX_HISTORY = 50

const initialState = {
  elements: [],
  cables: [],
  comments: [],
  anchors: [],          // floating cable endpoints
  selectedId: null,
  cableStart: null,     // { type:'element', elementId, borneIdx } | { type:'anchor', anchorId }
  tool: 'select',       // 'select' | 'cable' | 'pan' | 'comment'
  cableType: 'BT_EXIST',
  // History stacks — not exposed to consumers
  past: [],
  future: [],
}

/** Extract only the data that participates in undo/redo */
function snap(s) {
  return { elements: s.elements, cables: s.cables, comments: s.comments, anchors: s.anchors }
}

/** Produce the next state, pushing current data to past and clearing future */
function commit(prev, changes) {
  return {
    ...prev,
    ...changes,
    past: [...prev.past.slice(-(MAX_HISTORY - 1)), snap(prev)],
    future: [],
  }
}

export default function useCanvas() {
  const [state, setState] = useState(initialState)
  const [symbols, setSymbols] = useState(INITIAL_SYMBOLS)

  const addElement = useCallback((symbolId, x, y) => {
    const sym = symbols.find(s => s.id === symbolId)
    if (!sym) return
    const newId = uuidv4()
    setState(prev => {
      const prefix = sym.labelPrefix || sym.name.split(' ').map(w => w[0]).join('').toUpperCase()
      const count  = prev.elements.filter(el => el.symbolId === symbolId).length + 1
      return commit(prev, {
        selectedId: newId,
        elements: [...prev.elements, {
          id: newId, symbolId, x, y,
          rotation: sym.defaultRotation ?? 0,
          label: `${prefix}${count}`, labelOffsetX: 0, labelOffsetY: 0,
        }],
      })
    })
    return newId
  }, [symbols])

  const moveElement = useCallback((id, x, y) => {
    setState(prev => commit(prev, {
      elements: prev.elements.map(el => el.id === id ? { ...el, x, y } : el),
    }))
  }, [])

  const rotateElement = useCallback((id, delta) => {
    setState(prev => commit(prev, {
      elements: prev.elements.map(el =>
        el.id === id ? { ...el, rotation: ((el.rotation || 0) + delta + 360) % 360 } : el
      ),
    }))
  }, [])

  const selectElement = useCallback((id) => {
    setState(prev => ({ ...prev, selectedId: id }))  // UI only — no history
  }, [])

  const updateLabel = useCallback((id, label) => {
    setState(prev => commit(prev, {
      elements: prev.elements.map(el => el.id === id ? { ...el, label } : el),
    }))
  }, [])

  const updateCableLabel = useCallback((id, label) => {
    setState(prev => commit(prev, {
      cables: prev.cables.map(c => c.id === id ? { ...c, label } : c),
    }))
  }, [])

  const setTool = useCallback((tool) => {
    setState(prev => ({ ...prev, tool, cableStart: null, selectedId: null }))  // UI only
  }, [])

  const setCableType = useCallback((cableType) => {
    setState(prev => ({ ...prev, cableType }))  // UI only
  }, [])

  // ── Cable drawing ─────────────────────────────────────────────────────────

  const startCable = useCallback((elementId, borneIdx) => {
    setState(prev => ({ ...prev, cableStart: { type: 'element', elementId, borneIdx } }))  // UI only
  }, [])

  const startCableFromAnchor = useCallback((anchorId) => {
    setState(prev => ({ ...prev, cableStart: { type: 'anchor', anchorId } }))  // UI only
  }, [])

  const endCable = useCallback((toElementId, toBorneIdx) => {
    setState(prev => {
      if (!prev.cableStart) return { ...prev, cableStart: null }
      if (prev.cableStart.type === 'element' && prev.cableStart.elementId === toElementId) {
        return { ...prev, cableStart: null }
      }
      const from = prev.cableStart.type === 'element'
        ? { fromElementId: prev.cableStart.elementId, fromBorneIdx: prev.cableStart.borneIdx }
        : { fromAnchorId: prev.cableStart.anchorId }
      return commit(prev, {
        cables: [...prev.cables, { id: uuidv4(), ...from, toElementId, toBorneIdx, type: prev.cableType, label: '' }],
        cableStart: null,
      })
    })
  }, [])

  const endCableToAnchor = useCallback((anchorId) => {
    setState(prev => {
      if (!prev.cableStart) return { ...prev, cableStart: null }
      if (prev.cableStart.type === 'anchor' && prev.cableStart.anchorId === anchorId) {
        return { ...prev, cableStart: null }
      }
      const from = prev.cableStart.type === 'element'
        ? { fromElementId: prev.cableStart.elementId, fromBorneIdx: prev.cableStart.borneIdx }
        : { fromAnchorId: prev.cableStart.anchorId }
      return commit(prev, {
        cables: [...prev.cables, { id: uuidv4(), ...from, toAnchorId: anchorId, type: prev.cableType, label: '' }],
        cableStart: null,
      })
    })
  }, [])

  // ── Floating anchors ──────────────────────────────────────────────────────

  const addAnchor = useCallback((x, y) => {
    const id = uuidv4()
    setState(prev => commit(prev, { anchors: [...prev.anchors, { id, x, y }] }))
    return id
  }, [])

  const moveAnchor = useCallback((id, x, y) => {
    setState(prev => commit(prev, {
      anchors: prev.anchors.map(a => a.id === id ? { ...a, x, y } : a),
    }))
  }, [])

  // ── Delete selected ───────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    setState(prev => {
      if (!prev.selectedId) return prev
      const id = prev.selectedId
      return commit(prev, {
        elements: prev.elements.filter(el => el.id !== id),
        cables: prev.cables.filter(c =>
          c.id !== id &&                                 // câble lui-même sélectionné
          c.fromElementId !== id && c.toElementId !== id &&
          c.fromAnchorId !== id && c.toAnchorId !== id
        ),
        comments: prev.comments.filter(c => c.id !== id),
        anchors:  prev.anchors.filter(a => a.id !== id),
        selectedId: null,
      })
    })
  }, [])

  // ── Comments ──────────────────────────────────────────────────────────────

  const addComment = useCallback((x, y) => {
    const id = uuidv4()
    setState(prev => commit(prev, {
      comments: [...prev.comments, { id, x, y, text: '', width: 180 }],
      selectedId: id,
    }))
    return id
  }, [])

  const moveComment = useCallback((id, x, y) => {
    setState(prev => commit(prev, {
      comments: prev.comments.map(c => c.id === id ? { ...c, x, y } : c),
    }))
  }, [])

  const updateComment = useCallback((id, text) => {
    setState(prev => commit(prev, {
      comments: prev.comments.map(c => c.id === id ? { ...c, text } : c),
    }))
  }, [])

  const updateCommentSize = useCallback((id, width, height) => {
    setState(prev => commit(prev, {
      comments: prev.comments.map(c => c.id === id ? { ...c, width, height } : c),
    }))
  }, [])

  // ── Reorder palette symbols ───────────────────────────────────────────────

  const reorderSymbols = useCallback((fromIdx, toIdx) => {
    setSymbols(prev => {
      const arr = [...prev]
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return arr
    })
  }, [])

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    setState(prev => {
      if (!prev.past.length) return prev
      const past    = [...prev.past]
      const restored = past.pop()
      return {
        ...prev,
        ...restored,
        past,
        future: [snap(prev), ...prev.future.slice(0, MAX_HISTORY - 1)],
        selectedId: null,
        cableStart: null,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState(prev => {
      if (!prev.future.length) return prev
      const [restored, ...future] = prev.future
      return {
        ...prev,
        ...restored,
        past: [...prev.past.slice(-(MAX_HISTORY - 1)), snap(prev)],
        future,
        selectedId: null,
        cableStart: null,
      }
    })
  }, [])

  // ── Persistence ───────────────────────────────────────────────────────────

  const loadState = useCallback(({ elements, cables, comments, anchors }) => {
    setState(prev => commit(prev, {
      elements: elements || [],
      cables:   cables   || [],
      comments: comments ?? [],
      anchors:  anchors  ?? [],
    }))
  }, [])

  const clearCanvas = useCallback(() => {
    setState(prev => commit(prev, { elements: [], cables: [], comments: [], anchors: [], selectedId: null, cableStart: null }))
  }, [])

  return {
    // Canvas data (spread state but hide past/future)
    elements:   state.elements,
    cables:     state.cables,
    comments:   state.comments,
    anchors:    state.anchors,
    selectedId: state.selectedId,
    cableStart: state.cableStart,
    tool:       state.tool,
    cableType:  state.cableType,
    // History flags
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    // Symbols
    symbols,
    setSymbols,
    // Actions
    addElement,
    moveElement,
    rotateElement,
    selectElement,
    updateLabel,
    setTool,
    setCableType,
    startCable,
    startCableFromAnchor,
    endCable,
    endCableToAnchor,
    addAnchor,
    moveAnchor,
    deleteSelected,
    addComment,
    moveComment,
    updateComment,
    updateCommentSize,
    reorderSymbols,
    updateCableLabel,
    loadState,
    clearCanvas,
    undo,
    redo,
  }
}
