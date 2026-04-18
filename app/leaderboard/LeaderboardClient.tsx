"use client"

import { useState, useRef, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// ─── Types ─────────────────────────────────────────────────────

type Course   = { id: string; name: string }
type Round    = { id: string; round_number: number; status?: string; courses: Course | null }
type Player   = { id: string; name: string; role: string; handicap: number; is_composite?: boolean; gender?: string }
type Team     = { id: string; name: string; color: string; players: Player[] }
type Hole     = { id: string; hole_number: number; par: number; stroke_index: number; course_id: string }
type Score    = { player_id: string; hole_id: string; gross_score: number; stableford_points: number; no_return: boolean; round_id: string }
type RoundHcp       = { round_id: string; player_id: string; playing_handicap: number }
type CompositeHole  = { composite_player_id: string; round_id: string; hole_id: string; source_player_id: string }
interface Props {
  rounds: Round[]
  teams: Team[]
  holes: Hole[]
  scores: Score[]
  roundHandicaps: RoundHcp[]
  tees: unknown[]
  compositeHoles: CompositeHole[]
  activeRoundIds?: string[]
}

// ─── Scorecard styling constants ───────────────────────────────

const SC_SF    = { fontFamily: "Georgia, serif" }
const SC_MUTED = "text-[#7A7060]"
const SC_DARK  = "text-[#3A3A2E]"
const SC_GRID  = "grid grid-cols-[2fr_2fr_3fr_3fr_3fr_2fr] w-full"

// ─── Parchment palette (grey-parchment) ────────────────────────
const PC_BG      = "#E4E1DA"   // main bg
const PC_ALT     = "#DDDAD2"   // alternate row
const PC_HEADER  = "#D5D2CB"   // column header / subtotal row bg
const PC_BORDER  = "#C8C5BD"   // row border
const PC_GOLD_LO = "rgba(201,168,76,0.18)"   // Out/In bg
const PC_GOLD_HI = "rgba(201,168,76,0.32)"   // Tot bg

// ─── Course short names ────────────────────────────────────────

const COURSE_SHORT: Record<string, string> = {
  "Old Tom Morris":    "Old Tom",
  "St Patricks Links": "St Patrick's",
  "Sandy Hills":       "Sandy Hills",
}

// ─── Player helpers ────────────────────────────────────────────

const ROLE_ORDER: Record<string, number> = { dad: 0, mum: 1, son: 2 }
function sortedPlayers(players: Player[]) {
  return [...players].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
}
const displayName = (p: Player) =>
  p.is_composite ? p.name.replace(/^Composite\s+/i, "") : p.name

function isDefaultTeamName(name: string) {
  return /^Team\s+[1-4]$/i.test(name.trim())
}

// ─── Team scoring ──────────────────────────────────────────────

function teamRoundPts(team: Team, holes: Hole[], scores: Score[], roundId: string): number {
  return holes.reduce((total, hole) => {
    const pts = team.players
      .map(p => scores.find(s => s.player_id === p.id && s.hole_id === hole.id && s.round_id === roundId))
      .filter(Boolean)
      .map(s => s!.stableford_points)
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((s, v) => s + v, 0)
    return total + pts
  }, 0)
}

// ─── Score symbol (sized for team scorecard) ───────────────────

function ScoreSymbol({ gross, par, isNR, muted, dark, sf }: {
  gross: number | null; par: number; isNR?: boolean
  muted: string; dark: string; sf: React.CSSProperties
}) {
  if (isNR) return (
    <span className="inline-flex items-center justify-center w-7 h-7 border border-orange-500/60 rounded-sm text-orange-500 text-[10px] font-semibold">NR</span>
  )
  if (gross === null) return <span className={`${muted} text-sm`} style={sf}>—</span>
  const diff = gross - par
  const n = <span className="text-xs font-semibold leading-none">{gross}</span>
  if (diff <= -2) return (
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-full border border-[#C9A84C]">
      <span className="absolute inset-[2px] rounded-full border border-[#C9A84C]" />
      <span className="relative text-[10px] font-semibold leading-none text-[#7B5C1E]">{gross}</span>
    </span>
  )
  if (diff === -1) return (
    <span className="w-7 h-7 rounded-full border border-[#C9A84C] flex items-center justify-center text-[#7B5C1E]">{n}</span>
  )
  if (diff === 0) return <span className={`${dark} text-xs font-semibold`} style={sf}>{gross}</span>
  if (diff === 1) return (
    <span className="w-7 h-7 rounded-md border border-[#9B8860] flex items-center justify-center text-[#5A4F3A]">{n}</span>
  )
  return (
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#9B8860]">
      <span className="absolute inset-[2px] rounded-sm border border-[#9B8860]" />
      <span className="relative text-xs font-semibold leading-none text-[#5A4F3A]">{gross}</span>
    </span>
  )
}

// ─── Composite scorecard ───────────────────────────────────────

function CompositeScorecard({ team, round, holes, scores, roundHandicaps, compositeHoles, allTeams }: {
  team: Team; round: Round; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]
  compositeHoles: CompositeHole[]; allTeams: Team[]
}) {
  const courseId   = round.courses?.id ?? ""
  const courseHoles = holes
    .filter(h => h.course_id === courseId)
    .sort((a, b) => a.hole_number - b.hole_number)

  const players = sortedPlayers(team.players)
  if (players.length === 0) return null

  const sf    = SC_SF
  const muted = SC_MUTED
  const dark  = SC_DARK
  const grid  = SC_GRID

  const ptsColor = (pts: number | null) =>
    pts === null ? muted :
    pts === 0    ? "text-[#A89880] opacity-50" :
                   "text-[#7B6C3E] font-bold"

  // Build per-player score maps: hole_number → Score
  const playerScoreMaps = players.map(p =>
    new Map(
      scores
        .filter(s => s.player_id === p.id && s.round_id === round.id)
        .flatMap(s => {
          const hole = holes.find(h => h.id === s.hole_id)
          return hole ? [[hole.hole_number, s] as [number, Score]] : []
        })
    )
  )

  // Lookup maps for composite source colours
  const compositeHoleMap = new Map(
    compositeHoles.map(ch => [`${ch.composite_player_id}:${ch.round_id}:${ch.hole_id}`, ch.source_player_id])
  )
  const sourcePlayerColorMap = new Map(
    allTeams.flatMap(t => t.players.map(p => [p.id, t.color] as [string, string]))
  )

  // Build rows
  const rows = courseHoles.map((hole, idx) => {
    const grossScores = players.map((_, pi) => {
      const s = playerScoreMaps[pi].get(hole.hole_number)
      return s ? (s.no_return ? null : s.gross_score) : null
    })
    const isNRScores = players.map((_, pi) => {
      const s = playerScoreMaps[pi].get(hole.hole_number)
      return s?.no_return === true
    })
    const stablefordScores = players.map((_, pi) => {
      const s = playerScoreMaps[pi].get(hole.hole_number)
      return s ? s.stableford_points : null
    })
    const holePoints = players.map((_, pi) => {
      const s = playerScoreMaps[pi].get(hole.hole_number)
      return s ? s.stableford_points : null
    })
    const hasScores = players.some((_, pi) => playerScoreMaps[pi].has(hole.hole_number))
    const positiveDesc = (holePoints.filter(p => p !== null && p > 0) as number[]).sort((a, b) => b - a)
    const bestPts = positiveDesc.slice(0, 2).reduce((s, v) => s + v, 0)
    const cutThreshold = positiveDesc.length >= 2 ? positiveDesc[1] : (positiveDesc[0] ?? 0)
    const contributors = holePoints.map(pts => pts !== null && pts > 0 && pts >= cutThreshold)
    const sourceColors = players.map(p => {
      if (!p.is_composite) return null
      const sourceId = compositeHoleMap.get(`${p.id}:${round.id}:${hole.id}`)
      return sourceId ? (sourcePlayerColorMap.get(sourceId) ?? null) : null
    })
    return { hole, idx, grossScores, stablefordScores, bestPts, hasScores, contributors, sourceColors, isNRScores }
  })

  const front9 = rows.slice(0, 9)
  const back9  = rows.slice(9)

  const front9Par  = front9.reduce((s, r) => s + r.hole.par, 0)
  const back9Par   = back9.reduce((s, r) => s + r.hole.par, 0)
  const front9Pts  = front9.reduce((s, r) => s + r.bestPts, 0)
  const back9Pts   = back9.reduce((s, r) => s + r.bestPts, 0)
  const front9HasScores = front9.some(r => r.hasScores)
  const back9HasScores  = back9.some(r => r.hasScores)

  const front9Gross = players.map((_, pi) => front9.reduce((s, r) => s + (r.grossScores[pi] ?? 0), 0))
  const back9Gross  = players.map((_, pi) => back9.reduce((s, r) => s + (r.grossScores[pi] ?? 0), 0))
  const totalGross  = players.map((_, pi) => front9Gross[pi] + back9Gross[pi])
  const totalPts    = front9Pts + back9Pts

  const front9PlayerPts = players.map((_, pi) => front9.reduce((s, r) => s + (r.stablefordScores[pi] ?? 0), 0))
  const back9PlayerPts  = players.map((_, pi) => back9.reduce((s, r) => s + (r.stablefordScores[pi] ?? 0), 0))
  const totalPlayerPts  = players.map((_, pi) => front9PlayerPts[pi] + back9PlayerPts[pi])

  const HoleRow = ({ hole, idx, grossScores, stablefordScores, bestPts, hasScores, contributors, sourceColors, isNRScores }: typeof rows[0]) => (
    <div
      key={hole.hole_number}
      className={`${grid} px-3 py-2 items-center border-b`}
      style={{ borderColor: PC_BORDER, background: idx % 2 === 1 ? PC_ALT : undefined }}
    >
      <span className={`text-sm font-semibold ${dark}`} style={sf}>{hole.hole_number}</span>
      <span className={`text-sm ${muted}`} style={sf}>{hole.par}</span>
      {grossScores.map((gross, pi) => (
        <span key={pi} className="flex flex-col items-center justify-center gap-0.5 py-1">
          <span className="flex items-center gap-0.5">
            <span className="relative inline-flex items-center justify-center">
              {contributors[pi] && (
                <span className="absolute w-9 h-9 rounded-md" style={{ background: "rgba(201,168,76,0.25)" }} />
              )}
              <span className="relative z-10">
                <ScoreSymbol gross={gross} par={hole.par} isNR={isNRScores[pi]} muted={muted} dark={dark} sf={sf} />
              </span>
            </span>
            {stablefordScores[pi] !== null && (
              <sup className={`text-[10px] leading-none ${muted}`} style={sf}>{stablefordScores[pi]}</sup>
            )}
          </span>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sourceColors[pi] ?? "transparent" }} />
        </span>
      ))}
      <span className={`text-right text-sm ${ptsColor(hasScores ? bestPts : null)}`} style={sf}>{hasScores ? bestPts : "—"}</span>
    </div>
  )

  return (
    <div style={{ background: PC_BG }}>

      {/* Front 9 */}
      {front9.map(row => <HoleRow key={row.hole.hole_number} {...row} />)}

      {/* Out subtotal */}
      <div className={`${grid} px-3 py-1.5 items-center border-b`} style={{ background: PC_GOLD_LO, borderColor: "#C9A84C40" }}>
        <span className="text-xs font-bold tracking-widest uppercase text-[#5C4520]" style={sf}>Out</span>
        <span className="text-sm font-bold text-[#5C4520]" style={sf}>{front9Par}</span>
        {players.map((_, pi) => (
          <span key={pi} className="text-center text-sm font-bold text-[#5C4520]" style={sf}>
            {front9HasScores ? front9PlayerPts[pi] : "—"}
          </span>
        ))}
        <span className="text-right text-sm font-bold text-[#7B6C3E]" style={sf}>{front9HasScores ? front9Pts : "—"}</span>
      </div>

      {/* Back 9 */}
      {back9.map(row => <HoleRow key={row.hole.hole_number} {...row} />)}

      {/* In subtotal */}
      <div className={`${grid} px-3 py-1.5 items-center border-b`} style={{ background: PC_GOLD_LO, borderColor: "#C9A84C40" }}>
        <span className="text-xs font-bold tracking-widest uppercase text-[#5C4520]" style={sf}>In</span>
        <span className="text-sm font-bold text-[#5C4520]" style={sf}>{back9Par}</span>
        {players.map((_, pi) => (
          <span key={pi} className="text-center text-sm font-bold text-[#5C4520]" style={sf}>
            {back9HasScores ? back9PlayerPts[pi] : "—"}
          </span>
        ))}
        <span className="text-right text-sm font-bold text-[#7B6C3E]" style={sf}>{back9HasScores ? back9Pts : "—"}</span>
      </div>

      {/* Tot row */}
      <div className={`${grid} px-3 py-2 items-center rounded-b-xl`} style={{ background: PC_GOLD_HI }}>
        <span className="text-xs font-bold tracking-widest uppercase text-[#4A3810]" style={sf}>Tot</span>
        <span className="text-sm font-bold text-[#4A3810]" style={sf}>{front9Par + back9Par}</span>
        {players.map((_, pi) => (
          <span key={pi} className="text-center text-sm font-bold text-[#4A3810]" style={sf}>
            {totalPlayerPts[pi]}
          </span>
        ))}
        <span className="text-right text-xl font-extrabold text-[#5C4520] font-[family-name:var(--font-playfair)]">{totalPts}</span>
      </div>

    </div>
  )
}

