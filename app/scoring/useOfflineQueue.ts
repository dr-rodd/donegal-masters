"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

interface QueuedScore {
  id: string
  rows: any[]
  holeNumber: number
  enqueuedAt: number
}

type SyncState = "idle" | "syncing" | "synced"

const STORAGE_KEY = "offline_score_queue_v1"
const RETRY_MS    = 15_000
const SYNCED_FLASH_MS = 2_500

function loadQueue(): QueuedScore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedScore[]) : []
  } catch {
    return []
  }
}

function persistQueue(q: QueuedScore[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q))
  } catch {}
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedScore[]>([])
  const queueRef  = useRef<QueuedScore[]>([])
  const syncing   = useRef(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [syncState, setSyncState] = useState<SyncState>("idle")

  // Keep ref in sync with state so the interval can read it without a stale closure
  useEffect(() => { queueRef.current = queue }, [queue])

  // Persist to localStorage on every change
  useEffect(() => { persistQueue(queue) }, [queue])

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadQueue()
    if (stored.length > 0) {
      setQueue(stored)
      queueRef.current = stored
    }
  }, [])

  const doSync = useCallback(async () => {
    if (syncing.current || queueRef.current.length === 0) return
    syncing.current = true
    setSyncState("syncing")

    const batch = [...queueRef.current]
    const failed: QueuedScore[] = []

    for (const item of batch) {
      const { error } = await supabase
        .from("live_scores")
        .upsert(item.rows, { onConflict: "player_id,round_id,hole_number" })
      if (error) failed.push(item)
    }

    syncing.current = false
    setQueue(failed)
    queueRef.current = failed

    if (failed.length < batch.length) {
      // At least one item synced
      setSyncState("synced")
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setSyncState("idle"), SYNCED_FLASH_MS)
    } else {
      setSyncState("idle")
    }
  }, [])

  // Auto-retry every 15 s
  useEffect(() => {
    const id = setInterval(doSync, RETRY_MS)
    return () => clearInterval(id)
  }, [doSync])

  const enqueue = useCallback((rows: any[], holeNumber: number) => {
    const item: QueuedScore = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rows,
      holeNumber,
      enqueuedAt: Date.now(),
    }
    setQueue(prev => {
      // Replace any existing queued entry that covers the same player+hole combos
      const filtered = prev.filter(q =>
        !q.rows.some(r => item.rows.some(ir =>
          ir.player_id === r.player_id && ir.hole_number === r.hole_number
        ))
      )
      return [...filtered, item]
    })
  }, [])

  return { enqueue, queueSize: queue.length, syncState, retryNow: doSync }
}
