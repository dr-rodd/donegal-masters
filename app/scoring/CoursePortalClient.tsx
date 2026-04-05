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
}

export default function CoursePortalClient({ courseIds, totalPlayers }: { courseIds: Record<string, string>; totalPlayers: number }) {
  const router = useRouter()
  const [cards, setCards] = useState<CourseCardState[]>(
    COURSES.map(c => ({ course: { ...c, id: courseIds[c.name] ?? "" }, isActive: false, isCompleted: false }))
  )

  async function fetchState() {
    const { data } = await supabase
      .from("live_rounds")
      .select("id, course_id, round_id, status")
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
      // Complete only when every player in the pool has a finalised scorecard
      // and none remain in an active (in-progress) scorecard
      const isCompleted = totalPlayers > 0
        && finalisedPlayers.size === totalPlayers
        && activePlayers.size === 0

      return { course: { ...c, id: cid }, isActive, isCompleted }
    }))
  }

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-4 space-y-3">
      {cards.map(({ course, isActive, isCompleted }) => (
        <button
          key={course.slug}
          onClick={() => router.push(`/scoring/${course.slug}`)}
          className={`w-full text-left rounded-sm border transition-all duration-300 overflow-hidden
            ${isActive
              ? "border-green-500/70 shadow-[0_0_24px_rgba(34,197,94,0.20)] bg-[#0a2010]"
              : "border-[#1e3d28] bg-[#0f2418]"
            }`}
        >
          <div className="px-5 py-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-playfair)] text-white text-lg leading-tight">
                {course.name}
              </p>
              {isActive && !isCompleted && (
                <p className="text-green-400 text-xs mt-1 font-medium tracking-wide">
                  Live scoring in progress
                </p>
              )}
              {isCompleted && (
                <p className="text-[#C9A84C] text-xs mt-1 font-medium tracking-wide">
                  All scorecards complete
                </p>
              )}
              {!isActive && (
                <p className="text-white/25 text-xs mt-1">No active sessions</p>
              )}
            </div>

            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold tracking-wide">
                  ✓ Completed
                </span>
              )}
              {isActive && !isCompleted && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-green-500/40 bg-green-500/10 text-green-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Active
                </span>
              )}
              <span className="text-white/30 text-xs">View →</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
