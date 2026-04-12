"use client"

import { useState, useRef } from "react"
import ScoreShape from "@/app/components/ScoreShape"

// ─── Types ─────────────────────────────────────────────────────

type ViewMode   = "stableford" | "strokes"
type StrokesView = "gross" | "nett"

type Course  = { id: string; name: string }
type Round   = { id: string; round_number: number; courses: Course | null }
type Team    = { name: string; color: string }
type Player  = { id: string; name: string; role: string; handicap: number; gender: string; team_id: string | null; is_composite?: boolean; teams: Team | null }
type Hole    = {
  id: string; hole_number: number; par: number; stroke_index: number; course_id: string
  yardage_black?: number; yardage_blue?: number; yardage_white?: number; yardage_red?: number
  yardage_sandstone?: number; yardage_slate?: number; yardage_granite?: number; yardage_claret?: number
}
type Tee     = { id: string; course_id: string; name: string; gender: string; par: number }
type RoundHcp = { round_id: string; player_id: string; playing_handicap: number }
type Score   = { player_id: string; hole_id: string; round_id: string; stableford_points: number; gross_score: number; no_return: boolean }
type CompositeHole = { composite_player_id: string; hole_id: string; round_id: string; source_player_name: string }

interface Props {
  rounds:         Round[]
  players:        Player[]
  holes:          Hole[]
  scores:         Score[]
  roundHandicaps: RoundHcp[]
  tees:           Tee[]
  compositeHoles: CompositeHole[]
}

// ─── Scorecard helpers ─────────────────────────────────────────

const COURSE_SHORT: Record<string, string> = {
  "Old Tom Morris":    "Old Tom",
  "St Patricks Links": "St Patrick's",
  "Sandy Hills":       "Sandy Hills",
}
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

function getYardage(hole: Hole, teeName: string): number | null {
  const key = `yardage_${teeName.toLowerCase()}` as keyof Hole
  const v = hole[key]
  return typeof v === "number" ? v : null
}

// ─── Leaderboard helpers ───────────────────────────────────────

const displayName = (p: Player) => p.is_composite ? p.name.replace(/^Composite\s+/i, "") : p.name

function playerRoundStableford(playerId: string, roundId: string, scores: Score[]) {
  return scores
    .filter(s => s.player_id === playerId && s.round_id === roundId)
    .reduce((sum, s) => sum + s.stableford_points, 0)
}

function shotsReceived(si: number, hcp: number) {
  return Math.floor(hcp / 18) + (si <= hcp % 18 ? 1 : 0)
}

function nrGrossCalc(hole: Hole, playingHandicap: number): number {
  return hole.par + 2 + shotsReceived(hole.stroke_index, playingHandicap)
}

function playerRoundGross(playerId: string, roundId: string, scores: Score[], holes: Hole[], roundHandicaps: RoundHcp[]) {
  const ph = roundHandicaps.find(h => h.player_id === playerId && h.round_id === roundId)?.playing_handicap ?? 0
  return scores
    .filter(s => s.player_id === playerId && s.round_id === roundId)
    .reduce((sum, s) => {
      if (s.no_return) {
        const hole = holes.find(h => h.id === s.hole_id)
        return sum + (hole ? nrGrossCalc(hole, ph) : 0)
      }
      return sum + s.gross_score
    }, 0)
}

function playerRoundHasNR(playerId: string, roundId: string, scores: Score[]) {
  return scores.some(s => s.player_id === playerId && s.round_id === roundId && s.no_return)
}

function playerTotalStableford(playerId: string, scores: Score[]) {
  return scores.filter(s => s.player_id === playerId).reduce((sum, s) => sum + s.stableford_points, 0)
}

function playerTotalGross(playerId: string, scores: Score[], holes: Hole[], roundHandicaps: RoundHcp[]) {
  return scores
    .filter(s => s.player_id === playerId)
    .reduce((sum, s) => {
      if (s.no_return) {
        const hole = holes.find(h => h.id === s.hole_id)
        const ph = roundHandicaps.find(h => h.player_id === playerId && h.round_id === s.round_id)?.playing_handicap ?? 0
        return sum + (hole ? nrGrossCalc(hole, ph) : 0)
      }
      return sum + s.gross_score
    }, 0)
}

