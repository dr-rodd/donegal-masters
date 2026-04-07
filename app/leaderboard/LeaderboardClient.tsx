"use client"

import { useState, Fragment } from "react"
import { features } from "@/lib/features"
import ScoreShape from "@/app/components/ScoreShape"

// ─── Types ─────────────────────────────────────────────────────

type Course   = { id: string; name: string }
type Round    = { id: string; round_number: number; status?: string; courses: Course | null }
type Player   = { id: string; name: string; role: string; handicap: number; is_composite?: boolean; gender?: string }
type Team     = { id: string; name: string; color: string; players: Player[] }
type Hole     = { id: string; hole_number: number; par: number; stroke_index: number; course_id: string }
type Score    = { player_id: string; hole_id: string; gross_score: number; stableford_points: number; no_return: boolean; round_id: string }
type RoundHcp = { round_id: string; player_id: string; playing_handicap: number }
type Tee      = { id: string; course_id: string; name: string; gender: string; par: number }

interface Props {
  rounds: Round[]
  teams: Team[]
  holes: Hole[]
  scores: Score[]
  roundHandicaps: RoundHcp[]
  tees: Tee[]
}

// ─── Player helpers ────────────────────────────────────────────

const ROLE_ORDER: Record<string, number> = { dad: 0, mum: 1, son: 2 }
function sortedPlayers(players: Player[]) {
  return [...players].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
}
const displayName = (p: Player) =>
  (p.is_composite ? p.name.replace(/^Composite\s+/i, "") : p.name).split(" ")[0]

// ─── Tee helpers (copied from ScorecardClient) ─────────────────

const TEE_PREF_M = ["blue", "white", "black", "sandstone", "slate", "granite", "claret", "red"]
const TEE_PREF_F = ["red", "sandstone", "claret", "white", "blue", "black"]

function defaultTee(tees: Tee[], courseId: string, gender: string): Tee | null {
  const ct = tees.filter(t => t.course_id === courseId)
  const prefs = gender === "F" ? TEE_PREF_F : TEE_PREF_M
  for (const p of prefs) {
    const t = ct.find(x => x.name.toLowerCase() === p)
    if (t) return t
  }
  return ct[0] ?? null
}

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

// ─── Paper composite scorecard ─────────────────────────────────

