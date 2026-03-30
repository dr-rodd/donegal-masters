"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────

interface Player { id: string; name: string; role: string; handicap: number; gender: string }
interface Course  { id: string; name: string }
interface Tee     { id: string; name: string; gender: string; par: number; course_rating: number; slope: number }
interface Hole    {
  id: string; hole_number: number; par: number; stroke_index: number
  par_ladies?: number; stroke_index_ladies?: number
  yardage_black?: number; yardage_blue?: number; yardage_white?: number; yardage_red?: number
  yardage_sandstone?: number; yardage_slate?: number; yardage_granite?: number; yardage_claret?: number
}

const ST_PATRICKS_COURSE_ID = '11111111-0000-0000-0000-000000000003'

interface SubmittedSnapshot {
  playerName: string
  courseName: string
  teeName: string
  playingHcp: number
  holes: Hole[]
  scores: (number | null)[]
  nrs: boolean[]
  yardages: Record<string, number>
  submittedAt: Date
}

type Phase = "selecting" | "entering" | "submitting" | "done"

// ─── Helpers ──────────────────────────────────────────────

/** WHS playing handicap formula */
function calcPlayingHandicap(hcpIndex: number, slope: number, courseRating: number, par: number): number {
  return Math.round(hcpIndex * (slope / 113) + (courseRating - par))
}

function shotsReceived(si: number, playingHcp: number): number {
  return Math.floor(playingHcp / 18) + (si <= playingHcp % 18 ? 1 : 0)
}

function calcStableford(gross: number, par: number, si: number, playingHcp: number): number {
  return Math.max(0, par + 2 - (gross - shotsReceived(si, playingHcp)))
}

function nrGross(par: number, si: number, playingHcp: number): number {
  return par + 2 + shotsReceived(si, playingHcp)
}

function scoreToPar(gross: number, par: number) {
  const diff = gross - par
  if (diff <= -2) return { label: "Eagle",  color: "text-emerald-400" }
  if (diff === -1) return { label: "Birdie", color: "text-[#C9A84C]" }
  if (diff === 0)  return { label: "Par",    color: "text-white/60" }
  if (diff === 1)  return { label: "Bogey",  color: "text-orange-400/70" }
  return { label: `+${diff}`, color: "text-red-400/70" }
}

// ─── Tee colour map ───────────────────────────────────────

const TEE_STYLES: Record<string, { dot: string; active: string; text: string }> = {
  Black:     { dot: "bg-zinc-300",      active: "border-zinc-300 text-zinc-200",      text: "text-zinc-300" },
  Blue:      { dot: "bg-blue-400",      active: "border-blue-400 text-blue-300",      text: "text-blue-400" },
  White:     { dot: "bg-white",         active: "border-white text-white",             text: "text-white" },
  Red:       { dot: "bg-red-500",       active: "border-red-400 text-red-300",         text: "text-red-400" },
  Yellow:    { dot: "bg-yellow-400",    active: "border-yellow-400 text-yellow-300",   text: "text-yellow-400" },
  Sandstone: { dot: "bg-amber-300",     active: "border-amber-300 text-amber-200",     text: "text-amber-300" },
  Slate:     { dot: "bg-slate-400",     active: "border-slate-400 text-slate-300",     text: "text-slate-400" },
  Granite:   { dot: "bg-stone-400",     active: "border-stone-400 text-stone-300",     text: "text-stone-400" },
  Claret:    { dot: "bg-rose-800",      active: "border-rose-700 text-rose-300",       text: "text-rose-400" },
}

function teeStyle(name: string) {
  return TEE_STYLES[name] ?? { dot: "bg-white/40", active: "border-white/40 text-white/60", text: "text-white/60" }
}

