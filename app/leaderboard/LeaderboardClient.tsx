"use client"

import { useState, Fragment } from "react"
import { features } from "@/lib/features"

// ─── Types ─────────────────────────────────────────────────────

type Course   = { id: string; name: string }
type Round    = { id: string; round_number: number; status?: string; courses: Course | null }
type Player   = { id: string; name: string; role: string; handicap: number; is_composite?: boolean }
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

// ─── Score shape — matches ScorecardClient exactly ─────────────

function ScoreShape({ gross, par }: { gross: number; par: number }) {
  const diff = gross - par
  const f = "font-[family-name:var(--font-crimson)] leading-none"
  if (diff <= -2) return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#C9A84C]">
      <span className={`${f} text-lg font-semibold text-[#1a0a00]`}>{gross}</span>
    </span>
  )
  if (diff === -1) return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-[#2d6a4f]">
      <span className={`${f} text-lg text-[#1a5235]`}>{gross}</span>
    </span>
  )
  if (diff === 0) return <span className={`${f} text-lg text-gray-700`}>{gross}</span>
  if (diff === 1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 border border-gray-400">
      <span className={`${f} text-base text-gray-500`}>{gross}</span>
    </span>
  )
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-300">
      <span className={`${f} text-base text-gray-600`}>{gross}</span>
    </span>
  )
}

// ─── Paper composite scorecard ─────────────────────────────────