function playerHasAnyNR(playerId: string, scores: Score[]) {
  return scores.some(s => s.player_id === playerId && s.no_return)
}

function playerRoundNett(playerId: string, roundId: string, courseId: string, scores: Score[], holes: Hole[]) {
  const roundScores = scores.filter(s => s.player_id === playerId && s.round_id === roundId)
  if (roundScores.length === 0) return null
  const pts = roundScores.reduce((sum, s) => sum + (s.no_return ? 0 : s.stableford_points), 0)
  const coursePar = holes.filter(h => h.course_id === courseId).reduce((sum, h) => sum + h.par, 0)
  return coursePar + 36 - pts
}

function playerTotalNett(playerId: string, scores: Score[], holes: Hole[], rounds: Round[]) {
  return rounds.reduce((total, r) => {
    const courseId = r.courses?.id ?? ""
    const roundScores = scores.filter(s => s.player_id === playerId && s.round_id === r.id)
    if (roundScores.length === 0) return total
    const pts = roundScores.reduce((sum, s) => sum + (s.no_return ? 0 : s.stableford_points), 0)
    const coursePar = holes.filter(h => h.course_id === courseId).reduce((sum, h) => sum + h.par, 0)
    return total + coursePar + 36 - pts
  }, 0)
}

function playerBadges(playerId: string, scores: Score[], holes: Hole[]) {
  let birdies = 0, eagles = 0
  for (const s of scores) {
    if (s.player_id !== playerId || s.no_return) continue
    const hole = holes.find(h => h.id === s.hole_id)
    if (!hole) continue
    const diff = s.gross_score - hole.par
    if (diff === -1) birdies++
    else if (diff <= -2) eagles++
  }
  return { birdies, eagles }
}

function statusLabel(status: number): string {
  if (status === 0) return "AS"
  const up = Math.abs(status)
  return status > 0 ? `${up} UP` : `${up} DN`
}

function statusColor(status: number) {
  if (status === 0) return "text-white/40"
  return status > 0 ? "text-[#C9A84C]" : "text-rose-400"
}

// ─── Subtotal row (scorecard) ──────────────────────────────────

function SubtotalRow({
  label, par, yards, gross, pts, hasScores, hasNR, isTotal,
}: {
  label: string; par: number; yards: number | null
  gross: number; pts: number; hasScores: boolean; hasNR?: boolean; isTotal?: boolean
}) {
  const crimson = "font-[family-name:var(--font-crimson)]"
  const bg = isTotal ? "bg-[#1a3a22]" : "bg-gray-100"
  const textLabel = isTotal ? "text-white/70" : "text-gray-500"
  const textData  = isTotal ? "text-white" : "text-gray-700"
  const textPts   = isTotal ? "text-[#C9A84C] font-semibold" : "text-[#2d6a4f] font-semibold"
  return (
    <tr className={`border-t-2 ${isTotal ? "border-[#1e3a22]" : "border-gray-200"} ${bg}`}>
      <td className={`py-2 px-3 text-sm uppercase tracking-wider font-semibold ${textLabel} font-[family-name:var(--font-playfair)]`}>{label}</td>
      <td className={`text-center py-2 px-2 ${isTotal ? "text-lg" : "text-base"} font-semibold ${textData} ${crimson}`}>{par}</td>
      <td className="py-2 px-2" />
      <td className={`text-center py-2 px-2 text-base ${textData} ${crimson}`}>{yards ?? "—"}</td>
      <td className={`text-center py-2 px-2 ${isTotal ? "text-lg" : "text-base"} font-semibold ${textData} ${crimson}`}>
        {hasScores ? <>{gross > 0 ? gross : "—"}{hasNR && <span className="text-orange-500 text-[9px] ml-0.5">NR</span>}</> : "—"}
      </td>
      <td className={`text-center py-2 px-2 ${isTotal ? "text-lg font-bold" : "text-base"} ${textPts} ${crimson}`}>
        {hasScores ? pts : "—"}
      </td>
    </tr>
  )
}

// ─── Scorecard modal ───────────────────────────────────────────

