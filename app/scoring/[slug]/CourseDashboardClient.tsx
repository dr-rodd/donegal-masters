"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import LiveScoringFlow from "../LiveScoringFlow"
import LiveLeaderboardPanel from "../LiveLeaderboardPanel"
import type { ActiveLiveRound } from "../ScoringClient"

// ─── Types ────────────────────────────────────────────────

interface LiveRoundFull extends ActiveLiveRound {
  activated_at: string
}

interface ScorecardInfo {
  liveRound: LiveRoundFull
  playerNames: string[]
  holesThrough: number   // max hole_number any group player has scored
  finalised: boolean
}

interface Player {
  id: string; name: string; role: string; handicap: number
  gender: string; is_composite: boolean
  teams: { name: string; color: string } | null
}
interface Round {
  id: string; round_number: number; status: string
  courses: { id: string; name: string } | null
}
interface Hole {
  id: string; hole_number: number; par: number; stroke_index: number; course_id: string
  par_ladies?: number; stroke_index_ladies?: number
  yardage_black?: number; yardage_blue?: number; yardage_white?: number; yardage_red?: number
  yardage_sandstone?: number; yardage_slate?: number; yardage_granite?: number; yardage_claret?: number
}
interface Tee {
  id: string; course_id: string; name: string; gender: string
  par: number; course_rating: number; slope: number
}
interface RoundHandicap { round_id: string; player_id: string; playing_handicap: number }

interface Props {
  courseName: string
  courseId: string
  players: Player[]
  rounds: Round[]
  holes: Hole[]
  tees: Tee[]
  roundHandicaps: RoundHandicap[]
}

type View = "dashboard" | "scoring" | "live-board"

// ─── Component ────────────────────────────────────────────