function CompositeScorecard({ team, round, holes, scores, roundHandicaps }: {
  team: Team; round: Round; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]
}) {
  const courseHoles = holes
    .filter(h => h.course_id === round.courses?.id)
    .sort((a, b) => a.hole_number - b.hole_number)
  const front   = courseHoles.slice(0, 9)
  const back    = courseHoles.slice(9, 18)
  const players = sortedPlayers(team.players)
  const f       = "font-[family-name:var(--font-crimson)]"
  const hasAny  = scores.some(s => s.round_id === round.id && players.some(p => p.id === s.player_id))

  function playerScore(playerId: string, holeId: string) {
    return scores.find(s => s.player_id === playerId && s.hole_id === holeId && s.round_id === round.id) ?? null
  }

  function holeInfo(hole: Hole) {
    const pScores = players.map(p => ({ player: p, score: playerScore(p.id, hole.id) }))
    const maxPts  = Math.max(0, ...pScores.filter(x => x.score).map(x => x.score!.stableford_points))
    const contributors = new Set(
      maxPts > 0
        ? pScores.filter(x => x.score?.stableford_points === maxPts).map(x => x.player.id)
        : []
    )
    return { pScores, maxPts, contributors }
  }

  function subtotals(holeSet: Hole[]) {
    const par = holeSet.reduce((s, h) => s + h.par, 0)
    const playerGross = players.map(p =>
      holeSet.reduce((s, h) => {
        const sc = playerScore(p.id, h.id)
        return s + (sc && !sc.no_return ? sc.gross_score : 0)
      }, 0)
    )
    const bestPts = holeSet.reduce((s, h) => s + holeInfo(h).maxPts, 0)
    return { par, playerGross, bestPts }
  }

  const outSub = subtotals(front)
  const inSub  = subtotals(back)
  const totSub = {
    par:         outSub.par + inSub.par,
    playerGross: players.map((_, i) => outSub.playerGross[i] + inSub.playerGross[i]),
    bestPts:     outSub.bestPts + inSub.bestPts,
  }

  function HoleRow({ hole, odd }: { hole: Hole; odd: boolean }) {
    const { pScores, maxPts, contributors } = holeInfo(hole)
    const anyScore = pScores.some(x => x.score)
    return (
      <tr className={`border-t border-gray-100 ${odd ? "bg-white" : "bg-gray-50/40"}`}>
        <td className={`py-2.5 px-2 text-lg font-semibold text-gray-700 ${f}`}>{hole.hole_number}</td>
        <td className={`text-center py-2.5 px-1 text-base text-gray-500 ${f}`}>{hole.par}</td>
        {pScores.map(({ player, score }) => {
          const highlighted = contributors.has(player.id)
          return (
            <td key={player.id} className={`text-center py-1.5 px-1 ${highlighted ? "bg-[#fef3c7]" : ""}`}>
              {score
                ? score.no_return
                  ? <span className={`text-orange-500 text-sm font-semibold ${f}`}>NR</span>
                  : <ScoreShape gross={score.gross_score} par={hole.par} />
                : <span className="text-gray-200 text-sm">—</span>
              }
            </td>
          )
        })}
        <td className={`text-center py-2.5 px-2 text-lg font-semibold ${f} ${
          !anyScore     ? "text-gray-200"
          : maxPts >= 3 ? "text-[#2d6a4f]"
          : maxPts === 0 ? "text-gray-300"
          : "text-gray-500"
        }`}>
          {anyScore ? maxPts : "—"}
        </td>
      </tr>
    )
  }

  function SubRow({ label, sub, isTotal }: { label: string; sub: typeof outSub; isTotal?: boolean }) {
    const bg     = isTotal ? "bg-[#1a3a22]" : "bg-gray-100"
    const tLabel = isTotal ? "text-white/70" : "text-gray-500"
    const tData  = isTotal ? "text-white"    : "text-gray-700"
    const tPts   = isTotal ? "text-[#C9A84C] font-bold" : "text-[#2d6a4f] font-semibold"
    const border = isTotal ? "border-[#1e3a22]" : "border-gray-200"
    const sz     = isTotal ? "text-lg" : "text-base"
    return (
      <tr className={`border-t-2 ${border} ${bg}`}>
        <td className={`py-2 px-2 text-sm uppercase tracking-wider font-semibold ${tLabel} font-[family-name:var(--font-playfair)]`}>{label}</td>
        <td className={`text-center py-2 px-1 ${sz} font-semibold ${tData} ${f}`}>{sub.par}</td>
        {sub.playerGross.map((g, i) => (
          <td key={i} className={`text-center py-2 px-1 ${sz} ${tData} ${f}`}>
            {hasAny && g > 0 ? g : "—"}
          </td>
        ))}
        <td className={`text-center py-2 px-2 ${sz} ${tPts} ${f}`}>
          {hasAny ? sub.bestPts : "—"}
        </td>
      </tr>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
      {/* Dark green header — team + course */}
      <div className="bg-[#1a3a22] px-4 py-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
          <span className="font-[family-name:var(--font-playfair)] text-white text-lg">{team.name}</span>
        </div>
        <p className="text-white/40 text-sm pl-4">{round.courses?.name}</p>
      </div>

      {/* Player tiles — numbered to match column headers */}
      <div className="bg-[#f5f0e8] border-b-2 border-gray-200 px-4 py-3">
        <div className="grid gap-x-4 gap-y-2" style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
          {players.map((p, i) => {
            const hcp = roundHandicaps.find(rh => rh.player_id === p.id && rh.round_id === round.id)
            return (
              <div key={p.id} className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`font-[family-name:var(--font-crimson)] text-base font-bold text-[#2d6a4f] flex-shrink-0`}>{i + 1}</span>
                  <span className="font-[family-name:var(--font-playfair)] text-gray-700 text-sm font-semibold truncate">{displayName(p)}</span>
                  {p.is_composite && (
                    <span className="text-[8px] font-bold text-[#C9A84C] border border-[#C9A84C]/60 px-0.5 rounded-sm leading-tight flex-shrink-0">C</span>
                  )}
                </div>
                <span className={`font-[family-name:var(--font-crimson)] text-xs text-gray-400`}>
                  {hcp ? `hcp ${hcp.playing_handicap}` : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {courseHoles.length === 0 ? (
        <p className="text-gray-300 text-sm text-center py-10">Course data unavailable</p>
      ) : (
        <table className="border-collapse w-full table-fixed">
          <colgroup>
            <col style={{ width: "34px" }} />
            <col style={{ width: "30px" }} />
            {players.map(p => <col key={p.id} />)}
            <col style={{ width: "40px" }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-2 text-sm font-semibold text-gray-400 uppercase tracking-wide font-[family-name:var(--font-playfair)]">
                Hole
              </th>
              <th className="text-center py-2 px-1 text-sm font-normal text-gray-400 uppercase tracking-wide">Par</th>
              {players.map((_, i) => (
                <th key={i} className={`text-center py-2 px-1 font-[family-name:var(--font-crimson)] text-lg font-bold text-[#2d6a4f]`}>
                  {i + 1}
                </th>
              ))}
              <th className="text-center py-2 px-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">Tot</th>
            </tr>
          </thead>
          <tbody>
            {front.map((hole, i) => <HoleRow key={hole.id} hole={hole} odd={i % 2 === 0} />)}
            <SubRow label="Out" sub={outSub} />
            {back.map((hole, i) => <HoleRow key={hole.id} hole={hole} odd={i % 2 === 0} />)}
            <SubRow label="In" sub={inSub} />
            <SubRow label="Total" sub={totSub} isTotal />
          </tbody>
        </table>
      )}

      {!hasAny && courseHoles.length > 0 && (
        <p className={`text-center text-gray-300 text-sm py-4 border-t border-gray-100 ${f}`}>
          No scores recorded yet
        </p>
      )}
    </div>
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

export default function LeaderboardClient({ rounds, teams, holes, scores, roundHandicaps }: Props) {
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