// ─── Scorecard modal ───────────────────────────────────────────

function ScorecardModal({ team, rounds, holes, scores, roundHandicaps, compositeHoles, allTeams, onClose }: {
  team: Team; rounds: Round[]; holes: Hole[]; scores: Score[]; roundHandicaps: RoundHcp[]
  compositeHoles: CompositeHole[]; allTeams: Team[]; onClose: () => void
}) {
  const [roundIdx, setRoundIdx] = useState(0)
  const touchStartX = useRef(0)
  const players = sortedPlayers(team.players)

  function goTo(i: number) {
    if (i < 0 || i >= rounds.length || i === roundIdx) return
    setRoundIdx(i)
  }

  const round = rounds[roundIdx]
  if (!round) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-[#0a1a0e] rounded-t-2xl flex flex-col max-h-[90vh]"
        style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-5 pb-2">
          <div className="min-w-0 flex-1">
            {!isDefaultTeamName(team.name) && (
              <p className="text-white/30 text-[10px] tracking-[0.15em] uppercase mb-1">{team.name}</p>
            )}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
              <span className="font-[family-name:var(--font-playfair)] text-xl text-white leading-snug">
                {players.map((p, i) => `${i + 1}. ${displayName(p)}`).join("   ")}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-xl flex-shrink-0"
          >✕</button>
        </div>

        {/* Round tabs */}
        <div className="flex-shrink-0 flex gap-1.5 px-4 pb-3">
          {rounds.map((r, i) => {
            const short = COURSE_SHORT[r.courses?.name ?? ""] ?? (r.courses?.name ?? `Round ${r.round_number}`)
            const active = i === roundIdx
            return (
              <button
                key={r.id}
                onClick={() => goTo(i)}
                className={`flex-1 py-2 px-2 rounded-sm text-center transition-colors border ${
                  active
                    ? "bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]"
                    : "bg-white/[0.03] border-[#1e3d28] text-white/35"
                }`}
              >
                <div className="font-[family-name:var(--font-playfair)] text-sm font-semibold leading-tight">{short}</div>
                <div className={`text-[10px] mt-0.5 tracking-[0.15em] uppercase ${active ? "text-[#C9A84C]/50" : "text-white/20"}`}>
                  Day {r.round_number}
                </div>
              </button>
            )
          })}
        </div>

        {/* Scrollable scorecard */}
        <div
          className="flex-1 overflow-y-auto min-h-0"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartX.current
            if (Math.abs(dx) > 60) goTo(roundIdx + (dx < 0 ? 1 : -1))
          }}
        >
          <div className="px-4 pb-8">
            <div className="shadow-2xl flex flex-col">

              {/* Column headers — sticky at top of scroll area; full-opacity solid bg */}
              <div className={`sticky top-0 z-20 ${SC_GRID} px-3 py-2 border-b bg-[#E4E1DA]`} style={{ borderColor: PC_BORDER }}>
                <span className={`text-sm tracking-[0.15em] font-semibold ${SC_DARK}`} style={SC_SF}>#</span>
                <span className={`text-sm tracking-[0.15em] uppercase font-semibold ${SC_DARK}`} style={SC_SF}>Par</span>
                {[1, 2, 3].map(n => (
                  <span key={n} className={`text-sm tracking-[0.15em] uppercase font-semibold text-center ${SC_DARK} bg-[#E4E1DA]`} style={SC_SF}>{n}</span>
                ))}
                <span className={`text-sm tracking-[0.15em] uppercase font-semibold ${SC_DARK} text-right`} style={SC_SF}>TOT</span>
              </div>

              {/* Score rows */}
              <CompositeScorecard
                team={team}
                round={round}
                holes={holes}
                scores={scores}
                roundHandicaps={roundHandicaps}
                compositeHoles={compositeHoles}
                allTeams={allTeams}
              />

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

