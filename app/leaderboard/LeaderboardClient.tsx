"use client"

import { useState, Fragment } from "react"
import Link from "next/link"

// ─── Types ─────────────────────────────────────────────────────

type Course   = { id: string; name: string }
type Round    = { id: string; round_number: number; courses: Course | null }
type Player   = { id: string; name: string; role: string; handicap: number }
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

// ─── Constants ─────────────────────────────────────────────────

const ROLE_BG: Record<string, string> = {
  dad: "bg-blue-900/70",
  mum: "bg-rose-900/70",
  son: "bg-emerald-900/60",
}

const ROLE_DOT: Record<string, string> = {
  dad: "bg-blue-400",
  mum: "bg-rose-400",
  son: "bg-emerald-400",
}

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣"]

const ROLE_ORDER: Record<string, number> = { dad: 0, mum: 1, son: 2 }
function sortedPlayers(players: Player[]) {
  return [...players].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
}

// ─── Best-ball helpers ─────────────────────────────────────────

interface BestHole {
  hole: Hole
  pts: number
  gross: number
  nr: boolean
  role: string | null
  hasScore: boolean
}

function getBestBall(team: Team, holes: Hole[], scores: Score[], roundId: string): BestHole[] {
  return holes.map(hole => {
    const candidates = team.players.flatMap(p => {
      const s = scores.find(sc =>
        sc.player_id === p.id && sc.hole_id === hole.id && sc.round_id === roundId
      )
      return s ? [{ s, p }] : []
    })
    if (!candidates.length) return { hole, pts: 0, gross: 0, nr: false, role: null, hasScore: false }
    const best = candidates.reduce((a, b) =>
      b.s.stableford_points > a.s.stableford_points ? b : a
    )
    return {
      hole,
      pts: best.s.stableford_points,
      gross: best.s.gross_score,
      nr: best.s.no_return,
      role: best.p.role,
      hasScore: true,
    }
  })
}

function teamRoundPts(team: Team, holes: Hole[], scores: Score[], roundId: string): number {
  return getBestBall(team, holes, scores, roundId).reduce((s, h) => s + h.pts, 0)
}

// ─── Score cell ────────────────────────────────────────────────

function ScoreCell({ gross, pts, nr, role }: { gross: number; pts: number; nr: boolean; role?: string | null }) {
  const bg = role ? (ROLE_BG[role] ?? "") : ""
  return (
    <td className={`text-center px-1 py-1.5 min-w-[30px] ${bg}`}>
      {nr
        ? <span className="text-orange-400/70 text-xs">NR</span>
        : <span className="text-white text-xs whitespace-nowrap">{gross}<sup className="text-white/40 text-[9px]">{pts}</sup></span>
      }
    </td>
  )
}

function EmptyCell() {
  return <td className="text-center px-1 py-1.5 min-w-[30px] text-white/20 text-xs">—</td>
}

// ─── Team scorecard (best-ball + individual rows) ──────────────