// ─── Step dot ─────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border
      ${done   ? "bg-[#C9A84C] border-[#C9A84C] text-black"
      : active ? "border-[#C9A84C] text-[#C9A84C]"
               : "border-white/20 text-white/20"}`}>
      {done ? "✓" : n}
    </div>
  )
}

// ─── Submitted scorecard components ───────────────────────

function ScoreCell({ gross, par, pts }: { gross: number; par: number; pts: number }) {
  const diff = gross - par
  const f = "font-[family-name:var(--font-crimson)] leading-none"
  const ptsColor = pts >= 3 ? "text-[#2d6a4f]" : pts === 0 ? "text-gray-300" : "text-gray-400"

  let shape: React.ReactNode
  if (diff <= -2) {
    shape = (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#C9A84C]">
        <span className={`${f} text-base font-semibold text-[#1a0a00]`}>{gross}</span>
      </span>
    )
  } else if (diff === -1) {
    shape = (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-[#2d6a4f]">
        <span className={`${f} text-base text-[#1a5235]`}>{gross}</span>
      </span>
    )
  } else if (diff === 0) {
    shape = <span className={`${f} text-base text-gray-700`}>{gross}</span>
  } else if (diff === 1) {
    shape = (
      <span className="inline-flex items-center justify-center w-7 h-7 border border-gray-400">
        <span className={`${f} text-sm text-gray-500`}>{gross}</span>
      </span>
    )
  } else {
    shape = (
      <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-300">
        <span className={`${f} text-sm text-gray-600`}>{gross}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-start gap-0.5">
      {shape}
      <sup className={`text-[10px] font-bold leading-none mt-0.5 ${ptsColor}`}>{pts}</sup>
    </span>
  )
}

function SubtotalRow({ label, par, yards, gross, pts, isTotal }: {
  label: string; par: number; yards: number | null; gross: number; pts: number; isTotal?: boolean
}) {
  const crimson = "font-[family-name:var(--font-crimson)]"
  const bg = isTotal ? "bg-[#1a3a22]" : "bg-gray-100"
  const textLabel = isTotal ? "text-white/70" : "text-gray-500"
  const textData = isTotal ? "text-white" : "text-gray-700"
  const textPts = isTotal ? "text-[#C9A84C]" : "text-[#2d6a4f]"
  return (
    <tr className={`border-t-2 ${isTotal ? "border-[#1e3a22]" : "border-gray-200"} ${bg}`}>
      <td className={`py-2 px-3 text-xs uppercase tracking-wider font-semibold ${textLabel} font-[family-name:var(--font-playfair)]`}>{label}</td>
      <td className={`text-center py-2 px-2 text-sm font-semibold ${textData} ${crimson}`}>{par}</td>
      <td className="py-2 px-2" />
      <td className={`text-center py-2 px-2 text-sm ${textData} ${crimson}`}>{yards ?? "—"}</td>
      <td className={`text-center py-2 px-2 ${crimson}`}>
        {gross > 0 ? (
          <>
            <span className={`text-sm font-semibold ${textData}`}>{gross}</span>
            <span className={`text-xs font-bold ml-1.5 ${textPts}`}>{pts}</span>
          </>
        ) : "—"}
      </td>
    </tr>
  )
}

function SubmittedScorecard({ snapshot }: { snapshot: SubmittedSnapshot }) {
  const { playerName, courseName, teeName, playingHcp, holes, scores, nrs, yardages, submittedAt } = snapshot
  const crimson = "font-[family-name:var(--font-crimson)]"
  const front = holes.slice(0, 9)
  const back  = holes.slice(9, 18)

  function holePts(i: number): number {
    if (nrs[i] || scores[i] === null) return 0
    return calcStableford(scores[i]!, holes[i].par, holes[i].stroke_index, playingHcp)
  }
  function holeGrossVal(i: number): number {
    if (nrs[i]) return nrGross(holes[i].par, holes[i].stroke_index, playingHcp)
    return scores[i] ?? 0
  }
  function sumGross(offset: number, len: number) {
    let t = 0; for (let j = 0; j < len; j++) t += holeGrossVal(offset + j); return t
  }
  function sumPts(offset: number, len: number) {
    let t = 0; for (let j = 0; j < len; j++) t += holePts(offset + j); return t
  }
  function sumPar(hs: Hole[])   { return hs.reduce((s, h) => s + h.par, 0) }
  function sumYards(hs: Hole[]) {
    let t = 0
    for (const h of hs) { const y = yardages[h.id]; if (!y) return null; t += y }
    return t
  }

  const outPar = sumPar(front), inPar = sumPar(back)
  const outYards = sumYards(front), inYards = sumYards(back)
  const totalYards = outYards != null && inYards != null ? outYards + inYards : null
  const dateStr = submittedAt.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })

  function HoleRow({ hole, i, stripOdd }: { hole: Hole; i: number; stripOdd: boolean }) {
    const pts  = holePts(i)
    const isNR = nrs[i]
    return (
      <tr className={`border-t border-gray-100 ${stripOdd ? "bg-white" : "bg-gray-50/40"}`}>
        <td className={`py-2.5 px-3 text-sm font-semibold text-gray-700 ${crimson}`}>{hole.hole_number}</td>
        <td className={`text-center py-2.5 px-2 text-sm text-gray-500 ${crimson}`}>{hole.par}</td>
        <td className={`text-center py-2.5 px-2 text-xs text-gray-300 ${crimson}`}>{hole.stroke_index}</td>
        <td className={`text-center py-2.5 px-2 text-xs text-gray-400 ${crimson}`}>{yardages[hole.id] ?? "—"}</td>
        <td className="text-center py-1.5 px-2">
          {isNR
            ? <span className={`text-orange-500 text-sm font-semibold ${crimson}`}>NR</span>
            : scores[i] !== null
              ? <ScoreCell gross={scores[i]!} par={hole.par} pts={pts} />
              : <span className="text-gray-200 text-sm">—</span>
          }
        </td>
      </tr>
    )
  }

  return (
    <div className="mt-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-[#1a3a22] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-[family-name:var(--font-playfair)] text-white text-base">{playerName}</div>
            <div className={`text-[#C9A84C]/50 text-xs mt-0.5 ${crimson}`}>{dateStr}</div>
          </div>
          <div className={`flex items-center gap-3 text-xs ${crimson}`}>
            <span className="text-[#C9A84C]/80 capitalize">{teeName.toLowerCase()} tees</span>
            <span className="text-white/40">hcp {playingHcp}</span>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="text-left   py-2 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide font-[family-name:var(--font-playfair)] w-10">Hole</th>
              <th className="text-center py-2 px-2 text-[11px] font-normal  text-gray-400 uppercase tracking-wide w-9">Par</th>
              <th className="text-center py-2 px-2 text-[11px] font-normal  text-gray-400 uppercase tracking-wide w-9">SI</th>
              <th className="text-center py-2 px-2 text-[11px] font-normal  text-gray-400 uppercase tracking-wide w-12">Yds</th>
              <th className="text-center py-2 px-2 text-[11px] font-normal  text-gray-400 uppercase tracking-wide">Score</th>
            </tr>
          </thead>
          <tbody>
            {front.map((hole, j) => <HoleRow key={hole.id} hole={hole} i={j}   stripOdd={j % 2 === 0} />)}
            <SubtotalRow label="Out"   par={outPar}          yards={outYards}   gross={sumGross(0, 9)} pts={sumPts(0, 9)} />
            {back.map((hole,  j) => <HoleRow key={hole.id} hole={hole} i={9+j} stripOdd={j % 2 === 0} />)}
            <SubtotalRow label="In"    par={inPar}           yards={inYards}    gross={sumGross(9, 9)} pts={sumPts(9, 9)} />
            <SubtotalRow label="Total" par={outPar + inPar}  yards={totalYards} gross={sumGross(0, 18)} pts={sumPts(0, 18)} isTotal />
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Hole card ────────────────────────────────────────────

function HoleCard({
  hole, score, isNR, playingHcp, yardage,
  onChange, onToggleNR,
}: {
  hole: Hole; score: number | null; isNR: boolean; playingHcp: number; yardage?: number
  onChange: (v: number | null) => void
  onToggleNR: () => void
}) {
  const netParGross = hole.par + shotsReceived(hole.stroke_index, playingHcp)
  const hasScore = score !== null

  const pts = isNR ? 0 : hasScore ? calcStableford(score, hole.par, hole.stroke_index, playingHcp) : null
  const { label, color } = isNR
    ? { label: "No Return", color: "text-orange-400/70" }
    : hasScore ? scoreToPar(score, hole.par)
    : { label: "", color: "" }

  // Mobile pts badge (border style)
  const ptsBadgeMobile =
    isNR         ? "border-orange-900/50 bg-orange-900/30 text-orange-400/80" :
    pts === null ? "border-white/10 text-white/15" :
    pts >= 3     ? "border-[#C9A84C] bg-[#C9A84C]/15 text-[#C9A84C]" :
    pts === 2    ? "border-white/20 bg-white/5 text-white" :
    pts === 1    ? "border-white/10 bg-transparent text-white/40" :
                   "border-red-900/40 bg-red-900/20 text-red-400/70"

  // Desktop pts badge (filled square, original style)
  const ptsBadgeDesktop =
    isNR         ? "bg-orange-900/40 text-orange-400/70" :
    pts === null ? "bg-transparent text-white/15" :
    pts >= 3     ? "bg-[#C9A84C] text-black" :
    pts === 2    ? "bg-white/10 text-white" :
    pts === 1    ? "bg-white/5 text-white/50" :
                   "bg-red-900/30 text-red-400/70"

  function handleStep(delta: number) {
    if (isNR) return
    if (score === null) onChange(netParGross)
    else onChange(Math.max(1, Math.min(12, score + delta)))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (v === "") { onChange(null); return }
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 1 && n <= 12) onChange(n)
  }

  // Shared sub-components rendered in both layouts
  const nrButton = (extra: string) => (
    <button
      onClick={onToggleNR}
      className={`text-xs tracking-widest uppercase border rounded-sm transition-colors ${extra}
        ${isNR
          ? "border-orange-400/60 text-orange-400 bg-orange-900/20"
          : "border-white/15 text-white/30 hover:border-orange-400/40 hover:text-orange-400/60"}`}>
      NR
    </button>
  )

  const scoreInput = (cls: string, lineH: string) => isNR ? (
    <span className={`font-[family-name:var(--font-playfair)] text-4xl flex items-center justify-center text-white/20 ${cls}`}>
      —
    </span>
  ) : (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={score === null ? "" : String(score)}
      onChange={handleInputChange}
      className={`font-[family-name:var(--font-playfair)] text-4xl text-center bg-transparent
        outline-none text-white caret-[#C9A84C] border rounded-sm transition-colors p-0
        ${score === null ? "border-[#C9A84C]/50" : "border-[#C9A84C]/15"} ${cls}`}
      style={{ lineHeight: lineH }}
    />
  )

  return (
    <div className={`bg-[#0f2418] border rounded-sm transition-colors
      ${isNR ? "border-orange-900/50" : "border-[#1e3d28]"}`}>

      {/* ══ MOBILE LAYOUT — single column, 3 rows (hidden at sm+) ══ */}
      <div className="sm:hidden">

        {/* Row 1: hole info + NR toggle */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-playfair)] text-3xl text-white leading-none w-8">
              {hole.hole_number}
            </span>
            <span className="text-white/50 text-sm">
              Par <span className="text-white font-semibold">{hole.par}</span>
            </span>
            <span className="text-white/30 text-sm">SI {hole.stroke_index}</span>
            {yardage && <span className="text-white/25 text-xs">{yardage} yds</span>}
          </div>
          {nrButton("px-3 py-1.5")}
        </div>

        {/* Row 2: score stepper — buttons flex to fill width */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <button onClick={() => handleStep(-1)} disabled={isNR}
            className="flex-1 h-16 rounded-sm border border-[#1e3d28] text-white/60 text-4xl leading-none
              hover:border-[#C9A84C] hover:text-[#C9A84C] active:scale-95 transition-all
              flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">
            −
          </button>
          {scoreInput("w-20 h-16", "4rem")}
          <button onClick={() => handleStep(1)} disabled={isNR}
            className="flex-1 h-16 rounded-sm border border-[#1e3d28] text-white/60 text-4xl leading-none
              hover:border-[#C9A84C] hover:text-[#C9A84C] active:scale-95 transition-all
              flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">
            +
          </button>
        </div>

        {/* Row 3: score label + stableford pts */}
        <div className="flex items-center justify-between px-4 pb-4">
          <span className={`text-sm font-semibold ${color || "text-white/15"}`}>
            {label || "—"}
          </span>
          <div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-sm border ${ptsBadgeMobile}`}>
            <span className="text-xl font-bold leading-none font-[family-name:var(--font-playfair)]">
              {pts ?? "·"}
            </span>
            <span className="text-xs opacity-60 leading-none">pts</span>
          </div>
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT — single horizontal row (hidden below sm) ══ */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-4">

        {/* Hole badge */}
        <div className="flex flex-col items-center justify-center w-9 flex-shrink-0">
          <span className="font-[family-name:var(--font-playfair)] text-2xl text-white leading-none">
            {hole.hole_number}
          </span>
          <span className="text-white/20 text-[10px] uppercase tracking-widest mt-0.5">hole</span>
        </div>

        {/* Hole info */}
        <div className="flex flex-col gap-0.5 w-16 flex-shrink-0">
          <span className="text-white/60 text-sm">Par <span className="text-white font-semibold">{hole.par}</span></span>
          <span className="text-white/50 text-xs">SI {hole.stroke_index}</span>
          {yardage && <span className="text-white/50 text-xs">{yardage} yds</span>}
          {label && label !== "Par" && (
            <span className={`text-xs font-semibold mt-0.5 ${color}`}>{label}</span>
          )}
        </div>

        {/* Score stepper + NR */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button onClick={() => handleStep(-1)} disabled={isNR}
            className="w-14 h-14 rounded-full border border-[#1e3d28] text-white/60 text-4xl leading-none
              hover:border-[#C9A84C] hover:text-[#C9A84C] active:scale-95 transition-all
              flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">
            −
          </button>
          {scoreInput("w-14 h-14", "3.5rem")}
          <button onClick={() => handleStep(1)} disabled={isNR}
            className="w-14 h-14 rounded-full border border-[#1e3d28] text-white/60 text-4xl leading-none
              hover:border-[#C9A84C] hover:text-[#C9A84C] active:scale-95 transition-all
              flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">
            +
          </button>
          {nrButton("px-2 py-1.5 flex-shrink-0")}
        </div>

        {/* Stableford badge */}
        <div className={`w-9 h-9 rounded-sm flex flex-col items-center justify-center flex-shrink-0 ${ptsBadgeDesktop}`}>
          <span className="text-base font-bold leading-none">{pts ?? "·"}</span>
          <span className="text-[10px] opacity-60 leading-none mt-0.5">{pts !== null || isNR ? "pts" : ""}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────

export default function ScoreEntryForm({ players, courses }: { players: Player[]; courses: Course[] }) {
  const [phase, setPhase]       = useState<Phase>("selecting")
  const [playerId, setPlayerId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [teeId, setTeeId]       = useState("")
  const [tees, setTees]         = useState<Tee[]>([])
  const [roundId, setRoundId]   = useState("")
  const [holes, setHoles]       = useState<Hole[]>([])
  const [scores, setScores]     = useState<(number | null)[]>([])
  const [nrs, setNRs]           = useState<boolean[]>([])
  const [yardages, setYardages] = useState<Record<string, number>>({})
  const [error, setError]           = useState<string | null>(null)
  const [snapshot, setSnapshot]     = useState<SubmittedSnapshot | null>(null)

  const player      = players.find(p => p.id === playerId)
  const course      = courses.find(c => c.id === courseId)
  const selectedTee = tees.find(t => t.id === teeId)

  const playerGender = player?.gender ?? null
  const filteredTees = playerGender ? tees.filter(t => t.gender === playerGender) : tees

  const playingHcp = selectedTee && player
    ? calcPlayingHandicap(player.handicap, selectedTee.slope, selectedTee.course_rating, selectedTee.par)
    : Math.round(player?.handicap ?? 0)

  // Fetch tees when course or player changes, auto-default by role
  useEffect(() => {
    if (!courseId) { setTees([]); setTeeId(""); return }

    supabase
      .from("tees")
      .select("id, name, gender, par, course_rating, slope")
      .eq("course_id", courseId)
      .order("slope", { ascending: false }) // hardest → easiest
      .then(({ data }) => {
        const list = data ?? []
        setTees(list)
        if (!list.length) return

        setTeeId("")
      })
  }, [courseId, playerId])

  // ── Step 1 → Step 2 ──────────────────────────────────────
  async function handleStart() {
    if (!playerId || !courseId || !teeId) return
    setError(null)

    const [{ data: holeData, error: holesError }, { data: roundData }] = await Promise.all([
      supabase
        .from("holes")
        .select("id, hole_number, par, stroke_index, par_ladies, stroke_index_ladies, yardage_black, yardage_blue, yardage_white, yardage_red, yardage_sandstone, yardage_slate, yardage_granite, yardage_claret")
        .eq("course_id", courseId)
        .order("hole_number"),
      supabase.from("rounds").select("id").eq("course_id", courseId).single(),
    ])

    if (holesError || !holeData?.length) {
      setError("Could not load holes for this course.")
      return
    }

    const teeCol = `yardage_${selectedTee?.name.toLowerCase()}` as keyof Hole
    const yardageMap: Record<string, number> = {}
    for (const h of holeData) {
      const y = h[teeCol as keyof typeof h] as number | undefined
      if (y) yardageMap[h.id] = y
    }

    // Use ladies par/stroke_index for female players on St Patrick's course
    const isLadies = player?.gender === 'F' && courseId === ST_PATRICKS_COURSE_ID
    const resolvedHoles = isLadies
      ? holeData.map(h => ({
          ...h,
          par:          h.par_ladies          ?? h.par,
          stroke_index: h.stroke_index_ladies ?? h.stroke_index,
        }))
      : holeData

    setRoundId(roundData?.id ?? "")
    setHoles(resolvedHoles)
    setYardages(yardageMap)
    setScores(holeData.map(() => null))
    setNRs(holeData.map(() => false))
    setPhase("entering")
  }

  function toggleNR(i: number) {
    setNRs(prev => prev.map((v, j) => j === i ? !v : v))
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!player || !roundId) return
    setPhase("submitting")
    setError(null)

    await supabase.from("round_handicaps").upsert(
      { round_id: roundId, player_id: playerId, playing_handicap: playingHcp, tee_id: teeId || null },
      { onConflict: "round_id,player_id" }
    )

    const rows = holes.map((hole, i) => ({
      round_id:    roundId,
      player_id:   playerId,
      hole_id:     hole.id,
      gross_score: nrs[i] ? nrGross(hole.par, hole.stroke_index, playingHcp)
                           : (scores[i] ?? hole.par + shotsReceived(hole.stroke_index, playingHcp)),
      no_return:   nrs[i],
    }))

    const { error } = await supabase
      .from("scores")
      .upsert(rows, { onConflict: "round_id,player_id,hole_id" })

    if (error) { setError(error.message); setPhase("entering"); return }

    setSnapshot({
      playerName:  player.name,
      courseName:  course?.name ?? "",
      teeName:     selectedTee?.name ?? "",
      playingHcp,
      holes:       [...holes],
      scores:      [...scores],
      nrs:         [...nrs],
      yardages:    { ...yardages },
      submittedAt: new Date(),
    })
    setPhase("done")
  }

  // ── Running totals ────────────────────────────────────────
  const hasAnyNR = nrs.some(Boolean)

  const totalGross = holes.reduce((sum, h, i) => {
    if (nrs[i]) return sum + nrGross(h.par, h.stroke_index, playingHcp)
    return scores[i] !== null ? sum + scores[i]! : sum
  }, 0)

  const totalPts = holes.reduce((sum, h, i) => {
    if (nrs[i] || scores[i] === null) return sum
    return sum + calcStableford(scores[i]!, h.par, h.stroke_index, playingHcp)
  }, 0)

  // ── Render ────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="flex flex-col items-center gap-6 text-center pt-16 pb-8">
          <div className="text-5xl">⛳</div>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white">Scores Saved</h2>
          <p className="text-white/50 text-sm">
            {snapshot?.playerName} · {snapshot?.courseName} · {snapshot?.teeName} tee · {totalPts} pts{hasAnyNR ? " (NR)" : ""}
          </p>
          <button
            onClick={() => { setPhase("selecting"); setPlayerId(""); setCourseId(""); setTeeId(""); setRoundId("") }}
            className="px-8 py-3 border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
            Enter Another Score
          </button>
        </div>
        {snapshot && <SubmittedScorecard snapshot={snapshot} />}
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 pb-16">

      {/* Progress steps */}
      <div className="flex items-center gap-2 py-6">
        <StepDot n={1} active={phase === "selecting"} done={phase !== "selecting"} />
        <div className="h-px flex-1 bg-[#1e3d28]" />
        <StepDot n={2} active={phase === "entering" || phase === "submitting"} done={false} />
      </div>

      {/* ── Step 1 ── */}
      {phase === "selecting" && (
        <div className="space-y-5">

          {/* Player */}
          <div>
            <label className="block text-sm tracking-[0.2em] uppercase text-white/40 mb-2">Player</label>
            <select value={playerId} onChange={e => setPlayerId(e.target.value)}
              className="w-full bg-[#0f2418] border border-[#1e3d28] text-white px-4 py-3 rounded-sm appearance-none focus:outline-none focus:border-[#C9A84C] text-sm">
              <option value="">Select a player…</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.handicap})</option>
              ))}
            </select>
          </div>

          {/* Course */}
          <div>
            <label className="block text-sm tracking-[0.2em] uppercase text-white/40 mb-2">Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full bg-[#0f2418] border border-[#1e3d28] text-white px-4 py-3 rounded-sm appearance-none focus:outline-none focus:border-[#C9A84C] text-sm">
              <option value="">Select a course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Tee selector — shown once course is chosen */}
          {filteredTees.length > 0 && (
            <div>
              <label className="block text-sm tracking-[0.2em] uppercase text-white/40 mb-2">Tee</label>
              <div className="flex gap-2 flex-wrap">
                {filteredTees.map(tee => {
                  const s = teeStyle(tee.name)
                  const active = tee.id === teeId
                  return (
                    <button
                      key={tee.id}
                      onClick={() => setTeeId(tee.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 border rounded-sm text-sm transition-colors
                        ${active ? s.active + " bg-white/5" : "border-[#1e3d28] text-white/40 hover:border-white/30"}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                      <span>{tee.name}</span>
                    </button>
                  )
                })}
              </div>

              {/* Playing handicap preview */}
              {selectedTee && player && (
                <div className="mt-3 flex items-center gap-2 text-sm text-white/40">
                  <span>Playing handicap:</span>
                  <span className="text-[#C9A84C] font-semibold">{playingHcp}</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button onClick={handleStart} disabled={!playerId || !courseId || !teeId}
            className="w-full py-4 border border-[#C9A84C] text-[#C9A84C] text-sm tracking-[0.25em] uppercase
              hover:bg-[#C9A84C] hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-2">
            Start Scorecard →
          </button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {(phase === "entering" || phase === "submitting") && (
        <>
          {/* Sticky header */}
          <div className="sticky top-[61px] z-10 bg-[#0a1a0e] border border-[#1e3d28] rounded-sm px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-base">{player?.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-white/40 text-sm">{course?.name}</p>
                {selectedTee && (
                  <span className={`flex items-center gap-1 text-sm ${teeStyle(selectedTee.name).text}`}>
                    <span className={`w-2 h-2 rounded-full ${teeStyle(selectedTee.name).dot}`} />
                    {selectedTee.name} · PH {playingHcp}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Gross</p>
                <p className="font-[family-name:var(--font-playfair)] text-lg text-white flex items-baseline gap-1">
                  {totalGross}
                  {hasAnyNR && <span className="text-[10px] text-orange-400/70 border border-orange-400/30 px-1 rounded-sm">NR</span>}
                </p>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Pts</p>
                <p className="font-[family-name:var(--font-playfair)] text-lg text-[#C9A84C]">{totalPts}</p>
              </div>
            </div>
          </div>

          {/* Hole cards */}
          <div className="space-y-2">
            {holes.map((hole, i) => (
              <HoleCard
                key={hole.id}
                hole={hole}
                score={scores[i]}
                isNR={nrs[i]}
                playingHcp={playingHcp}
                yardage={yardages[hole.id]}
                onChange={v => setScores(s => s.map((g, j) => j === i ? v : g))}
                onToggleNR={() => toggleNR(i)}
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

          <button onClick={handleSubmit} disabled={phase === "submitting"}
            className="w-full mt-6 py-4 border border-[#C9A84C] text-[#C9A84C] text-sm tracking-[0.25em] uppercase hover:bg-[#C9A84C] hover:text-black transition-colors disabled:opacity-50">
            {phase === "submitting" ? "Saving…" : `Submit Scorecard · ${totalPts} pts`}
          </button>

          <button onClick={() => setPhase("selecting")}
            className="w-full mt-3 py-3 text-white/30 text-sm tracking-[0.2em] uppercase hover:text-white/60 transition-colors">
            ← Back
          </button>
        </>
      )}
    </div>
  )
}
