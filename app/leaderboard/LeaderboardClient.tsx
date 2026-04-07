"use client"

import { useState, Fragment } from "react"
import { features } from "@/lib/features"
import { InlineScorecard } from "@/app/scoring/LiveLeaderboardPanel"

// ─── Types ─────────────────────────────────────────────────────

type Course   = { id: string; name: string }
type Round    = { id: string; round_number: number; status?: string; courses: Course | null }
type Player   = { id: string; name: string; role: string; handicap: number; is_composite?: boolean; gender?: string }
type Team     = { id: string; name: string; color: string; players: Player[] }
type Hole     = { id: string; hole_number: number; par: number; stroke_index: number; course_id: string }
type Score    = { player_id: string; hole_id: string; gross_score: number; stableford_points: number; no_return: boolean; round_id: string }
type RoundHcp = { round_id: string; player_id: string; playing_handicap: number }
interface Props {
  rounds: Round[]
  teams: Team[]
  holes: Hole[]
  scores: Score[]
  roundHandicaps: RoundHcp[]
  tees: unknown[]
}

// ─── Player helpers ────────────────────────────────────────────

const ROLE_ORDER: Record<string, number> = { dad: 0, mum: 1, son: 2 }
function sortedPlayers(players: Player[]) {
  return [...players].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
}
const displayName = (p: Player) =>
  (p.is_composite ? p.name.replace(/^Composite\s+/i, "") : p.name).split(" ")[0]

// ─── Team scoring ──────────────────────────────────────────────

function teamRoundPts(team: Team, holes: Hole[], scores: Score[], roundId: string): number {
  return holes.reduce((total, hole) => {
    const best = team.players
      .map(p => scores.find(s => s.player_id === p.id && s.hole_id === hole.id && s.round_id === roundId))
      .filter(Boolean)
      .reduce((max, s) => Math.max(max, s!.stableford_points), 0)
    return total + best
  }, 0)
}

// ─── Composite scorecard (reuses InlineScorecard) ──────────────