export default function CourseDashboardClient({
  courseName, courseId, players, rounds, holes, tees, roundHandicaps,
}: Props) {
  const [view, setView]                       = useState<View>("dashboard")
  const [scoringLiveRound, setScoringLiveRound] = useState<ActiveLiveRound | null>(null)
  const [isResuming, setIsResuming]           = useState(false)
  const [starting, setStarting]               = useState(false)
  const [showLiveLeaderboard, setShowLiveLeaderboard] = useState(false)
  const [scorecards, setScorecards]           = useState<ScorecardInfo[]>([])
  const [loading, setLoading]                 = useState(true)

  const nonComposite = players.filter(p => !p.is_composite)

  // Only pass this course's round to LiveScoringFlow so the "activate" step
  // only shows the one relevant round.
  const courseRoundsForFlow = rounds.filter(r => r.courses?.id === courseId)

  const fetchScorecards = useCallback(async () => {
    const { data: liveRoundsData } = await supabase
      .from("live_rounds")
      .select("id, course_id, round_id, status, activated_at, activated_by, rounds(round_number), courses(name)")
      .eq("course_id", courseId)
      .in("status", ["active", "finalised"])

    if (!liveRoundsData || liveRoundsData.length === 0) {
      setScorecards([])
      setLoading(false)
      return
    }

    const liveRoundIds = liveRoundsData.map((lr: any) => lr.id)
    const roundIds     = [...new Set(liveRoundsData.map((lr: any) => lr.round_id as string))]

    const [locksRes, scoresRes] = await Promise.all([
      supabase
        .from("live_player_locks")
        .select("live_round_id, player_id")
        .in("live_round_id", liveRoundIds),
      supabase
        .from("live_scores")
        .select("player_id, round_id, hole_number")
        .in("round_id", roundIds)
        .not("gross_score", "is", null),
    ])

    const locks  = locksRes.data  ?? []
    const scores = scoresRes.data ?? []

    const cards: ScorecardInfo[] = (liveRoundsData as any[]).map(lr => {
      const playerIds = locks
        .filter((l: any) => l.live_round_id === lr.id)
        .map((l: any) => l.player_id as string)

      const playerNames = playerIds
        .map((pid: string) => players.find(p => p.id === pid)?.name)
        .filter((n): n is string => Boolean(n))

      const groupScores = scores.filter(
        (s: any) => playerIds.includes(s.player_id) && s.round_id === lr.round_id
      )
      const holesThrough = groupScores.length > 0
        ? Math.max(...groupScores.map((s: any) => s.hole_number as number))
        : 0

      return { liveRound: lr as LiveRoundFull, playerNames, holesThrough, finalised: lr.status === "finalised" }
    })

    setScorecards(cards)
    setLoading(false)
  }, [courseId, players])

  useEffect(() => {
    fetchScorecards()
    const interval = setInterval(fetchScorecards, 15000)
    return () => clearInterval(interval)
  }, [fetchScorecards])

  // Reference live round for the leaderboard panel — prefer active, fall back to any
  const firstLiveRound = (
    (scorecards.find(s => !s.finalised) ?? scorecards[0])?.liveRound ?? null
  ) as ActiveLiveRound | null

  // ─── Navigation helpers ───────────────────────────────────

  function goBack() {
    setView("dashboard")
    setShowLiveLeaderboard(false)
    setScoringLiveRound(null)
    setIsResuming(false)
  }

  function openScoring(liveRound: ActiveLiveRound) {
    setScoringLiveRound(liveRound)
    setIsResuming(true)
    setShowLiveLeaderboard(false)
    setView("scoring")
  }

  async function startNewScorecard() {
    const courseRound = rounds.find(r => r.courses?.id === courseId)
    if (!courseRound) return
    setStarting(true)
    const { data } = await supabase
      .from("live_rounds")
      .insert({ course_id: courseId, round_id: courseRound.id, status: "active" })
      .select("id, course_id, round_id, activated_by, rounds(round_number), courses(name)")
      .single()
    setStarting(false)
    if (!data) return
    setScoringLiveRound(data as unknown as ActiveLiveRound)
    setIsResuming(false)
    setShowLiveLeaderboard(false)
    setView("scoring")
    fetchScorecards()
  }

  // ─── Header ───────────────────────────────────────────────

  const headerLeft = view === "dashboard"
    ? <Link href="/scoring" className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors">← Courses</Link>
    : <button onClick={goBack} className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors">← Back</button>

  const headerRight = view === "scoring" && scoringLiveRound && isResuming
    ? <button
        onClick={() => setShowLiveLeaderboard(v => !v)}
        className={`text-xs tracking-[0.2em] uppercase transition-colors w-[80px] text-right
          ${showLiveLeaderboard ? "text-[#C9A84C]" : "text-white/40 hover:text-white/60"}`}
      >
        {showLiveLeaderboard ? "← Scores" : "Leaderboard"}
      </button>
    : view === "dashboard" && firstLiveRound
      ? <button
          onClick={() => setView("live-board")}
          className="text-white/40 text-xs tracking-[0.2em] uppercase hover:text-[#C9A84C] transition-colors w-[80px] text-right"
        >
          Board →
        </button>
      : <div className="w-[80px]" />

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">

      {/* Sticky header */}
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          {headerLeft}
          <h1 className="font-[family-name:var(--font-playfair)] text-lg text-white tracking-wide">
            {courseName}
          </h1>
          {headerRight}
        </div>
      </div>

      {/* ── Dashboard ── */}
      {view === "dashboard" && (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* Active scorecards */}
          <section>
            <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mb-3">
              Active Scorecards
            </p>

            {loading ? (
              <p className="text-white/20 text-sm py-4">Loading…</p>
            ) : scorecards.length === 0 ? (
              <div className="border border-[#1e3d28] rounded-sm px-4 py-5">
                <p className="text-white/25 text-sm">No active scorecards</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scorecards.map(({ liveRound, playerNames, holesThrough, finalised }) => {
                  const startedAt = new Date(liveRound.activated_at).toLocaleTimeString("en-IE", {
                    hour: "2-digit", minute: "2-digit",
                  })
                  const holeLabel = finalised
                    ? "18 holes · Finalised"
                    : holesThrough === 0
                      ? "Starting"
                      : holesThrough >= 18
                        ? "Through 18"
                        : `Through ${holesThrough}`

                  return (
                    <div
                      key={liveRound.id}
                      onClick={() => !finalised && openScoring(liveRound)}
                      className={`w-full text-left border rounded-sm px-4 py-4 transition-colors
                        ${finalised
                          ? "border-[#C9A84C]/30 bg-[#C9A84C]/5 cursor-default"
                          : "border-[#1e3d28] hover:border-green-600/50 bg-[#0f2418] hover:bg-[#0d2015] cursor-pointer"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold leading-snug">
                            {playerNames.length > 0 ? playerNames.join(", ") : "No players locked in yet"}
                          </p>
                          <p className={`text-xs mt-1 ${finalised ? "text-[#C9A84C]/60" : "text-white/35"}`}>
                            {holeLabel} · Started {startedAt}
                          </p>
                        </div>
                        {finalised ? (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold tracking-wide">
                            ✓ Done
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-[#C9A84C] text-xs tracking-wider uppercase pt-0.5">
                            Score →
                          </span>
                        )}
                      </div>

                      {/* Hole progress bar — only for active in-progress scorecards */}
                      {!finalised && holesThrough > 0 && holesThrough < 18 && (
                        <div className="mt-3 flex gap-[2px]">
                          {Array.from({ length: 18 }).map((_, i) => (
                            <div
                              key={i}
                              className={`flex-1 h-1 rounded-full ${i < holesThrough ? "bg-green-500/60" : "bg-white/10"}`}
                            />
                          ))}
                        </div>
                      )}
                      {/* Full gold bar for finalised */}
                      {finalised && (
                        <div className="mt-3 flex gap-[2px]">
                          {Array.from({ length: 18 }).map((_, i) => (
                            <div key={i} className="flex-1 h-1 rounded-full bg-[#C9A84C]/40" />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Actions */}
          <div className="space-y-3 pt-1">
            <button
              onClick={startNewScorecard}
              disabled={starting}
              className="w-full py-4 border border-[#C9A84C]/40 text-[#C9A84C] text-sm tracking-[0.2em] uppercase hover:bg-[#C9A84C]/10 disabled:opacity-50 transition-colors rounded-sm"
            >
              {starting ? "Starting…" : "+ Start New Scorecard"}
            </button>

            {firstLiveRound && (
              <button
                onClick={() => setView("live-board")}
                className="w-full py-3 border border-white/10 text-white/30 text-xs tracking-[0.2em] uppercase hover:border-white/20 hover:text-white/50 transition-colors rounded-sm"
              >
                View Live Leaderboard →
              </button>
            )}
          </div>

        </div>
      )}

      {/* ── Scoring ── */}
      {view === "scoring" && (
        <LiveScoringFlow
          players={nonComposite}
          rounds={courseRoundsForFlow}
          holes={holes}
          tees={tees}
          roundHandicaps={roundHandicaps}
          activeLiveRound={scoringLiveRound}
          autoResume={isResuming}
          onBack={goBack}
          onLiveRoundChange={r => {
            setScoringLiveRound(r)
            if (r) fetchScorecards()
          }}
          showLeaderboard={showLiveLeaderboard}
          onLeaderboardChange={setShowLiveLeaderboard}
        />
      )}

      {/* ── Live board ── */}
      {view === "live-board" && firstLiveRound && (
        <LiveLeaderboardPanel
          liveRound={firstLiveRound}
          players={nonComposite}
          holes={holes}
          roundHandicaps={roundHandicaps}
          onClose={goBack}
          showBackButton={true}
        />
      )}

    </div>
  )
}
