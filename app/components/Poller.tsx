"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

export default function Poller({ isActive = false }: { isActive?: boolean }) {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const intervalMs = isActive ? 15000 : 60000

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => router.refresh(), intervalMs)
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
        router.refresh()
        startPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [startPolling, stopPolling, router])

  return (
    <button
      onClick={() => router.refresh()}
      className="fixed bottom-5 right-5 z-50 w-10 h-10 rounded-full bg-[#1e3d28] border border-[#2e5a3a] text-white/60 hover:text-white hover:bg-[#2e5a3a] transition-colors flex items-center justify-center shadow-lg"
      title="Refresh"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
    </button>
  )
}
