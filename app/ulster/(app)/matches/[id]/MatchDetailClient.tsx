"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { updateMatchStatus, upsertUlsterScore, setConcededHole } from "../actions"

// ─── Types ───────────────────────────────────────────────────────────────────

type Tee = {
  tee_name: string
  course_rating: number
  slope_rating: number
  par_total: number
  pars: number[]
  yardages: number[]
  stroke_index: number[]
}

type Match = {
  id: string
  name: string | null
  match_date: string
  format: string
  status: "pending" | "live" | "complete"
  hcp_allowance: number
  team_a_players: string[]
  team_b_players: string[]
  conceded_holes: Record<string, "a" | "b" | "halved">
  ulster_courses: { name: string; slug: string }
  ulster_course_tees: Tee
}

type UlsterPlayer = {
  id: string
  handicap_index: number
  players: { id: string; name: string }
}

type Score = { player_id: string; hole: number; gross: number }

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function calcPlayingHandicap(
  hi: number,
  slope: number,
  cr: number,
  par: number,
  allowance: number
) {
  const courseHcp = Math.round(hi * (slope / 113) + (cr - par))
  return Math.round((courseHcp * allowance) / 100)
}

function strokesReceived(si: number, playingHcp: number, nHoles: number) {
  const full = Math.floor(playingHcp / nHoles)
  const rem = playingHcp % nHoles
  return full + (si <= rem ? 1 : 0)
}

function calcStableford(
  gross: number,
  par: number,
  si: number,
  playingHcp: number,
  nHoles: number
) {
  const sr = strokesReceived(si, playingHcp, nHoles)
  return Math.max(0, par + 2 - (gross - sr))
}

function teamBestStableford(
  players: UlsterPlayer[],
  hcps: number[],
  localScores: Record<string, Record<number, number | null>>,
  hole: number,
  par: number,
  si: number,
  nHoles: number
): number | null {
  const pts = players
    .map((p, i) => {
      const gross = localScores[p.id]?.[hole] ?? null
      if (gross == null) return null
      return calcStableford(gross, par, si, hcps[i], nHoles)
    })
    .filter((x): x is number => x !== null)
  return pts.length ? Math.max(...pts) : null
}

function resolveHole(
  result: "a" | "b" | "halved" | null,
  concede: "a" | "b" | "halved" | undefined
): "a" | "b" | "halved" | null {
  if (concede === "a") return "b" // A conceded → B wins
  if (concede === "b") return "a" // B conceded → A wins
  if (concede === "halved") return "halved"
  return result
}

type MatchStatusResult = {
  holesDecided: number
  remaining: number
  lead: number // positive = A leads
  decided: boolean
  winner: "a" | "b" | null
  upBy: number
  dormy: boolean
}

function calcMatchStatus(
  holeResults: ("a" | "b" | "halved" | null)[],
  nHoles: number
): MatchStatusResult {
  let aWins = 0
  let bWins = 0
  let holesDecided = 0
  for (const r of holeResults) {
    if (r === "a") { aWins++; holesDecided++ }
    else if (r === "b") { bWins++; holesDecided++ }
    else if (r === "halved") { holesDecided++ }
  }
  const lead = aWins - bWins
  const remaining = nHoles - holesDecided
  const upBy = Math.abs(lead)
  const decided = upBy > remaining
  const winner: "a" | "b" | null = decided ? (lead > 0 ? "a" : "b") : null
  const dormy = !decided && remaining > 0 && upBy === remaining
  return { holesDecided, remaining, lead, decided, winner, upBy, dormy }
}