function TeamScorecard({ team, holes, scores, roundHandicaps, roundId }: {
  team: Team; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]; roundId: string
}) {
  const bb      = getBestBall(team, holes, scores, roundId)
  const front   = bb.slice(0, 9)
  const back    = bb.slice(9, 18)
  const hasAnyScore = bb.some(h => h.hasScore)
  const outPts  = front.reduce((s, h) => s + h.pts, 0)
  const inPts   = back.reduce((s, h) => s + h.pts, 0)
  const outPar  = front.reduce((s, h) => s + h.hole.par, 0)
  const inPar   = back.reduce((s, h) => s + h.hole.par, 0)

  const frontHoles = holes.slice(0, 9)
  const backHoles  = holes.slice(9, 18)

  return (
    <div className="bg-[#0f2418] border border-[#1e3d28] rounded-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#1e3d28]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
          <span className="font-[family-name:var(--font-playfair)] text-white">{team.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasAnyScore && (
            <span className="text-[#C9A84C] font-semibold">{outPts + inPts} pts</span>
          )}
        </div>
      </div>

      {!hasAnyScore ? (
        <p className="px-4 py-5 text-white/20 text-sm text-center tracking-widest">No scores yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-[13px] border-collapse w-full">
            <thead>
              <tr className="border-b border-[#1e3d28]">
                <th className="text-left px-3 py-1.5 text-white/25 font-normal min-w-[64px]">Hole</th>
                {frontHoles.map(h => <th key={h.id} className="text-center px-1 py-1.5 text-white/25 font-normal min-w-[30px]">{h.hole_number}</th>)}
                <th className="text-center px-2 py-1.5 text-white/25 font-normal">Out</th>
                {backHoles.map(h => <th key={h.id} className="text-center px-1 py-1.5 text-white/25 font-normal min-w-[30px]">{h.hole_number}</th>)}
                <th className="text-center px-2 py-1.5 text-white/25 font-normal">In</th>
                <th className="text-center px-2 py-1.5 text-white/25 font-normal">Grs</th>
                <th className="text-center px-2 py-1.5 text-white/25 font-normal">Pts</th>
              </tr>
              <tr className="border-b border-[#1e3d28]">
                <th className="text-left px-3 py-1 text-white/20 font-normal">Par</th>
                {frontHoles.map(h => <th key={h.id} className="text-center px-1 py-1 text-white/20 font-normal">{h.par}</th>)}
                <th className="text-center px-2 py-1 text-white/20 font-normal">{outPar}</th>
                {backHoles.map(h => <th key={h.id} className="text-center px-1 py-1 text-white/20 font-normal">{h.par}</th>)}
                <th className="text-center px-2 py-1 text-white/20 font-normal">{inPar}</th>
                <th /><th />
              </tr>
            </thead>
            <tbody>
              {/* Best-ball row */}
              <tr className="border-t border-[#1e3d28]">
                <td className="px-3 py-1.5 text-white/40 text-xs uppercase tracking-wider">Best</td>
                {front.map(h => h.hasScore
                  ? <ScoreCell key={h.hole.id} gross={h.gross} pts={h.pts} nr={h.nr} role={h.role} />
                  : <EmptyCell key={h.hole.id} />
                )}
                <td className="text-center px-2 py-1.5 text-white/60 font-semibold">{outPts}</td>
                {back.map(h => h.hasScore
                  ? <ScoreCell key={h.hole.id} gross={h.gross} pts={h.pts} nr={h.nr} role={h.role} />
                  : <EmptyCell key={h.hole.id} />
                )}
                <td className="text-center px-2 py-1.5 text-white/60 font-semibold">{inPts}</td>
                <td />
                <td className="text-center px-2 py-1.5 text-[#C9A84C] font-bold">{outPts + inPts}</td>
              </tr>

              {/* Divider */}
              <tr><td colSpan={23} className="border-t border-[#1e3d28]/60" /></tr>

              {/* Individual player rows */}
              {sortedPlayers(team.players).map(player => {
                const hcp = roundHandicaps.find(rh => rh.player_id === player.id && rh.round_id === roundId)
                const pScores = holes.map(h =>
                  scores.find(s => s.player_id === player.id && s.hole_id === h.id && s.round_id === roundId)
                )
                const hasScores  = pScores.some(Boolean)
                const frontS     = pScores.slice(0, 9)
                const backS      = pScores.slice(9, 18)
                const outGross   = frontS.reduce((s, sc) => s + (sc?.gross_score ?? 0), 0)
                const inGross    = backS.reduce((s, sc) => s + (sc?.gross_score ?? 0), 0)
                const totalGross = outGross + inGross
                const totalPts   = pScores.reduce((s, sc) => s + (sc?.stableford_points ?? 0), 0)
                const hasNR      = pScores.some(sc => sc?.no_return)

                return (
                  <tr key={player.id} className="border-t border-[#1e3d28]/30">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ROLE_DOT[player.role] ?? "bg-white/30"}`} />
                        <Link href={`/scorecard/${player.id}?from=leaderboard`} className="text-xs text-[#C9A84C] hover:text-white transition-colors">
                          {player.name.split(" ")[0]}
                        </Link>
                        {hcp && <span className="text-white/20 text-[10px]">ph{hcp.playing_handicap}</span>}
                      </div>
                    </td>
                    {!hasScores ? (
                      <>
                        {holes.map(h => <EmptyCell key={h.id} />)}
                        <td /><td /><td />
                      </>
                    ) : (
                      <>
                        {frontS.map((sc, i) => sc
                          ? <ScoreCell key={frontHoles[i].id} gross={sc.gross_score} pts={sc.stableford_points} nr={sc.no_return} />
                          : <EmptyCell key={frontHoles[i].id} />
                        )}
                        <td className="text-center px-2 py-1.5 text-white/35">{outGross}</td>
                        {backS.map((sc, i) => sc
                          ? <ScoreCell key={backHoles[i].id} gross={sc.gross_score} pts={sc.stableford_points} nr={sc.no_return} />
                          : <EmptyCell key={backHoles[i].id} />
                        )}
                        <td className="text-center px-2 py-1.5 text-white/35">{inGross}</td>
                        <td className="text-center px-2 py-1.5 text-white/50">
                          {totalGross}
                          {hasNR && <span className="text-orange-400/60 text-[10px] ml-0.5">NR</span>}
                        </td>
                        <td className="text-center px-2 py-1.5 text-[#C9A84C] font-semibold">{totalPts}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Day tab ───────────────────────────────────────────────────

function DayTab({ round, teams, holes, scores, roundHandicaps }: {
  round: Round; teams: Team[]; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]
}) {
  const courseHoles = holes.filter(h => h.course_id === round.courses?.id)

  const sorted = [...teams].sort((a, b) =>
    teamRoundPts(b, courseHoles, scores, round.id) - teamRoundPts(a, courseHoles, scores, round.id)
  )

  return (
    <div>
      {sorted.map(team => (
        <TeamScorecard
          key={team.id}
          team={team}
          holes={courseHoles}
          scores={scores}
          roundHandicaps={roundHandicaps}
          roundId={round.id}
        />
      ))}
    </div>
  )
}

// ─── Overall tab ───────────────────────────────────────────────

function OverallTab({ rounds, teams, holes, scores }: {
  rounds: Round[]; teams: Team[]; holes: Hole[]; scores: Score[]
}) {
  const rows = teams.map(team => {
    const byRound = rounds.map(r => {
      const courseHoles = holes.filter(h => h.course_id === r.courses?.id)
      return teamRoundPts(team, courseHoles, scores, r.id)
    })
    return { team, byRound, total: byRound.reduce((s, p) => s + p, 0) }
  }).sort((a, b) => b.total - a.total)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#1e3d28]">
            <th className="text-left px-4 py-3 text-white/30 font-normal">Team</th>
            {rounds.map(r => (
              <th key={r.id} className="text-center px-3 py-3 text-white/30 font-normal text-sm">
                Day {r.round_number}
                <div className="text-white/15 text-xs font-normal">{r.courses?.name}</div>
              </th>
            ))}
            <th className="text-center px-4 py-3 text-white/30 font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ team, byRound, total }, i) => (
            <Fragment key={team.id}>
              {/* Full-width team name title row */}
              <tr className={i > 0 ? "border-t-2 border-[#1e3d28]" : ""}>
                <td colSpan={rounds.length + 2} className="px-4 pt-3 pb-1">
                  <div className="flex items-center gap-2">
                    <span>{MEDALS[i]}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                    <span className="font-[family-name:var(--font-playfair)] text-white font-semibold">{team.name}</span>
                  </div>
                </td>
              </tr>
              {/* Members + scores row */}
              <tr>
                <td className="px-4 pb-3 align-middle">
                  <div className="flex flex-col">
                    {sortedPlayers(team.players).map(p => (
                      <Link key={p.id} href={`/scorecard/${p.id}?from=leaderboard`}
                        className="text-xs text-[#C9A84C]/70 hover:text-[#C9A84C] transition-colors leading-relaxed">
                        {p.name.split(" ")[0]}
                      </Link>
                    ))}
                  </div>
                </td>
                {byRound.map((pts, j) => (
                  <td key={j} className="text-center px-3 pb-3 text-white/50 align-middle">
                    {pts > 0 ? pts : <span className="text-white/20">—</span>}
                  </td>
                ))}
                <td className="text-center px-4 pb-3 font-[family-name:var(--font-playfair)] text-[#C9A84C] text-xl font-bold align-middle">
                  {total > 0 ? total : <span className="text-white/20 text-sm font-normal">—</span>}
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

export default function LeaderboardClient({ rounds, teams, holes, scores, roundHandicaps }: Props) {
  const tabs = rounds.map(r => ({ key: r.id, label: `Day ${r.round_number}`, sub: r.courses?.name ?? "" }))
  const [active, setActive] = useState(tabs[0]?.key ?? "")

  return (
    <div>
      {/* Overall standings — always visible */}
      <OverallTab rounds={rounds} teams={teams} holes={holes} scores={scores} />

      {/* Day tabs */}
      <div className="mt-10">
        <div className="flex justify-between gap-2 mb-6">
          {tabs.map((tab) => {
            const isActive = active === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className={`flex flex-col items-center justify-center text-center flex-1 px-4 py-4 rounded-sm transition-colors border
                  ${isActive
                    ? "bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]"
                    : "bg-white/[0.03] border-[#1e3d28] text-white/40 hover:bg-white/[0.06] hover:text-white/60"}`}
              >
                <span className="font-[family-name:var(--font-playfair)] text-base sm:text-lg font-semibold leading-tight">{tab.sub}</span>
                <span className={`text-[10px] mt-1 tracking-[0.15em] uppercase ${isActive ? "text-[#C9A84C]/50" : "text-white/25"}`}>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {(() => {
          const round = rounds.find(r => r.id === active)
          if (!round) return null
          return (
            <DayTab
              round={round}
              teams={teams}
              holes={holes}
              scores={scores}
              roundHandicaps={roundHandicaps}
            />
          )
        })()}
      </div>
    </div>
  )
}
