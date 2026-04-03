"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────

export interface LiveRoundRef {
  id: string
  course_id: string
  round_id: string
  rounds: { round_number: number } | null
  courses: { name: string } | null
}

interface Player {
  id: string
  name: string
  gender: string
  teams: { name: string; color: string } | null
}

interface Hole {
  course_id: string
  hole_number: number
  stroke_index: number
  stroke_index_ladies?: number
}

interface RoundHandicap {
  round_id: string
  player_id: string
  playing_handicap: number
}

interface LiveScoreRow {
  player_id: string
  hole_number: number
  gross_score: number | null
  stableford_points: number | null
}

// ─── Helpers ──────────────────────────────────────────────

const ST_PATRICKS_COURSE_ID = "11111111-0000-0000-0000-000000000003"

function shotsReceived(si: number, hcp: number) {
  return Math.floor(hcp / 18) + (si <= hcp % 18 ? 1 : 0)
}

function effectiveSI(hole: Hole, gender: string, courseId: string) {
  return gender === "F" && courseId === ST_PATRICKS_COURSE_ID && hole.stroke_index_ladies
    ? hole.stroke_index_ladies
    : hole.stroke_index
}

// ─── Types ────────────────────────────────────────────────

type Mode = "stableford" | "strokes"
type StrokesView = "gross" | "nett"

interface Props {
  liveRound: LiveRoundRef
  players: Player[]
  holes: Hole[]
  roundHandicaps: RoundHandicap[]
  onClose?: () => void
  showBackButton?: boolean
}

// ─── Component ────────────────────────────────────────────

export default function LiveLeaderboardPanel({
  liveRound, players, holes, roundHandicaps, onClose, showBackButton = false,
}: Props) {
  const [liveScores, setLiveScores] = useState<LiveScoreRow[]>([])
  const [mode, setMode] = useState<Mode>("stableford")
  const [strokesView, setStrokesView] = useState<StrokesView>("nett")
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const courseHoles = holes
    .filter(h => h.course_id === liveRound.course_id)
    .sort((a, b) => a.hole_number - b.hole_number)

  const fetchScores = useCallback(async () => {
    const { data } = await supabase
      .from("live_scores")
      .select("player_id, hole_number, gross_score, stableford_points")
      .eq("round_id", liveRound.round_id)
      .eq("committed", false)
    if (data) {
      setLiveScores(data as LiveScoreRow[])
      setLastFetch(new Date())
    }
  }, [liveRound.round_id])

  useEffect(() => {
    fetchScores()
    const interval = setInterval(fetchScores, 15000)

    const channel = supabase
      .channel(`live-lb-${liveRound.round_id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "live_scores",
        filter: `round_id=eq.${liveRound.round_id}`,
      }, () => fetchScores())
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [fetchScores, liveRound.round_id])

  // ─── Build ranked rows ────────────────────────────────────

  const playerRows = players
    .map(player => {
      const playerScores = liveScores.filter(
        ls => ls.player_id === player.id && ls.gross_score !== null
      )
      const holesCompleted = playerScores.length
      if (holesCompleted === 0) return null

      const totalStableford = playerScores.reduce((s, ls) => s + (ls.stableford_points ?? 0), 0)
      const stablefordRelative = totalStableford - holesCompleted * 2
      const totalGross = playerScores.reduce((s, ls) => s + (ls.gross_score ?? 0), 0)

      const hcp = roundHandicaps.find(
        rh => rh.round_id === liveRound.round_id && rh.player_id === player.id
      )?.playing_handicap ?? 0

      let totalNett = 0
      for (const ls of playerScores) {
        const hole = courseHoles.find(h => h.hole_number === ls.hole_number)
        if (!hole || ls.gross_score === null) continue
        totalNett += ls.gross_score - shotsReceived(effectiveSI(hole, player.gender, liveRound.course_id), hcp)
      }

      return { player, holesCompleted, stablefordRelative, gross: totalGross, nett: totalNett }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      if (mode === "stableford") {
        return b.stablefordRelative - a.stablefordRelative || b.holesCompleted - a.holesCompleted
      }
      const aScore = strokesView === "gross" ? a.gross : a.nett
      const bScore = strokesView === "gross" ? b.gross : b.nett
      return aScore - bScore || b.holesCompleted - a.holesCompleted
    })

  const roundLabel = `Round ${liveRound.rounds?.round_number ?? "?"} — ${liveRound.courses?.name ?? ""}`

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 text-xs tracking-[0.2em] uppercase">{roundLabel}</span>
        </div>
        {showBackButton && onClose && (
          <button
            onClick={onClose}
            className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex border border-[#1e3d28]">
        {(["stableford", "strokes"] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors
              ${mode === m ? "bg-[#1e3d28] text-[#C9A84C]" : "text-white/40 hover:text-white/60"}`}
          >
            {m === "stableford" ? "Stableford" : "Strokes"}
          </button>
        ))}
      </div>

      {/* Strokes sub-toggle */}
      {mode === "strokes" && (
        <div className="flex border border-[#1e3d28]">
          {(["nett", "gross"] as StrokesView[]).map(sv => (
            <button
              key={sv}
              onClick={() => setStrokesView(sv)}
              className={`flex-1 py-2 text-xs tracking-[0.15em] uppercase transition-colors
                ${strokesView === sv ? "bg-[#1e3d28] text-white/80" : "text-white/30 hover:text-white/50"}`}
            >
              {sv}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard table */}
      {playerRows.length === 0 ? (
        <div className="border border-[#1e3d28] px-4 py-10 text-center">
          <div className="text-white/20 text-sm">No scores yet</div>
          <div className="text-white/10 text-xs mt-1">Scores appear as holes are completed</div>
        </div>
      ) : (
        <div className="border border-[#1e3d28] divide-y divide-[#1e3d28]">
          {playerRows.map(({ player, holesCompleted, stablefordRelative, gross, nett }, idx) => {
            const isFinished = holesCompleted === courseHoles.length
            let scoreDisplay: string
            let scoreColor: string

            if (mode === "stableford") {
              const rel = stablefordRelative
              scoreDisplay = rel > 0 ? `+${rel}` : rel === 0 ? "E" : `${rel}`
              scoreColor = rel > 0 ? "text-[#C9A84C]" : rel < 0 ? "text-red-400/80" : "text-white/60"
            } else {
              scoreDisplay = `${strokesView === "gross" ? gross : nett}`
              scoreColor = "text-white/80"
            }

            return (
              <div key={player.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="text-white/30 text-sm w-5 text-right flex-shrink-0">{idx + 1}</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {player.teams && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: player.teams.color }}
                    />
                  )}
                  <span className="text-sm text-white/80 truncate">{player.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-white/25 text-xs">{isFinished ? "F" : `${holesCompleted}`}</span>
                  <span className={`text-base font-bold w-10 text-right tabular-nums ${scoreColor}`}>
                    {scoreDisplay}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Last update */}
      {lastFetch && (
        <div className="text-center text-white/20 text-[10px]">
          Updated {lastFetch.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}
    </div>
  )
}