function CompositeScorecard({ team, round, holes, scores, roundHandicaps, tees }: {
  team: Team; round: Round; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]; tees: Tee[]
}) {
  const courseId    = round.courses?.id ?? ""
  const courseName  = round.courses?.name ?? ""
  const courseHoles = holes
    .filter(h => h.course_id === courseId)
    .sort((a, b) => a.hole_number - b.hole_number)
  const front   = courseHoles.slice(0, 9)
  const back    = courseHoles.slice(9, 18)
  const crimson = "font-[family-name:var(--font-crimson)]"
  const players = sortedPlayers(team.players)

  function playerScore(player: Player, hole: Hole): Score | null {
    return scores.find(s => s.player_id === player.id && s.hole_id === hole.id && s.round_id === round.id) ?? null
  }

  function playerHcp(player: Player): number | null {
    return roundHandicaps.find(rh => rh.player_id === player.id && rh.round_id === round.id)?.playing_handicap ?? null
  }

  function playerNrGross(player: Player, hole: Hole): number {
    const ph    = playerHcp(player) ?? 0
    const shots = Math.floor(ph / 18) + (hole.stroke_index <= ph % 18 ? 1 : 0)
    return hole.par + 2 + shots
  }

  function bestPts(hole: Hole): number {
    return players.reduce((best, p) => Math.max(best, playerScore(p, hole)?.stableford_points ?? 0), 0)
  }

  function playerSumGross(player: Player, hs: Hole[]): number {
    return hs.reduce((sum, h) => {
      const s = playerScore(player, h)
      if (!s) return sum
      return sum + (s.no_return ? playerNrGross(player, h) : Number(s.gross_score))
    }, 0)
  }

  function totalBestPts(hs: Hole[]): number {
    return hs.reduce((sum, h) => sum + bestPts(h), 0)
  }

  function sumPar(hs: Hole[]): number {
    return hs.reduce((sum, h) => sum + h.par, 0)
  }

  const hasScores = courseHoles.some(h => players.some(p => playerScore(p, h) !== null))

  function SubtotalRow({ label, hs, isTotal }: { label: string; hs: Hole[]; isTotal?: boolean }) {
    const bg        = isTotal ? "bg-[#1a3a22]"    : "bg-gray-100"
    const border    = isTotal ? "border-[#1e3a22]" : "border-gray-200"
    const textLabel = isTotal ? "text-white/70"    : "text-gray-500"
    const textData  = isTotal ? "text-white"       : "text-gray-700"
    const textPts   = isTotal ? "text-[#C9A84C] font-semibold" : "text-[#2d6a4f] font-semibold"
    const sz        = isTotal ? "text-lg"          : "text-base"
    return (
      <tr className={`border-t-2 ${border} ${bg}`}>
        <td className={`py-2 px-3 text-sm uppercase tracking-wider font-semibold ${textLabel} font-[family-name:var(--font-playfair)]`}>{label}</td>
        <td className={`text-center py-2 px-2 ${sz} font-semibold ${textData} ${crimson}`}>{sumPar(hs)}</td>
        {players.map(p => {
          const gross   = playerSumGross(p, hs)
          const hasNR   = hs.some(h => playerScore(p, h)?.no_return)
          const hasAny  = hs.some(h => playerScore(p, h) !== null)
          return (
            <td key={p.id} className={`text-center py-2 px-1 ${sz} font-semibold ${textData} ${crimson}`}>
              {hasAny
                ? <>{gross > 0 ? gross : "—"}{hasNR && <span className="text-orange-500 text-[9px] ml-0.5">NR</span>}</>
                : "—"
              }
            </td>
          )
        })}
        <td className={`text-center py-2 px-2 ${sz} ${isTotal ? "font-bold" : ""} ${textPts} ${crimson}`}>
          {hasScores ? totalBestPts(hs) : "—"}
        </td>
      </tr>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="bg-[#1a3a22] px-4 py-3 flex items-center justify-between">
        <span className="font-[family-name:var(--font-playfair)] text-white text-lg">{courseName}</span>
        <span className={`text-white/40 text-sm ${crimson}`}>Best ball</span>
      </div>

      {/* Player legend */}
      <div className="flex divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
        {players.map((p, i) => (
          <div key={p.id} className="flex-1 px-2 py-2 text-center">
            <span className="text-[#C9A84C] text-xs font-bold font-[family-name:var(--font-playfair)]">{i + 1}</span>
            <span className={`block text-gray-700 text-xs font-medium truncate ${crimson}`}>{displayName(p)}</span>
            {playerHcp(p) != null && (
              <span className={`text-gray-400 text-[10px] ${crimson}`}>hcp {playerHcp(p)}</span>
            )}
          </div>
        ))}
      </div>

      {courseHoles.length === 0 ? (
        <p className="text-gray-300 text-sm text-center py-10">Course data unavailable</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-400 uppercase tracking-wide font-[family-name:var(--font-playfair)] w-10">Hole</th>
              <th className="text-center py-2 px-2 text-sm font-normal text-gray-400 uppercase tracking-wide w-8">Par</th>
              {players.map((_, i) => (
                <th key={i} className="text-center py-2 px-1 text-sm font-bold text-[#C9A84C] uppercase tracking-wide w-9">{i + 1}</th>
              ))}
              <th className="text-center py-2 px-2 text-sm font-semibold text-[#C9A84C] uppercase tracking-wide w-10">Tot</th>
            </tr>
          </thead>
          <tbody>
            {/* Front 9 */}
            {front.map((hole, i) => {
              const best         = bestPts(hole)
              const holeHasScore = players.some(p => playerScore(p, hole) !== null)
              const isOdd        = i % 2 === 0
              if (hole.hole_number === 1) {
                players.forEach((p, pi) => {
                  const s = playerScore(p, hole)
                  console.log(`[CompositeScorecard] Hole 1 Player ${pi + 1} (${p.name}):`, {
                    score: s,
                    gross: s ? Number(s.gross_score) : null,
                    par: Number(hole.par),
                  })
                })
              }
              return (
                <tr key={hole.id} className={`border-t border-gray-100 ${isOdd ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className={`py-2.5 px-3 text-lg font-semibold text-gray-700 ${crimson}`}>{hole.hole_number}</td>
                  <td className={`text-center py-2.5 px-2 text-base text-gray-500 ${crimson}`}>{hole.par}</td>
                  {players.map(p => {
                    const s      = playerScore(p, hole)
                    const isBest = best > 0 && (s?.stableford_points ?? 0) === best
                    return (
                      <td key={p.id} className={`${isBest ? "bg-[#fef3c7]" : ""} text-center py-1.5 px-1`}>
                        {s
                          ? s.no_return
                            ? <span className={`text-orange-500 text-xs font-semibold ${crimson}`}>NR</span>
                            : <ScoreShape gross={Number(s.gross_score)} par={Number(hole.par)} />
                          : <span className="text-gray-200 text-sm">—</span>
                        }
                      </td>
                    )
                  })}
                  <td className={`text-center py-2.5 px-2 text-lg font-semibold ${crimson} ${
                    !holeHasScore ? "text-gray-200"
                    : best >= 3   ? "text-[#2d6a4f]"
                    : best === 0  ? "text-gray-300"
                    :               "text-gray-500"
                  }`}>
                    {holeHasScore ? best : "—"}
                  </td>
                </tr>
              )
            })}

            <SubtotalRow label="Out" hs={front} />

            {/* Back 9 */}
            {back.map((hole, i) => {
              const best         = bestPts(hole)
              const holeHasScore = players.some(p => playerScore(p, hole) !== null)
              const isOdd        = i % 2 === 0
              return (
                <tr key={hole.id} className={`border-t border-gray-100 ${isOdd ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className={`py-2.5 px-3 text-lg font-semibold text-gray-700 ${crimson}`}>{hole.hole_number}</td>
                  <td className={`text-center py-2.5 px-2 text-base text-gray-500 ${crimson}`}>{hole.par}</td>
                  {players.map(p => {
                    const s      = playerScore(p, hole)
                    const isBest = best > 0 && (s?.stableford_points ?? 0) === best
                    return (
                      <td key={p.id} className={`${isBest ? "bg-[#fef3c7]" : ""} text-center py-1.5 px-1`}>
                        {s
                          ? s.no_return
                            ? <span className={`text-orange-500 text-xs font-semibold ${crimson}`}>NR</span>
                            : <ScoreShape gross={Number(s.gross_score)} par={Number(hole.par)} />
                          : <span className="text-gray-200 text-sm">—</span>
                        }
                      </td>
                    )
                  })}
                  <td className={`text-center py-2.5 px-2 text-lg font-semibold ${crimson} ${
                    !holeHasScore ? "text-gray-200"
                    : best >= 3   ? "text-[#2d6a4f]"
                    : best === 0  ? "text-gray-300"
                    :               "text-gray-500"
                  }`}>
                    {holeHasScore ? best : "—"}
                  </td>
                </tr>
              )
            })}

            <SubtotalRow label="In" hs={back} />
            <SubtotalRow label="Total" hs={courseHoles} isTotal />
          </tbody>
        </table>
      )}

      {!hasScores && courseHoles.length > 0 && (
        <p className={`text-center text-gray-300 text-sm py-4 border-t border-gray-100 ${crimson}`}>
          No scores recorded yet
        </p>
      )}
    </div>
  )
}

// ─── Scorecard modal ───────────────────────────────────────────

function ScorecardModal({ team, round, holes, scores, roundHandicaps, tees, onClose }: {
  team: Team; round: Round; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]; tees: Tee[]; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-[#0a1a0e] rounded-t-xl overflow-hidden flex flex-col max-h-[90vh]"
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
            tees={tees}
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
          tees={tees}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
