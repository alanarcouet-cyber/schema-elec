import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { exportToPNG, exportToPDF } from '../../utils/exportUtils'
import { CABLE_STYLES } from '../Canvas/CableElement'
import './Toolbar.css'

const CABLE_TYPES = [
  { key: 'HTA_EXIST', label: 'HTA existante' },
  { key: 'HTA_NEW',   label: 'HTA construite' },
  { key: 'BT_EXIST',  label: 'BT existante' },
  { key: 'BT_NEW',    label: 'BT construite' },
]

function CableTypeSvg({ cableKey }) {
  const s = CABLE_STYLES[cableKey]
  return (
    <svg width="26" height="12" viewBox="0 0 26 12">
      <line
        x1="1" y1="6" x2="25" y2="6"
        stroke={s.color}
        strokeWidth={s.width}
        strokeDasharray={s.dash?.length ? s.dash.join(',') : undefined}
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Toolbar({ canvas, stageRef, schemaId, setSchemaId, session, setExporting }) {
  const [title, setTitle]             = useState('Nouveau schéma')
  const [saving, setSaving]           = useState(false)
  const [autoSaving, setAutoSaving]   = useState(false)
  const [showSchemas, setShowSchemas] = useState(false)
  const [schemas, setSchemas]         = useState([])
  const [isDirty, setIsDirty]         = useState(false)
  const lastSavedRef                  = useRef(null)

  // ── Persistance du dernier schéma ouvert ───────────────────────────────────
  // Sauvegarde schemaId dans localStorage pour le retrouver après refresh
  useEffect(() => {
    if (schemaId) localStorage.setItem('lastSchemaId', schemaId)
    else          localStorage.removeItem('lastSchemaId')
  }, [schemaId])

  // Auto-chargement au montage (après login) si un schéma était ouvert
  useEffect(() => {
    const lastId = localStorage.getItem('lastSchemaId')
    if (!lastId) return
    supabase.from('schemas').select('*').eq('id', lastId).single()
      .then(({ data }) => {
        if (!data) { localStorage.removeItem('lastSchemaId'); return }
        canvas.loadState(data.data)
        setTitle(data.title)
        setSchemaId(data.id)
        resetDirty()
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty tracking (#10) ────────────────────────────────────────────────────
  const canvasDataStr = useMemo(() =>
    JSON.stringify({ e: canvas.elements, c: canvas.cables, co: canvas.comments, a: canvas.anchors }),
    [canvas.elements, canvas.cables, canvas.comments, canvas.anchors]
  )

  useEffect(() => {
    if (lastSavedRef.current === null) { lastSavedRef.current = canvasDataStr; return }
    setIsDirty(canvasDataStr !== lastSavedRef.current)
  }, [canvasDataStr])

  const markSaved = useCallback(() => {
    lastSavedRef.current = canvasDataStr
    setIsDirty(false)
  }, [canvasDataStr])

  const resetDirty = useCallback(() => {
    lastSavedRef.current = null   // will re-init on next render
    setIsDirty(false)
  }, [])

  // ── Auto-save (#9) — 30 s après la dernière modification ───────────────────
  useEffect(() => {
    if (!isDirty || !schemaId) return
    const timer = setTimeout(async () => {
      setAutoSaving(true)
      const data = { elements: canvas.elements, cables: canvas.cables, comments: canvas.comments, anchors: canvas.anchors }
      await supabase.from('schemas')
        .update({ title, data, updated_at: new Date().toISOString() })
        .eq('id', schemaId)
        .catch(() => {})
      markSaved()
      setAutoSaving(false)
    }, 30_000)
    return () => clearTimeout(timer)
  }, [isDirty, schemaId, canvasDataStr, title, markSaved]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fit view (#7) ─────────────────────────────────────────────────────────
  const handleFitView = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const W = stage.width(), H = stage.height()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const el of canvas.elements) {
      const sym = canvas.symbols.find(s => s.id === el.symbolId)
      if (!sym) continue
      minX = Math.min(minX, el.x);           minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + sym.displayWidth)
      maxY = Math.max(maxY, el.y + sym.displayHeight)
    }
    for (const a of canvas.anchors) {
      minX = Math.min(minX, a.x); minY = Math.min(minY, a.y)
      maxX = Math.max(maxX, a.x); maxY = Math.max(maxY, a.y)
    }
    for (const c of canvas.comments) {
      minX = Math.min(minX, c.x); minY = Math.min(minY, c.y)
      maxX = Math.max(maxX, c.x + (c.width || 180))
      maxY = Math.max(maxY, c.y + 60)
    }

    if (!isFinite(minX)) { stage.scale({ x: 1, y: 1 }); stage.position({ x: 0, y: 0 }); return }

    const PAD = 60
    const cW = maxX - minX + PAD * 2, cH = maxY - minY + PAD * 2
    const scale = Math.min(W / cW, H / cH, 2)
    stage.scale({ x: scale, y: scale })
    stage.position({
      x: (W - cW * scale) / 2 - (minX - PAD) * scale,
      y: (H - cH * scale) / 2 - (minY - PAD) * scale,
    })
  }, [stageRef, canvas.elements, canvas.anchors, canvas.comments, canvas.symbols])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleNew = () => {
    // #11 — Confirmation si modifications non sauvegardées
    if (isDirty && !window.confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return
    canvas.clearCanvas()
    setTitle('Nouveau schéma')
    setSchemaId(null)
    resetDirty()
  }

  const handleSave = async () => {
    setSaving(true)
    const data = { elements: canvas.elements, cables: canvas.cables, comments: canvas.comments, anchors: canvas.anchors }
    try {
      if (schemaId) {
        await supabase.from('schemas')
          .update({ title, data, updated_at: new Date().toISOString() })
          .eq('id', schemaId)
      } else {
        const { data: row, error } = await supabase.from('schemas')
          .insert({ title, owner_id: session.user.id, data })
          .select()
          .single()
        if (!error) setSchemaId(row.id)
      }
      markSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleLoadList = async () => {
    const { data } = await supabase.from('schemas')
      .select('id, title, updated_at')
      .eq('owner_id', session.user.id)
      .order('updated_at', { ascending: false })
    setSchemas(data ?? [])
    setShowSchemas(true)
  }

  const handleOpenSchema = async (id) => {
    // #11 — Confirmation si modifications non sauvegardées
    if (isDirty && !window.confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return
    const { data } = await supabase.from('schemas').select('*').eq('id', id).single()
    if (data) {
      canvas.loadState(data.data)
      setTitle(data.title)
      setSchemaId(data.id)
      resetDirty()
    }
    setShowSchemas(false)
  }

  const handleDeleteSchema = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Supprimer ce schéma ?')) return
    await supabase.from('schemas').delete().eq('id', id)
    setSchemas(prev => prev.filter(s => s.id !== id))
    if (schemaId === id) { setSchemaId(null); setTitle('Nouveau schéma') }
  }

  const handleDuplicateSchema = async (e, id) => {
    e.stopPropagation()
    const { data: src } = await supabase.from('schemas').select('*').eq('id', id).single()
    if (!src) return
    const { data: copy } = await supabase.from('schemas')
      .insert({ title: `${src.title} (copie)`, owner_id: session.user.id, data: src.data })
      .select().single()
    if (copy) setSchemas(prev => [copy, ...prev])
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-brand">
          <span className="tb-bolt">⚡</span>
          <input
            className="tb-title"
            value={title}
            onChange={e => { setTitle(e.target.value); setIsDirty(true) }}
            title="Titre du schéma"
          />
          {/* #10 — Indicateur non sauvegardé */}
          {isDirty && <span className="tb-dirty" title="Modifications non sauvegardées">●</span>}
          {autoSaving && <span className="tb-autosave">Sauvegarde auto…</span>}
        </div>

        <div className="tb-tools">
          <button
            className="tb-tool"
            onClick={canvas.undo}
            disabled={!canvas.canUndo}
            title="Annuler (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7H11a3 3 0 010 6H8"/>
              <path d="M3 7L6 4M3 7L6 10"/>
            </svg>
          </button>
          <button
            className="tb-tool"
            onClick={canvas.redo}
            disabled={!canvas.canRedo}
            title="Rétablir (Ctrl+Y)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M13 7H5a3 3 0 000 6H8"/>
              <path d="M13 7L10 4M13 7L10 10"/>
            </svg>
          </button>
          <div className="tb-sep" />
          <button
            className={`tb-tool ${canvas.tool === 'select' ? 'active' : ''}`}
            onClick={() => canvas.setTool('select')}
            title="Sélection (S)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2l5 12 2-5 5-2L2 2z"/>
            </svg>
          </button>
          <button
            className={`tb-tool ${canvas.tool === 'cable' ? 'active' : ''}`}
            onClick={() => canvas.setTool('cable')}
            title="Câble (C)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8h4l2-4 2 4h4"/>
            </svg>
          </button>
          <button
            className={`tb-tool ${canvas.tool === 'pan' ? 'active' : ''}`}
            onClick={() => canvas.setTool('pan')}
            title="Panoramique"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1v4M8 11v4M1 8h4M11 8h4M8 6a2 2 0 100 4 2 2 0 000-4z"/>
            </svg>
          </button>
          <button
            className={`tb-tool ${canvas.tool === 'comment' ? 'active' : ''}`}
            onClick={() => canvas.setTool('comment')}
            title="Commentaire (N)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H9l-3 2v-2H2a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v1h10V4H3zm0 2v1h8V6H3zm0 2v1h6V8H3z"/>
            </svg>
          </button>
          {/* #7 — Centrer la vue */}
          <button
            className="tb-tool"
            onClick={handleFitView}
            title="Centrer la vue (ajuster au contenu)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 5V2h3M12 2h3v3M15 11v3h-3M4 14H1v-3"/>
              <rect x="4" y="4" width="8" height="8" rx="1"/>
            </svg>
          </button>
          <div className="tb-sep" />
          <button
            className="tb-tool danger"
            onClick={canvas.deleteSelected}
            title="Supprimer (Suppr)"
            disabled={!canvas.selectedId}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 2h4v1H6V2zM2 4h12v1H2V4zm2 2h8l-1 8H5L4 6zm2 1l.5 6h1L7 7H6zm3 0l-.5 6h1L10 7H9z"/>
            </svg>
          </button>
        </div>

        <div className="tb-right">
          <button className="tb-btn" onClick={handleNew} title="Nouveau schéma vierge">＋ Nouveau</button>
          <button className="tb-btn" onClick={handleLoadList}>📂 Mes schémas</button>
          <button className="tb-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : '💾 Enregistrer'}
          </button>
          <div className="tb-export-group">
            <button className="tb-btn" onClick={async () => { setExporting(true); await new Promise(r => setTimeout(r, 50)); exportToPNG(stageRef, canvas); setExporting(false) }}>PNG</button>
            <button className="tb-btn" onClick={async () => { setExporting(true); await new Promise(r => setTimeout(r, 50)); exportToPDF(stageRef, 'landscape', canvas); setExporting(false) }}>PDF ↔</button>
            <button className="tb-btn" onClick={async () => { setExporting(true); await new Promise(r => setTimeout(r, 50)); exportToPDF(stageRef, 'portrait', canvas); setExporting(false) }}>PDF ↕</button>
          </div>
          <span className="tb-user">{session.user.email}</span>
          <button className="tb-btn logout" onClick={() => supabase.auth.signOut()}>Déco</button>
        </div>
      </div>

      {/* ── Barre types de câbles ── */}
      <div className="cable-toolbar">
        <span className="cable-toolbar-label">Type de câble</span>
        {CABLE_TYPES.map(({ key, label }) => (
          <button
            key={key}
            className={`cable-toolbar-btn${canvas.tool === 'cable' && canvas.cableType === key ? ' active' : ''}`}
            onClick={() => {
              if (canvas.tool === 'cable' && canvas.cableType === key) {
                canvas.setTool('select')
              } else {
                canvas.setCableType(key)
                canvas.setTool('cable')
              }
            }}
            title={label}
          >
            <CableTypeSvg cableKey={key} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {showSchemas && (
        <div className="schemas-overlay" onClick={() => setShowSchemas(false)}>
          <div className="schemas-panel" onClick={e => e.stopPropagation()}>
            <div className="schemas-panel-header">
              <h3>Mes schémas</h3>
              <button onClick={() => setShowSchemas(false)}>✕</button>
            </div>
            {schemas.length === 0
              ? <p className="schemas-empty">Aucun schéma enregistré.</p>
              : schemas.map(s => (
                <div key={s.id} className="schema-row" onClick={() => handleOpenSchema(s.id)}>
                  <span className="schema-row-title">{s.title}</span>
                  <span className="schema-row-date">{new Date(s.updated_at).toLocaleDateString('fr-FR')}</span>
                  <div className="schema-row-actions">
                    <button className="schema-action-btn" title="Dupliquer" onClick={e => handleDuplicateSchema(e, s.id)}>⧉</button>
                    <button className="schema-action-btn danger" title="Supprimer" onClick={e => handleDeleteSchema(e, s.id)}>✕</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </>
  )
}