function ScorecardModal({ player, rounds, holes, scores, roundHandicaps, tees, compositeHoles, initialRoundIdx, onClose }: {
  player: Player
  rounds: Round[]
  holes: Hole[]
  scores: Score[]
  roundHandicaps: RoundHcp[]
  tees: Tee[]
  compositeHoles: CompositeHole[]
  initialRoundIdx: number
  onClose: () => void
}) {
  const [roundIdx, setRoundIdx] = useState(Math.min(initialRoundIdx, Math.max(0, rounds.length - 1)))
  const touchStartX = useRef(0)

  const { birdies, eagles } = playerBadges(player.id, scores, holes)
  const emojiStr = "🦅".repeat(eagles) + "🦤".repeat(birdies)

  function goTo(i: number) {
    if (i < 0 || i >= rounds.length || i === roundIdx) return
    setRoundIdx(i)
  }

  const round = rounds[roundIdx]
  if (!round) return null

  const courseId   = round.courses?.id ?? ""
  const courseName = round.courses?.name ?? ""

  // Composite initials map for this round
  const compositeMap: Record<string, string> = {}
  if (player.is_composite) {
    for (const ch of compositeHoles) {
      if (ch.composite_player_id === player.id && ch.round_id === round.id) {
        const initials = ch.source_player_name
          .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
        compositeMap[ch.hole_id] = initials
      }
    }
  }

  const courseHoles  = holes.filter(h => h.course_id === courseId).sort((a, b) => a.hole_number - b.hole_number)
  const roundScores  = scores.filter(s => s.player_id === player.id && s.round_id === round.id)
  const playingHcp   = roundHandicaps.find(h => h.player_id === player.id && h.round_id === round.id)?.playing_handicap ?? null
  const tee          = defaultTee(tees, courseId, player.gender)
  const hasScores    = roundScores.length > 0
  const front        = courseHoles.slice(0, 9)
  const back         = courseHoles.slice(9, 18)

  function holeScore(hole: Hole): Score | null {
    return roundScores.find(s => s.hole_id === hole.id) ?? null
  }
  function nrGross(hole: Hole): number {
    const ph = playingHcp ?? 0
    return hole.par + 2 + Math.floor(ph / 18) + (hole.stroke_index <= ph % 18 ? 1 : 0)
  }
  function sumGross(hs: Hole[]) {
    return hs.reduce((sum, h) => {
      const s = holeScore(h)
      return s ? sum + (s.no_return ? nrGross(h) : s.gross_score) : sum
    }, 0)
  }
  function sumPts(hs: Hole[]) {
    return hs.reduce((sum, h) => sum + (holeScore(h)?.stableford_points ?? 0), 0)
  }
  function sumPar(hs: Hole[]) {
    return hs.reduce((sum, h) => sum + h.par, 0)
  }
  function sumYards(hs: Hole[]): number | null {
    if (!tee) return null
    let total = 0
    for (const h of hs) {
      const y = getYardage(h, tee.name)
      if (y == null) return null
      total += y
    }
    return total
  }

  const outPar    = sumPar(front);  const inPar    = sumPar(back)
  const outGross  = sumGross(front); const inGross  = sumGross(back)
  const outPts    = sumPts(front);   const inPts    = sumPts(back)
  const outYards  = sumYards(front); const inYards  = sumYards(back)
  const totalPar   = outPar + inPar
  const totalGross = outGross + inGross
  const totalPts   = outPts + inPts
  const totalYards = outYards != null && inYards != null ? outYards + inYards : null
  const hasNR      = roundScores.some(s => s.no_return)
  const crimson    = "font-[family-name:var(--font-crimson)]"

  const HoleRow = ({ hole, i }: { hole: Hole; i: number }) => {
    const s    = holeScore(hole)
    const pts  = s?.stableford_points ?? null
    const initials = compositeMap[hole.id]
    return (
      <tr className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
        <td className={`py-2.5 px-3 text-lg font-semibold text-gray-700 ${crimson}`}>
          <div className="flex items-center gap-1">
            {hole.hole_number}
            {initials && (
              <span className="text-[9px] font-bold text-[#C9A84C] border border-[#C9A84C]/40 px-0.5 rounded-sm leading-tight">{initials}</span>
            )}
          </div>
        </td>
        <td className={`text-center py-2.5 px-2 text-base text-gray-500 ${crimson}`}>{hole.par}</td>
        <td className={`text-center py-2.5 px-2 text-sm text-gray-300 ${crimson}`}>{hole.stroke_index}</td>
        <td className={`text-center py-2.5 px-2 text-sm text-gray-400 ${crimson}`}>
          {tee ? (getYardage(hole, tee.name) ?? "—") : "—"}
        </td>
        <td className="text-center py-1.5 px-2">
          {s
            ? s.no_return
              ? <span className={`inline-flex items-center justify-center w-7 h-7 border border-orange-500/60 rounded-sm text-orange-500 text-xs font-semibold ${crimson}`}>NR</span>
              : <ScoreShape gross={s.gross_score} par={hole.par} />
            : <span className="text-gray-200 text-sm">—</span>
          }
        </td>
        <td className={`text-center py-2.5 px-2 text-lg font-semibold ${crimson} ${
          pts == null ? "text-gray-200" : pts >= 3 ? "text-[#2d6a4f]" : pts === 0 ? "text-gray-300" : "text-gray-500"
        }`}>
          {pts != null ? pts : "—"}
        </td>
      </tr>
    )
  }

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
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: player.teams?.color ?? "#6b7280" }}
            />
            <span className="font-[family-name:var(--font-playfair)] text-xl text-white leading-snug">
              {displayName(player)}
              {emojiStr && <span className="text-sm ml-1.5">{emojiStr}</span>}
              {player.is_composite && (
                <span className="text-[11px] font-bold text-[#C9A84C] border border-[#C9A84C]/40 px-1 rounded-sm leading-tight ml-1.5">C</span>
              )}
            </span>
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
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden">

              {/* Card header */}
              <div className="bg-[#1a3a22] px-4 py-3 flex items-center justify-between">
                <span className="font-[family-name:var(--font-playfair)] text-white text-base">{courseName}</span>
                <div className={`flex items-center gap-3 text-sm ${crimson}`}>
                  {tee && <span className="text-[#C9A84C]/80 capitalize">{tee.name.toLowerCase()} tees</span>}
                  {playingHcp != null && <span className="text-white/40">hcp {playingHcp}</span>}
                </div>
              </div>

              {courseHoles.length === 0 ? (
                <p className="text-gray-300 text-sm text-center py-10">Course data unavailable</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-400 uppercase tracking-wide font-[family-name:var(--font-playfair)] w-10">Hole</th>
                      <th className="text-center py-2 px-2 text-sm font-normal text-gray-400 uppercase tracking-wide w-9">Par</th>
                      <th className="text-center py-2 px-2 text-sm font-normal text-gray-400 uppercase tracking-wide w-9">SI</th>
                      <th className="text-center py-2 px-2 text-sm font-normal text-gray-400 uppercase tracking-wide w-12">Yds</th>
                      <th className="text-center py-2 px-2 text-sm font-normal text-gray-400 uppercase tracking-wide">Score</th>
                      <th className="text-center py-2 px-2 text-sm font-normal text-gray-400 uppercase tracking-wide w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {front.map((hole, i) => <HoleRow key={hole.id} hole={hole} i={i} />)}
                    <SubtotalRow label="Out" par={outPar} yards={outYards} gross={outGross} pts={outPts} hasScores={hasScores} />
                    {back.map((hole, i) => <HoleRow key={hole.id} hole={hole} i={i} />)}
                    <SubtotalRow label="In" par={inPar} yards={inYards} gross={inGross} pts={inPts} hasScores={hasScores} />
                    <SubtotalRow label="Total" par={totalPar} yards={totalYards} gross={totalGross} pts={totalPts} hasScores={hasScores} hasNR={hasNR} isTotal />
                  </tbody>
                </table>
              )}

              {!hasScores && courseHoles.length > 0 && (
                <p className={`text-center text-gray-300 text-sm py-4 border-t border-gray-100 ${crimson}`}>
                  No scores recorded yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Matchplay ─────────────────────────────────────────────────

function MatchplaySection({ playerA, playerB, rounds, holes, scores, noShots, onToggleNoShots }: {
  playerA: Player; playerB: Player
  rounds: Round[]; holes: Hole[]; scores: Score[]
  noShots: boolean; onToggleNoShots: () => void
}) {
  let runningStatus = 0

  const higherHcpIsA = playerA.handicap >= playerB.handicap

  const roundData = rounds.map(round => {
    const courseHoles = holes
      .filter(h => h.course_id === round.courses?.id)
      .sort((a, b) => a.hole_number - b.hole_number)

    const holeResults = courseHoles.map(hole => {
      const aScore = scores.find(s => s.player_id === playerA.id && s.hole_id === hole.id && s.round_id === round.id)
      const bScore = scores.find(s => s.player_id === playerB.id && s.hole_id === hole.id && s.round_id === round.id)

      let result: "A" | "B" | "H" | null = null
      if (aScore !== undefined && bScore !== undefined) {
        if (noShots) {
          if (aScore.no_return && bScore.no_return) result = "H"
          else if (aScore.no_return)  { runningStatus--; result = "B" }
          else if (bScore.no_return)  { runningStatus++; result = "A" }
          else if (aScore.gross_score < bScore.gross_score) { runningStatus++; result = "A" }
          else if (bScore.gross_score < aScore.gross_score) { runningStatus--; result = "B" }
          else result = "H"
        } else {
          if (aScore.stableford_points > bScore.stableford_points)      { runningStatus++; result = "A" }
          else if (bScore.stableford_points > aScore.stableford_points) { runningStatus--; result = "B" }
          else result = "H"
        }
      }

      const snapshot = runningStatus
      return { hole, aScore, bScore, result, status: snapshot }
    })

    return { round, holeResults }
  })

  const finalStatus  = runningStatus
  const totalHoles   = rounds.reduce((n, r) => n + holes.filter(h => h.course_id === r.courses?.id).length, 0)
  const playedHoles  = scores.filter(s => s.player_id === playerA.id || s.player_id === playerB.id).length > 0
    ? roundData.flatMap(r => r.holeResults).filter(h => h.result !== null).length
    : 0
  const remaining    = totalHoles - playedHoles

  const matchResult = () => {
    if (playedHoles === 0) return null
    if (remaining > 0 && Math.abs(finalStatus) <= remaining) return null
    if (finalStatus === 0) return "Match all square"
    const winner = finalStatus > 0 ? playerA.name.split(" ")[0] : playerB.name.split(" ")[0]
    const up = Math.abs(finalStatus)
    return remaining === 0
      ? `${winner} wins ${up} UP`
      : `${winner} wins ${up}&${remaining}`
  }

  const result = matchResult()

  const noShotsBtn = (
    <button
      onClick={onToggleNoShots}
      className={`px-2 py-0.5 text-xs border rounded-sm transition-colors ${
        noShots
          ? "border-[#C9A84C]/60 bg-[#C9A84C]/10 text-[#C9A84C]"
          : "border-[#1e3d28] text-white/30 hover:text-white/50"
      }`}
    >
      No shots
    </button>
  )

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[#C9A84C] font-medium text-sm">{playerA.name.split(" ")[0]}</span>
          {higherHcpIsA && noShotsBtn}
        </div>
        <span className="text-white/25 text-xs uppercase tracking-widest">vs</span>
        <div className="flex items-center gap-2">
          {!higherHcpIsA && noShotsBtn}
          <span className="text-rose-300 font-medium text-sm">{playerB.name.split(" ")[0]}</span>
        </div>
      </div>

      {result && (
        <div className="border border-[#C9A84C]/40 bg-[#C9A84C]/10 rounded-sm px-5 py-3 text-center">
          <span className="font-[family-name:var(--font-playfair)] text-[#C9A84C] text-xl">{result}</span>
        </div>
      )}

      {roundData.map(({ round, holeResults }) => {
        const played = holeResults.filter(h => h.result !== null)
        if (played.length === 0) return (
          <div key={round.id} className="border border-[#1e3d28] bg-[#0f2418] rounded-sm px-4 py-3">
            <p className="text-white/40 text-sm">{round.courses?.name} — no scores yet</p>
          </div>
        )

        return (
          <div key={round.id} className="border border-[#1e3d28] bg-[#0f2418] rounded-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#1e3d28] flex items-center justify-between">
              <span className="font-[family-name:var(--font-playfair)] text-white text-sm">{round.courses?.name}</span>
              <span className="text-white/30 text-xs tracking-widest uppercase">Day {round.round_number}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1e3d28]">
                    <th className="text-left px-3 py-2 text-white/25 font-normal min-w-[36px]">Hole</th>
                    <th className="text-right px-3 py-2 text-[#C9A84C]/60 font-semibold min-w-[80px]">{playerA.name.split(" ")[0]}</th>
                    <th className="text-center px-2 py-2 text-white/20 font-normal min-w-[40px]"></th>
                    <th className="text-left px-3 py-2 text-rose-300/60 font-semibold min-w-[80px]">{playerB.name.split(" ")[0]}</th>
                    <th className="text-center px-3 py-2 text-white/25 font-normal min-w-[56px]">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {holeResults.map(({ hole, aScore, bScore, result, status }) => {
                    const hasScores = aScore !== undefined && bScore !== undefined
                    const aPts  = aScore?.stableford_points ?? null
                    const bPts  = bScore?.stableford_points ?? null
                    const aGross = aScore?.gross_score ?? null
                    const bGross = bScore?.gross_score ?? null

                    return (
                      <tr key={hole.id} className={`border-t border-[#1e3d28]/40 ${!hasScores ? "opacity-30" : ""}`}>
                        <td className="px-3 py-1.5 text-white/40">{hole.hole_number}</td>

                        <td className={`text-right px-3 py-1.5 font-medium
                          ${result === "A" ? "text-[#C9A84C] font-bold" : result === "H" ? "text-white/60" : "text-white/35"}`}>
                          {aGross !== null ? (
                            noShots
                              ? aScore?.no_return ? <span className="text-orange-400/70">NR</span> : aGross
                              : <>{aGross}<sup className="text-[9px] opacity-60 ml-0.5">{aPts}</sup></>
                          ) : "—"}
                        </td>

                        <td className="text-center px-2 py-1.5">
                          {result === "A" && <span className="text-[#C9A84C] font-bold">›</span>}
                          {result === "B" && <span className="text-rose-400 font-bold">‹</span>}
                          {result === "H" && <span className="text-white/20">·</span>}
                          {result === null && <span className="text-white/10">–</span>}
                        </td>

                        <td className={`px-3 py-1.5 font-medium
                          ${result === "B" ? "text-rose-300 font-bold" : result === "H" ? "text-white/60" : "text-white/35"}`}>
                          {bGross !== null ? (
                            noShots
                              ? bScore?.no_return ? <span className="text-orange-400/70">NR</span> : bGross
                              : <>{bGross}<sup className="text-[9px] opacity-60 ml-0.5">{bPts}</sup></>
                          ) : "—"}
                        </td>

                        <td className={`text-center px-3 py-1.5 font-semibold ${hasScores ? statusColor(status) : "text-white/10"}`}>
                          {hasScores ? statusLabel(status) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

export default function IndividualClient({ rounds, players, holes, scores, roundHandicaps, tees, compositeHoles }: Props) {
  const [viewMode, setViewMode]       = useState<ViewMode>("stableford")
  const [strokesView, setStrokesView] = useState<StrokesView>("gross")
  const [playerAId, setPlayerAId]     = useState("")
  const [playerBId, setPlayerBId]     = useState("")
  const [noShots, setNoShots]         = useState(false)
  const [modal, setModal]             = useState<{ playerId: string; roundIdx: number } | null>(null)

  const standings = players
    .map(p => {
      const byRound = rounds.map(r => {
        const hasRoundScores = scores.some(s => s.player_id === p.id && s.round_id === r.id)
        if (!hasRoundScores) return { sf: null, gross: null, nett: null, hasNR: false }
        return {
          sf:    playerRoundStableford(p.id, r.id, scores),
          gross: playerRoundGross(p.id, r.id, scores, holes, roundHandicaps),
          nett:  playerRoundNett(p.id, r.id, r.courses?.id ?? "", scores, holes),
          hasNR: playerRoundHasNR(p.id, r.id, scores),
        }
      })
      const hasAny     = scores.some(s => s.player_id === p.id)
      const totalSF    = playerTotalStableford(p.id, scores)
      const totalGross = playerTotalGross(p.id, scores, holes, roundHandicaps)
      const totalNett  = playerTotalNett(p.id, scores, holes, rounds)
      const hasNR      = playerHasAnyNR(p.id, scores)
      const badges     = playerBadges(p.id, scores, holes)
      return { player: p, byRound, hasAny, totalSF, totalGross, totalNett, hasNR, badges }
    })
    .sort((a, b) => {
      if (!a.hasAny && !b.hasAny) return 0
      if (!a.hasAny) return 1
      if (!b.hasAny) return -1
      if (viewMode === "stableford") return b.totalSF - a.totalSF
      if (strokesView === "nett") return a.totalNett - b.totalNett
      return a.totalGross - b.totalGross
    })

  // Assign positions (ties share same position)
  const positions: (number | string)[] = []
  standings.forEach((s, i) => {
    if (!s.hasAny) { positions.push("—"); return }
    if (i === 0) { positions.push(1); return }
    const prev = standings[i - 1]
    const prevPos = positions[i - 1]
    const isTie = viewMode === "stableford"
      ? s.totalSF === prev.totalSF
      : strokesView === "nett"
        ? s.totalNett === prev.totalNett
        : s.totalGross === prev.totalGross
    positions.push(isTie ? prevPos : i + 1)
  })

  function getRoundValue(r: typeof standings[0]["byRound"][0]) {
    if (viewMode === "stableford") return r.sf
    if (strokesView === "nett") return r.nett
    return r.gross
  }

  function getTotValue(s: typeof standings[0]) {
    if (!s.hasAny) return null
    if (viewMode === "stableford") return s.totalSF
    if (strokesView === "nett") return s.totalNett
    return s.totalGross
  }

  const modalPlayer = modal ? players.find(p => p.id === modal.playerId) ?? null : null

  const playerA = players.find(p => p.id === playerAId)
  const playerB = players.find(p => p.id === playerBId)

  return (
    <>
      <div className="space-y-10">

        {/* ── Individual standings ── */}
        <section>

          {/* Mode toggle */}
          <div className="flex border border-[#1e3d28] overflow-hidden mb-3">
            <button
              onClick={() => setViewMode("stableford")}
              className={`flex-1 py-2.5 text-sm tracking-[0.15em] uppercase transition-colors
                ${viewMode === "stableford" ? "bg-[#1e3d28] text-[#C9A84C]" : "text-white/40 hover:text-white/60"}`}
            >
              Stableford
            </button>
            <button
              onClick={() => setViewMode("strokes")}
              className={`flex-1 py-2.5 text-sm tracking-[0.15em] uppercase transition-colors border-l border-[#1e3d28]
                ${viewMode === "strokes" ? "bg-[#1e3d28] text-[#C9A84C]" : "text-white/40 hover:text-white/60"}`}
            >
              Strokes
            </button>
          </div>

          {/* Strokes sub-toggle */}
          {viewMode === "strokes" && (
            <div className="inline-flex rounded-full border border-[#1e3d28] overflow-hidden mb-4">
              <button
                onClick={() => setStrokesView("gross")}
                className={`px-3 py-2.5 text-sm tracking-[0.15em] uppercase transition-colors
                  ${strokesView === "gross" ? "bg-[#1e3d28] text-[#C9A84C]" : "text-white/40 hover:text-white/60"}`}
              >
                Gross
              </button>
              <button
                onClick={() => setStrokesView("nett")}
                className={`px-3 py-2.5 text-sm tracking-[0.15em] uppercase transition-colors border-l border-[#1e3d28]
                  ${strokesView === "nett" ? "bg-[#1e3d28] text-[#C9A84C]" : "text-white/40 hover:text-white/60"}`}
              >
                Nett
              </button>
            </div>
          )}

          {/* Card: sticky column header + rows */}
          <div className="border border-[#1e3d28]">

            {/* Sticky column headers */}
            <div className="sticky top-0 z-10 grid grid-cols-[20px_1fr_40px_40px_40px_56px] gap-x-1 items-center px-3 py-1 bg-[#0a1a0e] border-b border-[#1e3d28]">
              <span className="text-[10px] tracking-widest uppercase text-white/25">Pos</span>
              <span className="text-[10px] tracking-widests uppercase text-white/25">Player</span>
              {rounds.map(r => (
                <span key={r.id} className="text-xs text-white/25 text-center tabular-nums">{r.round_number}</span>
              ))}
              <span className="text-[10px] tracking-widests uppercase text-[#C9A84C]/50 text-right">
                {viewMode === "stableford" ? "Tot" : strokesView === "nett" ? "Nett" : "Gross"}
              </span>
            </div>

            {/* Rows */}
            {standings.length === 0 ? (
              <p className="px-4 py-8 text-center text-white/20 text-sm">No scores yet</p>
            ) : standings.map(({ player, byRound, hasAny, totalSF, totalGross, totalNett, hasNR, badges }, i) => {
              const totValue = getTotValue({ player, byRound, hasAny, totalSF, totalGross, totalNett, hasNR, badges })
              const canOpen  = hasAny

              return (
                <div
                  key={player.id}
                  onClick={() => canOpen && setModal({ playerId: player.id, roundIdx: 0 })}
                  className={`grid grid-cols-[20px_1fr_40px_40px_40px_56px] gap-x-1 items-center px-3 py-1
                    border-b border-[#1e3d28] last:border-b-0
                    ${canOpen ? "cursor-pointer active:bg-white/5 transition-colors" : ""}`}
                >
                  {/* Pos */}
                  <span className="text-white/40 text-base font-semibold tabular-nums">
                    {positions[i]}
                  </span>

                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: player.teams?.color ?? "#6b7280" }} />
                    <span className="text-lg text-white/80 truncate">{displayName(player)}</span>
                    {player.is_composite && (
                      <span className="text-[9px] font-bold text-[#C9A84C] border border-[#C9A84C]/40 px-0.5 rounded-sm leading-tight flex-shrink-0">C</span>
                    )}
                  </div>

                  {/* R1, R2, R3 */}
                  {byRound.map((r, j) => {
                    const val = getRoundValue(r)
                    const hasRound    = r.sf !== null
                    const canOpenRound = hasRound
                    return (
                      <div
                        key={j}
                        onClick={e => {
                          e.stopPropagation()
                          if (canOpenRound) setModal({ playerId: player.id, roundIdx: j })
                        }}
                        className={`flex items-baseline justify-center gap-0.5 text-2xl font-semibold tabular-nums rounded-sm py-0.5 transition-colors
                          ${canOpenRound ? "cursor-pointer active:bg-white/10" : ""}
                          ${hasRound ? "text-white/70" : "text-white/20 font-normal"}`}
                      >
                        {hasRound ? (
                          <>
                            {val}
                            {r.hasNR && viewMode === "strokes" && strokesView === "gross" && (
                              <span className="text-orange-400/60 text-[8px] leading-none">NR</span>
                            )}
                          </>
                        ) : "—"}
                      </div>
                    )
                  })}

                  {/* TOT */}
                  <span className={`text-right font-[family-name:var(--font-playfair)] tabular-nums
                    ${hasAny ? "text-[#C9A84C] text-2xl font-bold" : "text-white/20 text-sm font-normal"}`}>
                    {hasAny ? totValue : "—"}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Matchplay ── */}
        <section>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white mb-5">Matchplay</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-sm tracking-[0.2em] uppercase text-white/30 mb-1.5">Player A</label>
              <select
                value={playerAId}
                onChange={e => { setPlayerAId(e.target.value); setNoShots(false) }}
                className="w-full bg-[#0f2418] border border-[#1e3d28] text-white px-4 py-3 rounded-sm appearance-none focus:outline-none focus:border-[#C9A84C] text-sm"
              >
                <option value="">Select player…</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === playerBId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm tracking-[0.2em] uppercase text-white/30 mb-1.5">Player B</label>
              <select
                value={playerBId}
                onChange={e => { setPlayerBId(e.target.value); setNoShots(false) }}
                className="w-full bg-[#0f2418] border border-[#1e3d28] text-white px-4 py-3 rounded-sm appearance-none focus:outline-none focus:border-[#C9A84C] text-sm"
              >
                <option value="">Select player…</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === playerAId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {playerA && playerB ? (
            <MatchplaySection
              playerA={playerA}
              playerB={playerB}
              rounds={rounds}
              holes={holes}
              scores={scores}
              noShots={noShots}
              onToggleNoShots={() => setNoShots(v => !v)}
            />
          ) : (
            <div className="border border-[#1e3d28] bg-[#0f2418] rounded-sm px-4 py-10 text-center text-white/20 text-sm">
              Select two players to view matchplay
            </div>
          )}
        </section>

      </div>

      {/* Scorecard modal */}
      {modal && modalPlayer && (
        <ScorecardModal
          player={modalPlayer}
          rounds={rounds}
          holes={holes}
          scores={scores}
          roundHandicaps={roundHandicaps}
          tees={tees}
          compositeHoles={compositeHoles}
          initialRoundIdx={modal.roundIdx}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