function formatMatchStatus(s: MatchStatusResult): string {
  const { holesDecided, remaining, lead, decided, winner, upBy, dormy } = s
  if (holesDecided === 0) return "All square"
  if (decided && winner) {
    const label = remaining === 0 ? `${upBy} up` : `${upBy}&${remaining}`
    return `${winner === "a" ? "Team A" : "Team B"} won ${label}`
  }
  if (dormy) return `${lead > 0 ? "Team A" : "Team B"} dormy ${upBy}`
  if (lead === 0) return `All square thru ${holesDecided}`
  return `${lead > 0 ? "Team A" : "Team B"} ${upBy} up thru ${holesDecided}`
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TEAM_A = "#60a5fa"
const TEAM_B = "#f87171"

const FORMAT_LABELS: Record<string, string> = {
  "4bbb_matchplay": "4BBB Matchplay",
  "strokeplay_cumulative": "Strokeplay",
  "bbb_agg": "BBB Agg",
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MatchDetailClient({
  match,
  ulsterPlayers,
  scores: initialScores,
}: {
  match: Match
  ulsterPlayers: UlsterPlayer[]
  scores: Score[]
}) {
  const router = useRouter()
  const tee = match.ulster_course_tees
  const nHoles = tee.pars.length

  const playerMap = new Map(ulsterPlayers.map(p => [p.id, p]))
  const aPlayers = match.team_a_players.map(id => playerMap.get(id)).filter((p): p is UlsterPlayer => !!p)
  const bPlayers = match.team_b_players.map(id => playerMap.get(id)).filter((p): p is UlsterPlayer => !!p)

  const aHcps = aPlayers.map(p =>
    calcPlayingHandicap(p.handicap_index, tee.slope_rating, tee.course_rating, tee.par_total, match.hcp_allowance)
  )
  const bHcps = bPlayers.map(p =>
    calcPlayingHandicap(p.handicap_index, tee.slope_rating, tee.course_rating, tee.par_total, match.hcp_allowance)
  )

  const [localScores, setLocalScores] = useState<Record<string, Record<number, number | null>>>(() => {
    const s: Record<string, Record<number, number | null>> = {}
    initialScores.forEach(({ player_id, hole, gross }) => {
      if (!s[player_id]) s[player_id] = {}
      s[player_id][hole] = gross
    })
    return s
  })

  const [concededHoles, setConcededHoles] = useState<Record<string, "a" | "b" | "halved">>(
    match.conceded_holes ?? {}
  )

  const holeResults = tee.pars.map((par, i) => {
    const hole = i + 1
    const concede = concededHoles[String(hole)]
    const aScore = teamBestStableford(aPlayers, aHcps, localScores, hole, par, tee.stroke_index[i], nHoles)
    const bScore = teamBestStableford(bPlayers, bHcps, localScores, hole, par, tee.stroke_index[i], nHoles)
    const raw =
      aScore !== null && bScore !== null
        ? aScore > bScore ? "a" : bScore > aScore ? "b" : "halved"
        : null
    return resolveHole(raw, concede)
  })

  const matchStatus = calcMatchStatus(holeResults, nHoles)

  const firstIncomplete = holeResults.findIndex(r => r === null)
  const [currentHole, setCurrentHole] = useState(
    firstIncomplete >= 0 ? firstIncomplete + 1 : nHoles
  )

  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  const holeIdx = currentHole - 1
  const par = tee.pars[holeIdx]
  const si = tee.stroke_index[holeIdx]
  const yardage = tee.yardages[holeIdx]
  const concededVal = concededHoles[String(currentHole)] ?? null

  const handleScoreChange = (playerId: string, val: string) => {
    const gross = val === "" ? null : parseInt(val, 10)
    if (val !== "" && (isNaN(gross!) || gross! < 1)) return
    setLocalScores(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [currentHole]: gross },
    }))
  }

  const handleScoreBlur = useCallback(
    async (playerId: string, val: string) => {
      const gross = val === "" ? null : parseInt(val, 10)
      if (val !== "" && (isNaN(gross!) || gross! < 1)) return
      setSaving(true)
      await upsertUlsterScore(match.id, playerId, currentHole, gross ?? null)
      setSaving(false)
      router.refresh()
    },
    [match.id, currentHole, router]
  )

  const handleConcede = async (val: "a" | "b" | "halved") => {
    const next = val === concededVal ? null : val
    setConcededHoles(prev => {
      const n = { ...prev }
      if (next === null) delete n[String(currentHole)]
      else n[String(currentHole)] = next
      return n
    })
    await setConcededHole(match.id, currentHole, next)
    router.refresh()
  }

  const handleStatusChange = async (newStatus: "pending" | "live" | "complete") => {
    setStatusChanging(true)
    await updateMatchStatus(match.id, newStatus)
    setStatusChanging(false)
    router.refresh()
  }

  // Live hole result for current hole
  const liveHoleResult = (() => {
    const concede = concededHoles[String(currentHole)]
    const aScore = teamBestStableford(aPlayers, aHcps, localScores, currentHole, par, si, nHoles)
    const bScore = teamBestStableford(bPlayers, bHcps, localScores, currentHole, par, si, nHoles)
    const raw =
      aScore !== null && bScore !== null
        ? aScore > bScore ? "a" : bScore > aScore ? "b" : "halved"
        : null
    return resolveHole(raw, concede)
  })()

  const courseName = match.ulster_courses?.name ?? ""
  const shortCourse = courseName.includes("Portstewart")
    ? "Portstewart"
    : courseName.includes("Portrush")
    ? "Portrush"
    : courseName

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-white leading-tight">
            {match.name ?? "Match"}
          </h2>
          <span className="shrink-0 text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-[#1e3d28] text-[#C9A84C] border border-[#C9A84C]/20 mt-1">
            {FORMAT_LABELS[match.format] ?? match.format}
          </span>
        </div>
        <p className="text-white/40 text-xs">
          {match.match_date} · {shortCourse} · {tee.tee_name} ·{" "}
          {match.hcp_allowance}% allowance
        </p>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { label: "Team A", players: aPlayers, hcps: aHcps, color: TEAM_A },
            { label: "Team B", players: bPlayers, hcps: bHcps, color: TEAM_B },
          ] as const
        ).map(({ label, players, hcps, color }) => (
          <div
            key={label}
            className="bg-[#0f2418] rounded-xl p-3"
            style={{ border: `1px solid ${color}20` }}
          >
            <p
              className="text-[10px] tracking-[0.2em] uppercase mb-2"
              style={{ color: `${color}99` }}
            >
              {label}
            </p>
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between gap-1 mb-1 last:mb-0">
                <span className="text-white text-sm">{p.players.name}</span>
                <span className="text-white/35 text-xs">CH {hcps[i]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Match status */}
      <div className="bg-[#0f2418] border border-[#1e3d28] rounded-xl px-4 py-3 text-center">
        <p className="font-[family-name:var(--font-playfair)] text-white text-base">
          {formatMatchStatus(matchStatus)}
        </p>
      </div>

      {/* Hole strip */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1.5 min-w-max py-1">
          {tee.pars.map((_, i) => {
            const holeNum = i + 1
            const result = holeResults[i]
            const isCurrent = holeNum === currentHole
            const dotColor =
              result === "a"
                ? TEAM_A
                : result === "b"
                ? TEAM_B
                : result === "halved"
                ? "#6b7280"
                : null
            return (
              <button
                key={holeNum}
                onClick={() => setCurrentHole(holeNum)}
                className="flex flex-col items-center gap-0.5 min-w-[28px]"
              >
                <span
                  className="text-[9px]"
                  style={{ color: isCurrent ? "#C9A84C" : "rgba(255,255,255,0.25)" }}
                >
                  {holeNum}
                </span>
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={
                    dotColor
                      ? { backgroundColor: dotColor + "33", border: `1.5px solid ${dotColor}` }
                      : isCurrent
                      ? { backgroundColor: "transparent", border: "1.5px solid #C9A84C" }
                      : { backgroundColor: "transparent", border: "1.5px solid #374151" }
                  }
                >
                  {isCurrent && !dotColor && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "#C9A84C" }}
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Hole entry card */}
      <div className="bg-[#0f2418] border border-[#1e3d28] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-playfair)] text-2xl text-white">
              Hole {currentHole}
            </span>
            <span className="text-white/40 text-sm">Par {par}</span>
          </div>
          <div className="text-right text-xs text-white/30 leading-relaxed">
            <div>SI {si}</div>
            <div>{yardage}y</div>
          </div>
        </div>

        {/* Score inputs */}
        <div className="flex flex-col gap-3 mb-4">
          {/* Team A players */}
          {aPlayers.map((p, i) => {
            const val = localScores[p.id]?.[currentHole] ?? null
            const sr = strokesReceived(si, aHcps[i], nHoles)
            const stab = val != null ? calcStableford(val, par, si, aHcps[i], nHoles) : null
            return (
              <PlayerScoreRow
                key={p.id}
                name={p.players.name}
                color={TEAM_A}
                strokesReceived={sr}
                gross={val}
                stableford={stab}
                disabled={!!concededVal}
                onChange={v => handleScoreChange(p.id, v)}
                onBlur={v => handleScoreBlur(p.id, v)}
              />
            )
          })}

          <div className="border-t border-[#1e3d28]" />

          {/* Team B players */}
          {bPlayers.map((p, i) => {
            const val = localScores[p.id]?.[currentHole] ?? null
            const sr = strokesReceived(si, bHcps[i], nHoles)
            const stab = val != null ? calcStableford(val, par, si, bHcps[i], nHoles) : null
            return (
              <PlayerScoreRow
                key={p.id}
                name={p.players.name}
                color={TEAM_B}
                strokesReceived={sr}
                gross={val}
                stableford={stab}
                disabled={!!concededVal}
                onChange={v => handleScoreChange(p.id, v)}
                onBlur={v => handleScoreBlur(p.id, v)}
              />
            )
          })}
        </div>

        {/* Live hole result */}
        {liveHoleResult && (
          <div
            className="text-center text-sm py-1.5 rounded-lg mb-4"
            style={{
              backgroundColor:
                liveHoleResult === "a"
                  ? `${TEAM_A}14`
                  : liveHoleResult === "b"
                  ? `${TEAM_B}14`
                  : "#6b728014",
              color:
                liveHoleResult === "a"
                  ? TEAM_A
                  : liveHoleResult === "b"
                  ? TEAM_B
                  : "#9ca3af",
            }}
          >
            {liveHoleResult === "halved"
              ? "Halved"
              : `Team ${liveHoleResult.toUpperCase()} wins hole`}
          </div>
        )}

        {/* Concede toggle */}
        <div>
          <p className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-2">
            Concede hole
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["a", "halved", "b"] as const).map(val => {
              const isActive = concededVal === val
              const activeColor =
                val === "a" ? TEAM_B : val === "b" ? TEAM_A : "#9ca3af"
              return (
                <button
                  key={val}
                  onClick={() => handleConcede(val)}
                  className="py-2.5 rounded-lg text-xs border transition-colors"
                  style={
                    isActive
                      ? {
                          backgroundColor: `${activeColor}20`,
                          borderColor: activeColor,
                          color: activeColor,
                        }
                      : {
                          backgroundColor: "transparent",
                          borderColor: "#1e3d28",
                          color: "rgba(255,255,255,0.3)",
                        }
                  }
                >
                  {val === "a" ? "A concedes" : val === "b" ? "B concedes" : "Halved"}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Prev / Next */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentHole(h => Math.max(1, h - 1))}
          disabled={currentHole === 1}
          className="flex-1 py-3 rounded-xl border border-[#1e3d28] text-white/40 text-sm disabled:opacity-30 hover:border-white/20 transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={() => setCurrentHole(h => Math.min(nHoles, h + 1))}
          disabled={currentHole === nHoles}
          className="flex-1 py-3 rounded-xl border border-[#1e3d28] text-white/40 text-sm disabled:opacity-30 hover:border-white/20 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Match control */}
      {match.status === "pending" && (
        <button
          onClick={() => handleStatusChange("live")}
          disabled={statusChanging}
          className="w-full py-3 rounded-xl bg-[#1e3d28] border border-[#C9A84C]/30 text-[#C9A84C] text-sm tracking-wider uppercase font-[family-name:var(--font-playfair)] hover:border-[#C9A84C]/60 transition-colors disabled:opacity-40"
        >
          Start Match
        </button>
      )}
      {match.status === "live" && (
        <button
          onClick={() => handleStatusChange("complete")}
          disabled={statusChanging}
          className="w-full py-3 rounded-xl bg-[#0f2418] border border-[#C9A84C]/30 text-[#C9A84C] text-sm tracking-wider uppercase font-[family-name:var(--font-playfair)] hover:border-[#C9A84C]/60 transition-colors disabled:opacity-40"
        >
          Finish Match
        </button>
      )}
      {match.status === "complete" && (
        <button
          onClick={() => handleStatusChange("live")}
          disabled={statusChanging}
          className="w-full py-3 rounded-xl bg-transparent border border-[#1e3d28] text-white/30 text-sm tracking-wider uppercase font-[family-name:var(--font-playfair)] hover:border-white/20 transition-colors disabled:opacity-40"
        >
          Reopen Match
        </button>
      )}

      {saving && (
        <p className="fixed bottom-4 right-4 text-xs text-white/40 pointer-events-none">
          Saving…
        </p>
      )}
    </div>
  )
}

// ─── PlayerScoreRow ───────────────────────────────────────────────────────────

function PlayerScoreRow({
  name,
  color,
  strokesReceived,
  gross,
  stableford,
  disabled,
  onChange,
  onBlur,
}: {
  name: string
  color: string
  strokesReceived: number
  gross: number | null
  stableford: number | null
  disabled: boolean
  onChange: (val: string) => void
  onBlur: (val: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-white/60">{name}</span>
          {strokesReceived > 0 && (
            <span className="text-[10px] text-white/30">+{strokesReceived}</span>
          )}
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={15}
          value={gross ?? ""}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onBlur(e.target.value)}
          disabled={disabled}
          className="w-full bg-[#0a1a0e] border border-[#1e3d28] rounded-lg px-3 py-3 text-white text-base focus:outline-none disabled:opacity-40"
          style={{ focusBorderColor: color } as React.CSSProperties}
          placeholder="—"
        />
      </div>
      {stableford !== null && (
        <div className="text-right min-w-[40px]">
          <span className="font-[family-name:var(--font-playfair)] text-xl text-white">
            {stableford}
          </span>
          <p className="text-[10px] text-white/25">pts</p>
        </div>
      )}
    </div>
  )
}