function CompositeScorecard({ team, round, holes, scores, roundHandicaps }: {
  team: Team; round: Round; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]
}) {
  const courseId   = round.courses?.id ?? ""
  const courseHoles = holes
    .filter(h => h.course_id === courseId)
    .sort((a, b) => a.hole_number - b.hole_number)

  // Pick the highest stableford scorer on this team for this round
  const players = sortedPlayers(team.players)
  const bestPlayer = players.reduce((best, p) => {
    const pts = scores.filter(s => s.player_id === p.id && s.round_id === round.id)
      .reduce((sum, s) => sum + s.stableford_points, 0)
    const bestPts = scores.filter(s => s.player_id === best.id && s.round_id === round.id)
      .reduce((sum, s) => sum + s.stableford_points, 0)
    return pts > bestPts ? p : best
  }, players[0])

  if (!bestPlayer) return null

  const playingHcp = roundHandicaps.find(
    rh => rh.player_id === bestPlayer.id && rh.round_id === round.id
  )?.playing_handicap ?? 0

  // Adapt Score[] → InlineScorecard's LiveScoreRow[] (hole_id → hole_number)
  const playerScores = scores
    .filter(s => s.player_id === bestPlayer.id && s.round_id === round.id)
    .flatMap(s => {
      const hole = holes.find(h => h.id === s.hole_id)
      if (!hole) return []
      return [{
        player_id: s.player_id,
        hole_number: hole.hole_number,
        gross_score: s.no_return ? null : s.gross_score,
        stableford_points: s.stableford_points,
      }]
    })

  const player = {
    id: bestPlayer.id,
    name: bestPlayer.name,
    gender: bestPlayer.gender ?? "M",
    teams: { name: team.name, color: team.color },
  }

  return (
    <>
      {/* Numbered player tiles */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 mb-3">
        {players.map((p, i) => {
          const hcp = roundHandicaps.find(rh => rh.player_id === p.id && rh.round_id === round.id)?.playing_handicap
          const isSel = p.id === bestPlayer.id
          return (
            <div
              key={p.id}
              className={`flex-shrink-0 flex flex-col items-start px-3.5 py-2.5 rounded-sm border min-w-[100px]
                ${isSel ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-[#1e3d28] bg-[#0f2418]"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-[family-name:var(--font-playfair)] text-[#C9A84C] text-sm font-bold leading-none">{i + 1}</span>
                <span className={`text-base font-medium leading-tight ${isSel ? "text-white" : "text-white/55"}`}>
                  {p.name.split(" ")[0]}
                </span>
              </div>
              <span className={`text-sm ${isSel ? "text-[#C9A84C]" : "text-white/25"}`}>
                {hcp != null ? `HC ${hcp}` : "—"}
              </span>
            </div>
          )
        })}
      </div>

      <InlineScorecard
        player={player}
        playingHcp={playingHcp}
        courseHoles={courseHoles}
        playerScores={playerScores}
        courseId={courseId}
      />
    </>
  )
}

// ─── Scorecard modal ───────────────────────────────────────────

function ScorecardModal({ team, round, holes, scores, roundHandicaps, onClose }: {
  team: Team; round: Round; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-[#0a1a0e] rounded-t-xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <span className="text-white/25 text-xs tracking-[0.15em] uppercase">Round {round.round_number}</span>
          <button
            onClick={onClose}
            className="text-white/35 hover:text-white transition-colors p-1 -mr-1 text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-8">
          <CompositeScorecard
            team={team}
            round={round}
            holes={holes}
            scores={scores}
            roundHandicaps={roundHandicaps}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Course tiles ──────────────────────────────────────────────

function CourseTiles({ team, rounds, holes, scores, roundHandicaps, onTileClick }: {
  team: Team; rounds: Round[]; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]
  onTileClick: (round: Round) => void
}) {
  const roundsByNumber: Record<number, Round> = {}
  rounds.forEach(r => { roundsByNumber[r.round_number] = r })

  return (
    <div className="px-3 pb-4 pt-2 space-y-2 bg-[#070f09]">
      {[1, 2, 3].map(num => {
        const round = roundsByNumber[num]
        if (!round) {
          return (
            <div key={num} className="w-full rounded-sm border border-[#1e3d28] bg-[#0f2418] px-5 py-4 opacity-40">
              <p className="font-[family-name:var(--font-playfair)] text-white/30 text-base">Round {num}</p>
              <p className="text-white/20 text-sm mt-0.5">Not scheduled</p>
            </div>
          )
        }
        const courseHoles = holes.filter(h => h.course_id === round.courses?.id)
        const pts = teamRoundPts(team, courseHoles, scores, round.id)
        const hasScores = pts > 0
        return (
          <button
            key={round.id}
            onClick={() => onTileClick(round)}
            className={`w-full text-left rounded-sm border transition-all duration-200 overflow-hidden active:opacity-75
              ${hasScores
                ? "border-[#C9A84C]/50 shadow-[0_0_16px_rgba(201,168,76,0.10)] bg-[#0f2418]"
                : "border-[#1e3d28] bg-[#0f2418]"
              }`}
          >
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-playfair)] text-white text-base leading-tight">
                  {round.courses?.name ?? `Round ${num}`}
                </p>
                <p className={`text-sm mt-1 ${hasScores ? "text-[#C9A84C]" : "text-white/25"}`}>
                  {hasScores ? "Scores submitted" : "No scores yet"}
                </p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-3">
                {hasScores && (
                  <span className="font-[family-name:var(--font-playfair)] text-[#C9A84C] text-xl font-bold">{pts}</span>
                )}
                <span className="text-white/30 text-sm">View →</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

export default function LeaderboardClient({ rounds, teams, holes, scores, roundHandicaps, tees }: Props) {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ team: Team; round: Round } | null>(null)

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number)
  const roundsByNumber: Record<number, Round> = {}
  sortedRounds.forEach(r => { roundsByNumber[r.round_number] = r })

  const rows = teams.map(team => {
    let total = 0
    let roundsWithScores = 0
    for (const r of sortedRounds) {
      const courseHoles = holes.filter(h => h.course_id === r.courses?.id)
      const pts = teamRoundPts(team, courseHoles, scores, r.id)
      if (pts > 0) { total += pts; roundsWithScores++ }
    }
    return { team, total, roundsWithScores }
  }).sort((a, b) => b.total - a.total)

  const totalRounds = sortedRounds.length

  function toggleTeam(teamId: string) {
    setExpandedTeamId(prev => prev === teamId ? null : teamId)
  }

  return (
    <>
      <div className="border border-[#1e3d28]">
        {/* Sticky column headers */}
        <div className="sticky top-[69px] z-10 flex items-center gap-3 px-4 py-2 bg-[#0a1a0e] border-b border-[#1e3d28]">
          <span className="text-[10px] tracking-[0.15em] uppercase text-white/30 w-6 flex-shrink-0">Pos</span>
          <span className="text-[10px] tracking-[0.15em] uppercase text-white/30 flex-1 min-w-0">Team</span>
          <span className="text-[10px] tracking-[0.15em] uppercase text-white/30 flex-shrink-0 min-w-[3.5rem] text-center">Score</span>
          <span className="text-[10px] tracking-[0.15em] uppercase text-white/30 flex-shrink-0 w-9 text-right">Thru</span>
        </div>

        {/* Team rows */}
        {rows.map(({ team, total, roundsWithScores }, i) => {
          const isExpanded = expandedTeamId === team.id
          const isLast     = i === rows.length - 1
          const allDone    = totalRounds > 0 && roundsWithScores === totalRounds
          const members    = sortedPlayers(team.players)

          // Score pill
          const baseline = 36 * roundsWithScores
          const rel = total - baseline
          let scoreDisplay: string
          let scorePillClass: string
          if (roundsWithScores === 0) {
            scoreDisplay   = "—"
            scorePillClass = "bg-white/5 text-white/25"
          } else if (allDone) {
            scoreDisplay   = `${total}`
            scorePillClass = rel > 0
              ? "bg-[#C9A84C]/15 text-[#C9A84C]"
              : rel < 0 ? "bg-green-900/25 text-green-400"
              : "bg-white/5 text-white/45"
          } else {
            scoreDisplay   = rel > 0 ? `+${rel}` : rel < 0 ? `${rel}` : "E"
            scorePillClass = rel > 0
              ? "bg-[#C9A84C]/15 text-[#C9A84C]"
              : rel < 0 ? "bg-green-900/25 text-green-400"
              : "bg-white/5 text-white/45"
          }

          const thruDisplay = allDone ? "F" : roundsWithScores > 0 ? `${roundsWithScores}` : "—"
          const thruClass   = allDone ? "text-white/60 font-semibold" : roundsWithScores > 0 ? "text-white/30" : "text-white/15"

          return (
            <Fragment key={team.id}>
              <button
                onClick={() => toggleTeam(team.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-colors
                  ${!isLast || isExpanded ? "border-b border-[#1e3d28]" : ""}`}
              >
                {/* Pos */}
                <span className="text-white/40 text-base font-semibold w-6 flex-shrink-0 tabular-nums self-start pt-0.5">
                  {i + 1}
                </span>

                {/* Team name + member names */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                    <span className="font-[family-name:var(--font-playfair)] text-base text-white truncate">
                      {team.name}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5 pl-4 flex-wrap">
                    {members.map(p => (
                      <span key={p.id} className="text-white/35 text-xs truncate">{displayName(p)}</span>
                    ))}
                  </div>
                </div>

                {/* Score pill */}
                <span className={`flex-shrink-0 inline-flex items-center justify-center self-start mt-0.5
                  px-2 py-0.5 rounded-sm text-lg font-bold tabular-nums min-w-[3.5rem] ${scorePillClass}`}>
                  {scoreDisplay}
                </span>

                {/* Thru */}
                <span className={`flex-shrink-0 w-9 text-right tabular-nums text-base self-start pt-0.5 ${thruClass}`}>
                  {thruDisplay}
                </span>
              </button>

              {isExpanded && (
                <div className={!isLast ? "border-b border-[#1e3d28]" : ""}>
                  <CourseTiles
                    team={team}
                    rounds={sortedRounds}
                    holes={holes}
                    scores={scores}
                    roundHandicaps={roundHandicaps}
                    onTileClick={round => setModal({ team, round })}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>

      {/* Scorecard modal */}
      {modal && (
        <ScorecardModal
          team={modal.team}
          round={modal.round}
          holes={holes}
          scores={scores}
          roundHandicaps={roundHandicaps}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