export default function LeaderboardClient({ rounds, teams, holes, scores, roundHandicaps, tees, compositeHoles, activeRoundIds = [] }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<{ team: Team } | null>(null)

  // Real-time subscription: refresh server data whenever any live score is saved
  useEffect(() => {
    if (!activeRoundIds.length) return
    const channel = supabase
      .channel("leaderboard-live-scores")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_scores" }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoundIds.join(",")])

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number)
  const roundsByNumber: Record<number, Round> = {}
  sortedRounds.forEach(r => { roundsByNumber[r.round_number] = r })

  const rows = teams.map(team => {
    const roundPts: Record<number, number> = {}
    for (const r of sortedRounds) {
      const courseHoles = holes.filter(h => h.course_id === r.courses?.id)
      roundPts[r.round_number] = teamRoundPts(team, courseHoles, scores, r.id)
    }
    const total = Object.values(roundPts).reduce((s, p) => s + p, 0)
    return { team, roundPts, total }
  }).sort((a, b) => b.total - a.total)

  return (
    <>
      <div className="border border-[#1e3d28]">
        {/* Column headers */}
        <div className="sticky top-[85px] z-10 grid grid-cols-[24px_1fr_40px_40px_40px_52px] gap-x-2 items-center px-3 py-1.5 bg-[#0a1a0e] border-b border-[#1e3d28]">
          <span className="text-[10px] tracking-widest uppercase text-white/30">Pos</span>
          <span className="text-[10px] tracking-widest uppercase text-white/30">Team</span>
          {[1, 2, 3].map(n => (
            <span key={n} className="text-[10px] tracking-widest uppercase text-white/30 text-center">R{n}</span>
          ))}
          <span className="text-[10px] tracking-widets uppercase text-white/30 text-right">Tot</span>
        </div>

        {/* Team rows */}
        {rows.map(({ team, roundPts, total }, i) => {
          const isLast  = i === rows.length - 1
          const members = sortedPlayers(team.players).filter(p => !p.is_composite)
          const showCustomName = !isDefaultTeamName(team.name)

          return (
            <button
              key={team.id}
              onClick={() => setModal({ team })}
              className={`w-full grid grid-cols-[24px_1fr_40px_40px_40px_52px] gap-x-2 items-center px-3 py-2 text-left active:bg-white/5 transition-colors
                ${!isLast ? "border-b border-[#1e3d28]" : ""}`}
            >
              {/* Pos */}
              <span className="text-white/40 text-sm font-semibold tabular-nums self-center">
                {i + 1}
              </span>

              {/* Team identity — single dot + vertical player list */}
              <div className="min-w-0 py-1 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-[5px]" style={{ backgroundColor: team.color }} />
                <div className="min-w-0 flex-1">
                  {showCustomName && (
                    <p className="text-white/25 text-[10px] tracking-[0.15em] uppercase mb-1 leading-none">{team.name}</p>
                  )}
                  <div className="space-y-0.5">
                    {members.map(p => (
                      <div key={p.id} className="flex items-baseline gap-1.5">
                        <span className="text-base text-white/70 truncate leading-snug">{displayName(p)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-round points */}
              {[1, 2, 3].map(n => {
                const pts = roundPts[n] ?? 0
                return (
                  <span key={n} className={`text-center tabular-nums text-xl font-semibold self-center ${pts > 0 ? "text-white/70" : "text-white/20"}`}>
                    {pts > 0 ? pts : "—"}
                  </span>
                )
              })}

              {/* Total */}
              <span className={`text-right tabular-nums self-center font-bold ${total > 0 ? "text-2xl text-[#C9A84C]" : "text-base text-white/20"}`}>
                {total > 0 ? total : "—"}
              </span>
            </button>
          )
        })}
      </div>

      {/* Scorecard modal */}
      {modal && (
        <ScorecardModal
          team={modal.team}
          rounds={sortedRounds}
          holes={holes}
          scores={scores}
          roundHandicaps={roundHandicaps}
          compositeHoles={compositeHoles}
          allTeams={teams}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
