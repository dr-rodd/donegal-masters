"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

export default function Poller({
  isActive = false,
  isPaused = false,
}: {
  isActive?: boolean
  isPaused?: boolean
}) {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(isPaused)

  // Keep ref in sync with prop so interval closure always reads latest value
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])

  const intervalMs = isActive ? 15000 : 60000

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (!isPausedRef.current) router.refresh()
    }, intervalMs)
  }, [intervalMs, router])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!document.hidden) startPolling()

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        if (!isPausedRef.current) router.refresh()
        startPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [startPolling, stopPolling, router])

  return null
}
