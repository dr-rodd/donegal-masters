"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface Course {
  id: string
  name: string
  slug: string
}

interface LiveRound {
  id: string
  course_id: string
  round_id: string
  status: string
  session_finalised_at: string | null
}


const COURSES: Course[] = [
  { id: "", name: "Old Tom Morris",   slug: "old-tom-morris" },
  { id: "", name: "St Patrick Links", slug: "st-patricks-links" },
  { id: "", name: "Sandy Hills",      slug: "sandy-hills" },
]

interface CourseCardState {
  course: Course
  isActive: boolean
  isCompleted: boolean
  isMixed: boolean
  finalisedCount: number
  activeCount: number
}

export default function CoursePortalClient({ courseIds, totalPlayers }: { courseIds: Record<string, string>; totalPlayers: number }) {
  const router = useRouter()
  const [cards, setCards] = useState<CourseCardState[]>(
    COURSES.map(c => ({ course: { ...c, id: courseIds[c.name] ?? "" }, isActive: false, isCompleted: false, isMixed: false, finalisedCount: 0, activeCount: 0 }))
  )

  async function fetchState() {
    const { data } = await supabase
      .from("live_rounds")
      .select("id, course_id, round_id, status, session_finalised_at")
      .in("status", ["active", "finalised"])

    const liveRounds: LiveRound[] = data ?? []

    // Fetch all player locks for these rounds (need player_id to count per state)
    const allIds = liveRounds.map(lr => lr.id)
    let lockRows: { live_round_id: string; player_id: string }[] = []
    if (allIds.length > 0) {
      const { data } = await supabase
        .from("live_player_locks")
        .select("live_round_id, player_id")
        .in("live_round_id", allIds)
      lockRows = (data ?? []) as { live_round_id: string; player_id: string }[]
    }

    setCards(COURSES.map(c => {
      const cid = courseIds[c.name] ?? ""
      const courseRounds = liveRounds.filter(lr => lr.course_id === cid)

      const activeIds    = new Set(courseRounds.filter(lr => lr.status === "active").map(lr => lr.id))
      const finalisedIds = new Set(courseRounds.filter(lr => lr.status === "finalised").map(lr => lr.id))

      // Unique players in each state for this course
      const activePlayers    = new Set(lockRows.filter(l => activeIds.has(l.live_round_id)).map(l => l.player_id))
      const finalisedPlayers = new Set(lockRows.filter(l => finalisedIds.has(l.live_round_id)).map(l => l.player_id))

      const isActive = activePlayers.size > 0
      // Explicitly finalised by admin via "Finalise Session"
      const sessionFinalised = courseRounds.some(lr => lr.session_finalised_at != null)
      // Natural completion: every player in the pool has a finalised scorecard
      const allFinalised = totalPlayers > 0
        && finalisedPlayers.size === totalPlayers
        && activePlayers.size === 0
      const isCompleted = allFinalised || sessionFinalised
      const isMixed = activePlayers.size > 0 && finalisedPlayers.size > 0 && !isCompleted

      return { course: { ...c, id: cid }, isActive, isCompleted, isMixed, finalisedCount: finalisedPlayers.size, activeCount: activePlayers.size }
    }))
  }

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-4 space-y-3">
      {cards.map(({ course, isActive, isCompleted, isMixed, finalisedCount, activeCount }) => (
        <button
          key={course.slug}
          onClick={() => router.push(`/scoring/${course.slug}`)}
          className={`w-full text-left rounded-sm border transition-all duration-300 overflow-hidden
            ${isCompleted
              ? "border-[#C9A84C]/30 bg-[#0f2418]"
              : isMixed
                ? "border-amber-600/50 shadow-[0_0_24px_rgba(217,119,6,0.15)] bg-[#1a1a0a]"
                : isActive
                  ? "border-green-500/70 shadow-[0_0_24px_rgba(34,197,94,0.20)] bg-[#0a2010]"
                  : "border-[#1e3d28] bg-[#0f2418]"
            }`}
        >
          <div className="px-5 py-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-playfair)] text-white text-xl leading-tight">
                {course.name}
              </p>
              {isMixed && (
                <p className="text-amber-400/80 text-sm mt-1 font-medium tracking-wide">
                  {finalisedCount} done · {activeCount} still scoring
                </p>
              )}
              {isActive && !isCompleted && !isMixed && (
                <p className="text-green-400 text-sm mt-1 font-medium tracking-wide">
                  Live scoring in progress
                </p>
              )}
              {isCompleted && (
                <p className="text-[#C9A84C] text-sm mt-1 font-medium tracking-wide">
                  All scorecards complete
                </p>
              )}
              {!isActive && (
                <p className="text-white/25 text-sm mt-1">No active sessions</p>
              )}
            </div>

            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C] text-sm font-semibold tracking-wide">
                  ✓ Completed
                </span>
              )}
              {isMixed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-amber-600/40 bg-amber-600/10 text-amber-400/80 text-sm font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Partial
                </span>
              )}
              {isActive && !isCompleted && !isMixed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-green-500/40 bg-green-500/10 text-green-400 text-sm font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Active
                </span>
              )}
              <span className="text-white/30 text-sm">View →</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
