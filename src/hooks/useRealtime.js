import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']

function colorFor(userId) {
  const hash = [...userId].reduce((a, c) => a + c.charCodeAt(0), 0)
  return COLORS[hash % COLORS.length]
}

export default function useRealtime(schemaId, canvas, session, setRemoteCursors) {
  const channelRef = useRef(null)
  const myId = session?.user?.id

  useEffect(() => {
    if (!schemaId || !myId) return

    const ch = supabase.channel(`schema:${schemaId}`)

    ch.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.userId === myId) return
      setRemoteCursors(prev => ({
        ...prev,
        [payload.userId]: {
          x: payload.x,
          y: payload.y,
          email: payload.email,
          color: colorFor(payload.userId),
        },
      }))
    })

    ch.on('broadcast', { event: 'canvas_update' }, ({ payload }) => {
      if (payload.userId === myId) return
      canvas.loadState({
        elements: payload.elements,
        cables:   payload.cables,
        comments: payload.comments,
        anchors:  payload.anchors,
      })
    })

    ch.subscribe()
    channelRef.current = ch

    return () => { ch.unsubscribe(); channelRef.current = null }
  }, [schemaId, myId])

  const broadcastCursor = useCallback((x, y) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { userId: myId, email: session?.user?.email, x, y },
    })
  }, [myId, session])

  const broadcastUpdate = useCallback((elements, cables, comments, anchors) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'canvas_update',
      payload: { userId: myId, elements, cables, comments, anchors },
    })
  }, [myId])

  return { broadcastCursor, broadcastUpdate }
}
