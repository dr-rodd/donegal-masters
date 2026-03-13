"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────

interface Player { id: string; name: string; role: string; handicap: number; gender: string }
interface Course  { id: string; name: string }
interface Tee     { id: string; name: string; gender: string; par: number; course_rating: number; slope: number }
interface Hole    {
  id: string; hole_number: number; par: number; stroke_index: number
  yardage_black?: number; yardage_blue?: number; yardage_white?: number; yardage_red?: number
  yardage_sandstone?: number; yardage_slate?: number; yardage_granite?: number; yardage_claret?: number
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

  const ptsColor =
    isNR         ? "bg-orange-900/40 text-orange-400/70" :
    pts === null ? "bg-transparent text-white/15" :
    pts >= 3     ? "bg-[#C9A84C] text-black" :
    pts === 2    ? "bg-white/10 text-white" :
    pts === 1    ? "bg-white/5 text-white/50" :
                   "bg-red-900/30 text-red-400/70"

  function handleStep(delta: number) {
    if (isNR) return
    if (score === null) {
      onChange(netParGross)
    } else {
      onChange(Math.max(1, Math.min(12, score + delta)))
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (v === "") { onChange(null); return }
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 1 && n <= 12) onChange(n)
  }

  return (
    <div className={`bg-[#0f2418] border rounded-sm px-4 py-4 flex items-center gap-3 transition-colors
      ${isNR ? "border-orange-900/50" : "border-[#1e3d28]"}`}>

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

      {/* Score stepper */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        <button onClick={() => handleStep(-1)} disabled={isNR}
          className="w-14 h-14 rounded-full border border-[#1e3d28] text-white/60 text-4xl leading-none
            hover:border-[#C9A84C] hover:text-[#C9A84C] active:scale-95 transition-all
            flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">−</button>

        {isNR ? (
          <span className="font-[family-name:var(--font-playfair)] text-4xl w-14 h-14 flex items-center justify-center text-white/20">—</span>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score === null ? "" : String(score)}
            onChange={handleInputChange}
            className={`font-[family-name:var(--font-playfair)] text-4xl w-14 h-14 text-center leading-none bg-transparent outline-none text-white caret-[#C9A84C] border rounded-sm transition-colors p-0 align-middle
              ${score === null ? "border-[#C9A84C]/50" : "border-[#C9A84C]/15"}`}
            style={{ lineHeight: '3.5rem' }}
          />
        )}

        <button onClick={() => handleStep(1)} disabled={isNR}
          className="w-14 h-14 rounded-full border border-[#1e3d28] text-white/60 text-4xl leading-none
            hover:border-[#C9A84C] hover:text-[#C9A84C] active:scale-95 transition-all
            flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">+</button>

        <button onClick={onToggleNR}
          className={`text-xs tracking-widest uppercase border px-2 py-1.5 rounded-sm transition-colors flex-shrink-0
            ${isNR
              ? "border-orange-400/60 text-orange-400 bg-orange-900/20"
              : "border-white/15 text-white/30 hover:border-orange-400/40 hover:text-orange-400/60"}`}>
          NR
        </button>
      </div>

      {/* Stableford badge */}
      <div className={`w-9 h-9 rounded-sm flex flex-col items-center justify-center flex-shrink-0 ${ptsColor}`}>
        <span className="text-base font-bold leading-none">{pts ?? "·"}</span>
        <span className="text-[10px] opacity-60 leading-none mt-0.5">{pts !== null || isNR ? "pts" : ""}</span>
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
  const [error, setError]       = useState<string | null>(null)

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
        .select("id, hole_number, par, stroke_index, yardage_black, yardage_blue, yardage_white, yardage_red, yardage_sandstone, yardage_slate, yardage_granite, yardage_claret")
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

    setRoundId(roundData?.id ?? "")
    setHoles(holeData)
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
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
        <div className="text-5xl">⛳</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white">Scores Saved</h2>
        <p className="text-white/50 text-sm">
          {player?.name} · {course?.name} · {selectedTee?.name} tee · {totalPts} pts{hasAnyNR ? " (NR)" : ""}
        </p>
        <button
          onClick={() => { setPhase("selecting"); setPlayerId(""); setCourseId(""); setTeeId(""); setRoundId("") }}
          className="mt-4 px-8 py-3 border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          Enter Another Score
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">

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
          <div className="sticky top-[57px] z-10 bg-[#0a1a0e] border border-[#1e3d28] rounded-sm px-4 py-3 mb-4 flex items-center justify-between">
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
