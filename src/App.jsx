import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { INITIAL_SYMBOLS } from './data/symbols'
import AuthModal from './components/Auth/AuthModal'
import Palette from './components/Palette/Palette'
import SymbolEditor from './components/Palette/SymbolEditor'
import CanvasStage from './components/Canvas/CanvasStage'
import Toolbar from './components/Toolbar/Toolbar'
import useCanvas from './hooks/useCanvas'
import useRealtime from './hooks/useRealtime'
import './App.css'

export default function App() {
  const [session, setSession]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [schemaId, setSchemaId]           = useState(null)
  const [remoteCursors, setRemoteCursors] = useState({})
  const [editingSymbol, setEditingSymbol] = useState(null)
  const [exporting, setExporting]         = useState(false)
  const stageRef = useRef(null)
  const canvas   = useCanvas()

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ── Load + seed shared symbols from Supabase on login ────────────────────
  useEffect(() => {
    if (!session) return

    const loadSymbols = async () => {
      let { data, error } = await supabase
        .from('symbol_library')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) return

      // Seed si la bibliothèque est vide, puis re-fetcher pour avoir _fromDb: true
      if (!data?.length) {
        await supabase.from('symbol_library').insert(
          INITIAL_SYMBOLS.map((s, i) => ({
            id:               s.id,
            name:             s.name,
            png_url:          s.pngPath,
            display_width:    s.displayWidth,
            display_height:   s.displayHeight,
            type:             s.type,
            label_prefix:     s.labelPrefix     || '',
            default_rotation: s.defaultRotation ?? 0,
            bornes:           s.bornes,
            sort_order:       i,
          }))
        )
        // Re-fetch pour que les symboles aient bien _fromDb: true
        const refetch = await supabase
          .from('symbol_library')
          .select('*')
          .order('sort_order', { ascending: true })
        if (refetch.error) return
        data = refetch.data
      }

      if (!data?.length) return

      const dbSymbols = data.map(row => ({
        id:              row.id,
        name:            row.name,
        pngPath:         row.png_url,
        displayWidth:    row.display_width    || 80,
        displayHeight:   row.display_height   || 80,
        type:            row.type             || 'BT',
        labelPrefix:     row.label_prefix     || '',
        defaultRotation: row.default_rotation ?? 0,
        bornes:          row.bornes           || [],
        _fromDb:         true,
      }))

      canvas.setSymbols(prev => {
        const byId = Object.fromEntries(dbSymbols.map(s => [s.id, s]))
        const prevIds = new Set(prev.map(s => s.id))
        const newSymbols = dbSymbols.filter(s => !prevIds.has(s.id))
        return [
          ...prev.map(s => byId[s.id] || s),  // remplace par version DB (avec _fromDb: true)
          ...newSymbols,
        ]
      })
    }

    loadSymbols()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime collaboration ────────────────────────────────────────────────
  const { broadcastCursor, broadcastUpdate } = useRealtime(schemaId, canvas, session, setRemoteCursors)

  useEffect(() => {
    if (schemaId) broadcastUpdate(canvas.elements, canvas.cables, canvas.comments, canvas.anchors)
  }, [canvas.elements, canvas.cables, canvas.comments, canvas.anchors]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add symbol (upload PNG → Supabase Storage → symbol_library) ──────────
  const handleAddSymbol = async (file) => {
    if (!file) return
    const id = uuidv4()
    const name = file.name.replace(/\.png$/i, '').replace(/_/g, ' ')

    // Try uploading to Supabase Storage bucket "symbols" (public)
    let pngPath = URL.createObjectURL(file)
    let uploadedToStorage = false
    try {
      const { error: upErr } = await supabase.storage
        .from('symbols')
        .upload(`${id}.png`, file, { contentType: 'image/png', upsert: false })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage
          .from('symbols')
          .getPublicUrl(`${id}.png`)
        pngPath = publicUrl
        uploadedToStorage = true
      }
    } catch (_) { /* Storage not configured — keep local blob URL */ }

    const newSym = {
      id,
      name,
      pngPath,
      displayWidth: 80,
      displayHeight: 80,
      type: 'BT',
      bornes: [
        { x: 40, y: 0,  name: 'A' },
        { x: 40, y: 80, name: 'B' },
      ],
      _fromDb: uploadedToStorage,
    }

    canvas.setSymbols(prev => [...prev, newSym])

    // Persist to shared library if upload succeeded
    if (uploadedToStorage) {
      await supabase.from('symbol_library').insert({
        id,
        name,
        png_url: pngPath,
        display_width: 80,
        display_height: 80,
        type: 'BT',
        bornes: newSym.bornes,
        sort_order: 9999,
        created_by: session?.user?.id,
      }).catch(() => {})
    }

    // Open editor immediately so user can configure bornes/name
    setEditingSymbol(newSym)
  }

  const handleSaveSymbol = async (updated) => {
    canvas.setSymbols(prev => prev.map(s => s.id === updated.id ? updated : s))
    // Sync to DB if it was a shared symbol
    if (updated._fromDb) {
      await supabase.from('symbol_library').update({
        name:             updated.name,
        display_width:    updated.displayWidth,
        display_height:   updated.displayHeight,
        type:             updated.type,
        label_prefix:     updated.labelPrefix     || '',
        default_rotation: updated.defaultRotation ?? 0,
        bornes:           updated.bornes,
      }).eq('id', updated.id).catch(() => {})
    }
  }

  const handleDeleteSymbol = async (id) => {
    canvas.setSymbols(prev => prev.filter(s => s.id !== id))
    // Toujours tenter la suppression en DB (pas de dépendance sur _fromDb)
    const { error } = await supabase.from('symbol_library').delete().eq('id', id)
    if (error) console.warn('Erreur suppression symbole:', error.message)
  }

  if (loading) return <div className="app-loading">Chargement…</div>
  if (!session) return <AuthModal />

  return (
    <div className="app">
      <Toolbar
        canvas={canvas}
        stageRef={stageRef}
        schemaId={schemaId}
        setSchemaId={setSchemaId}
        session={session}
        setExporting={setExporting}
      />
      <div className="workspace">
        <Palette
          symbols={canvas.symbols}
          onAddSymbol={handleAddSymbol}
          onConfigureSymbol={setEditingSymbol}
          onReorderSymbols={(fromIdx, toIdx) => {
            canvas.reorderSymbols(fromIdx, toIdx)
            // Calcule le nouvel ordre et persiste les sort_order en base
            const reordered = [...canvas.symbols]
            const [moved] = reordered.splice(fromIdx, 1)
            reordered.splice(toIdx, 0, moved)
            reordered.forEach((sym, idx) => {
              if (sym._fromDb) {
                supabase.from('symbol_library')
                  .update({ sort_order: idx })
                  .eq('id', sym.id)
                  .catch(() => {})
              }
            })
          }}
        />
        <CanvasStage
          canvas={canvas}
          stageRef={stageRef}
          remoteCursors={remoteCursors}
          onCursorMove={broadcastCursor}
          exporting={exporting}
        />
      </div>

      {editingSymbol && (
        <SymbolEditor
          symbol={editingSymbol}
          onSave={handleSaveSymbol}
          onDelete={handleDeleteSymbol}
          onClose={() => setEditingSymbol(null)}
        />
      )}
    </div>
  )
}
