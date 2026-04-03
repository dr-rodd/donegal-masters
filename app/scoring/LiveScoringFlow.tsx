"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { ActiveLiveRound } from "./ScoringClient"
import LiveLeaderboardPanel from "./LiveLeaderboardPanel"

// ─── Types ────────────────────────────────────────────────

interface Player {
  id: string; name: string; role: string; handicap: number
  gender: string; is_composite: boolean
  teams: { name: string; color: string } | null
}
interface Round {
  id: string; round_number: number; status: string
  courses: { id: string; name: string } | null
}
interface Hole {
  id: string; hole_number: number; par: number; stroke_index: number; course_id: string
  par_ladies?: number; stroke_index_ladies?: number
  yardage_black?: number; yardage_blue?: number; yardage_white?: number; yardage_red?: number
  yardage_sandstone?: number; yardage_slate?: number; yardage_granite?: number; yardage_claret?: number
}
interface Tee {
  id: string; course_id: string; name: string; gender: string
  par: number; course_rating: number; slope: number
}
interface RoundHandicap { round_id: string; player_id: string; playing_handicap: number }
interface HoleScore {
  gross: number | null; fairway: "left" | "fairway" | "right" | null
  putts: number | null; stableford: number | null
}
interface PlayerSetup { player: Player; tee: Tee; playingHcp: number }

interface Props {
  players: Player[]
  rounds: Round[]
  holes: Hole[]
  tees: Tee[]
  roundHandicaps: RoundHandicap[]
  activeLiveRound: ActiveLiveRound | null
  onBack: () => void
  onLiveRoundChange: (r: ActiveLiveRound | null) => void
  showLeaderboard: boolean
  onLeaderboardChange: (v: boolean) => void
}

type LiveStep = "activate" | "mode" | "setup" | "holes" | "confirm" | "committed"
type Mode = "solo" | "group"

// ─── Constants ────────────────────────────────────────────

const ST_PATRICKS_COURSE_ID = "11111111-0000-0000-0000-000000000003"

const TEE_STYLES: Record<string, { dot: string; active: string }> = {
  Black:     { dot: "bg-zinc-300",   active: "border-zinc-300 text-zinc-200" },
  Blue:      { dot: "bg-blue-400",   active: "border-blue-400 text-blue-300" },
  White:     { dot: "bg-white",      active: "border-white text-white" },
  Red:       { dot: "bg-red-500",    active: "border-red-400 text-red-300" },
  Yellow:    { dot: "bg-yellow-400", active: "border-yellow-400 text-yellow-300" },
  Sandstone: { dot: "bg-amber-300",  active: "border-amber-300 text-amber-200" },
  Slate:     { dot: "bg-slate-400",  active: "border-slate-400 text-slate-300" },
  Granite:   { dot: "bg-stone-400",  active: "border-stone-400 text-stone-300" },
  Claret:    { dot: "bg-rose-800",   active: "border-rose-700 text-rose-300" },
}

// ─── Helpers ──────────────────────────────────────────────

function calcPlayingHandicap(hcpIndex: number, slope: number, courseRating: number, par: number) {
  return Math.round(hcpIndex * (slope / 113) + (courseRating - par))
}
function shotsReceived(si: number, hcp: number) {
  return Math.floor(hcp / 18) + (si <= hcp % 18 ? 1 : 0)
}
function calcStableford(gross: number, par: number, si: number, hcp: number) {
  return Math.max(0, par + 2 - (gross - shotsReceived(si, hcp)))
}
function effectivePar(hole: Hole, gender: string, courseId: string) {
  return gender === "F" && courseId === ST_PATRICKS_COURSE_ID && hole.par_ladies
    ? hole.par_ladies : hole.par
}
function effectiveSI(hole: Hole, gender: string, courseId: string) {
  return gender === "F" && courseId === ST_PATRICKS_COURSE_ID && hole.stroke_index_ladies
    ? hole.stroke_index_ladies : hole.stroke_index
}
function yardageForTee(hole: Hole, teeName: string): number | null {
  const key = `yardage_${teeName.toLowerCase()}` as keyof Hole
  return (hole[key] as number | undefined) ?? null
}

// ─── Main component ───────────────────────────────────────

export default function LiveScoringFlow({
  players, rounds, holes, tees, roundHandicaps,
  activeLiveRound, onBack, onLiveRoundChange,
  showLeaderboard, onLeaderboardChange,
}: Props) {
  const [liveRound, setLiveRound] = useState<ActiveLiveRound | null>(activeLiveRound)
  const [step, setStep] = useState<LiveStep>(activeLiveRound ? "mode" : "activate")
  const [mode, setMode] = useState<Mode>("solo")

  // Setup state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [playerTeeIds, setPlayerTeeIds] = useState<Record<string, string>>({})

  // Scoring state
  const [scores, setScores] = useState<Record<number, Record<string, HoleScore>>>({})
  const [holeIdx, setHoleIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closeConfirm, setCloseConfirm] = useState(false)

  // Player locking
  const [lockedPlayerIds, setLockedPlayerIds] = useState<string[]>([])

  // Swipe gesture tracking
  const touchStartX = useRef<number | null>(null)

  // Activate step state
  const [activatingRoundId, setActivatingRoundId] = useState("")

  const availableRounds = rounds.filter(r => r.status === "upcoming" || r.status === "active")

  // Holes for the live round's course
  const courseId = liveRound?.course_id ?? ""
  const roundId = liveRound?.round_id ?? ""
  const courseHoles = courseId
    ? holes.filter(h => h.course_id === courseId).sort((a, b) => a.hole_number - b.hole_number)
    : []

  // Player setups — only for players that have a tee selected
  const playerSetups: PlayerSetup[] = selectedPlayerIds
    .filter(id => playerTeeIds[id])
    .map(id => {
      const player = players.find(p => p.id === id)!
      const tee = tees.find(t => t.id === playerTeeIds[id])!
      const existingHcp = roundHandicaps.find(rh => rh.round_id === roundId && rh.player_id === id)
      const playingHcp = existingHcp?.playing_handicap
        ?? calcPlayingHandicap(player.handicap, tee.slope, tee.course_rating, tee.par)
      return { player, tee, playingHcp }
    })

  const canStart = selectedPlayerIds.length >= 1 &&
    selectedPlayerIds.every(id => !!playerTeeIds[id])

  // Fetch locked players whenever setup step is shown
  useEffect(() => {
    if (step !== "setup" || !liveRound) return
    supabase
      .from("live_player_locks")
      .select("player_id")
      .eq("live_round_id", liveRound.id)
      .then(({ data }) => setLockedPlayerIds(data?.map(r => r.player_id) ?? []))
  }, [step, liveRound?.id])

  async function lockPlayers() {
    if (!liveRound || playerSetups.length === 0) return
    await supabase
      .from("live_player_locks")
      .upsert(
        playerSetups.map(({ player }) => ({ live_round_id: liveRound.id, player_id: player.id })),
        { onConflict: "live_round_id,player_id" }
      )
  }

  async function unlockPlayers() {
    if (!liveRound || playerSetups.length === 0) return
    await supabase
      .from("live_player_locks")
      .delete()
      .eq("live_round_id", liveRound.id)
      .in("player_id", playerSetups.map(({ player }) => player.id))
  }

  function syncLiveRound(r: ActiveLiveRound | null) {
    setLiveRound(r)
    onLiveRoundChange(r)
  }

  function resetFlow() {
    syncLiveRound(null)
    setStep("activate")
    setSelectedPlayerIds([])
    setPlayerTeeIds({})
    setScores({})
    setHoleIdx(0)
    setActivatingRoundId("")
  }

  // ─── Activate ─────────────────────────────────────────────

  async function handleActivate() {
    if (!activatingRoundId) return
    setSaving(true)
    setError(null)
    const round = rounds.find(r => r.id === activatingRoundId)
    if (!round?.courses) { setError("Round has no course"); setSaving(false); return }

    const { data, error: err } = await supabase
      .from("live_rounds")
      .insert({
        course_id: round.courses.id,
        round_id: activatingRoundId,
        status: "active",
      })
      .select("id, course_id, round_id, activated_by, rounds(round_number), courses(name)")
      .single()

    if (err) { setError(err.message); setSaving(false); return }

    syncLiveRound(data as unknown as ActiveLiveRound)
    setSaving(false)
    setStep("mode")
  }

  // ─── Close round ─────────────────────────────────────────

  async function handleCloseRound() {
    if (!liveRound) return
    setSaving(true)
    await supabase
      .from("live_rounds")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", liveRound.id)
    setSaving(false)
    setCloseConfirm(false)
    resetFlow()
    onBack()
  }

  // ─── Commit ───────────────────────────────────────────────

  async function handleCommit() {
    if (!roundId || courseHoles.length === 0) return
    setSaving(true)
    setError(null)
    try {
      // 1. Upsert round_handicaps
      await Promise.all(
        playerSetups.map(({ player, playingHcp }) =>
          supabase.from("round_handicaps").upsert(
            { round_id: roundId, player_id: player.id, playing_handicap: playingHcp },
            { onConflict: "round_id,player_id" }
          )
        )
      )

      // 2. Delete existing scores for these players then insert fresh
      await Promise.all(
        playerSetups.map(({ player }) =>
          supabase.from("scores").delete()
            .eq("player_id", player.id).eq("round_id", roundId)
        )
      )

      // 3. Upsert scores
      const scoreRows: any[] = []
      for (const [hIdxStr, holeScores] of Object.entries(scores)) {
        const hole = courseHoles[Number(hIdxStr)]
        if (!hole) continue
        for (const [playerId, hs] of Object.entries(holeScores)) {
          if (hs.gross === null) continue
          scoreRows.push({ player_id: playerId, hole_id: hole.id, round_id: roundId, gross_score: hs.gross })
        }
      }
      if (scoreRows.length > 0) {
        const { error: scoreErr } = await supabase.from("scores")
          .upsert(scoreRows, { onConflict: "player_id,hole_id,round_id" })
        if (scoreErr) throw scoreErr
      }

      // 4. Mark live_scores committed
      await supabase.from("live_scores")
        .update({ committed: true })
        .in("player_id", playerSetups.map(p => p.player.id))
        .eq("round_id", roundId)

      // 5. Release player locks
      await unlockPlayers()

      setStep("committed")
    } catch (e: any) {
      setError(e?.message ?? "Failed to commit scores")
    } finally {
      setSaving(false)
    }
  }

  // ─── Close confirm overlay ────────────────────────────────

  if (closeConfirm) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 py-12">
        <div className="text-center">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-white mb-2">Close Live Round?</h2>
          <p className="text-white/40 text-sm">This ends the live session. Scores already entered are kept.</p>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={() => setCloseConfirm(false)} className="flex-1 py-3 border border-white/20 text-white/60 text-sm uppercase tracking-wider hover:border-white/40 transition-colors">
            Cancel
          </button>
          <button onClick={handleCloseRound} disabled={saving} className="flex-1 py-3 bg-red-900/60 border border-red-700/50 text-red-300 text-sm uppercase tracking-wider hover:bg-red-900/80 disabled:opacity-50 transition-colors">
            {saving ? "Closing…" : "Close Round"}
          </button>
        </div>
      </div>
    )
  }

  // ─── Leaderboard panel (non-holes steps) ─────────────────

  if (showLeaderboard && liveRound && step !== "holes") {
    return (
      <LiveLeaderboardPanel
        liveRound={liveRound}
        players={players}
        holes={holes}
        roundHandicaps={roundHandicaps}
        onClose={() => onLeaderboardChange(false)}
        showBackButton={true}
      />
    )
  }

  // ─── Activate step ────────────────────────────────────────

  if (step === "activate") {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div className="text-center">
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase mb-2">No live round active</p>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white">Start Live Round</h2>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-white/50 text-xs tracking-[0.15em] uppercase">Select Round</label>
          {availableRounds.length === 0 ? (
            <p className="text-white/30 text-sm">No rounds available. Rounds must be upcoming or active.</p>
          ) : (
            availableRounds.map(r => (
              <button
                key={r.id}
                onClick={() => setActivatingRoundId(r.id)}
                className={`w-full text-left px-4 py-3 border text-sm transition-colors
                  ${activatingRoundId === r.id
                    ? "border-green-500 text-green-400 bg-green-900/20"
                    : "border-white/20 text-white/60 hover:border-white/40"}`}
              >
                Round {r.round_number} — {r.courses?.name}
                <span className={`ml-2 text-xs ${r.status === "active" ? "text-green-400" : "text-white/30"}`}>
                  [{r.status}]
                </span>
              </button>
            ))
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleActivate}
          disabled={!activatingRoundId || saving || availableRounds.length === 0}
          className={`w-full py-4 text-sm tracking-[0.2em] uppercase transition-colors
            ${activatingRoundId && !saving
              ? "bg-green-700 text-white hover:bg-green-600"
              : "bg-white/10 text-white/30 cursor-not-allowed"}`}
        >
          {saving ? "Activating…" : "Activate Live Round →"}
        </button>
      </div>
    )
  }

  // ─── Mode step ────────────────────────────────────────────

  if (step === "mode") {
    const roundDisplay = liveRound
      ? `Round ${liveRound.rounds?.round_number} — ${liveRound.courses?.name}`
      : ""

    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-12 min-h-[calc(100dvh-113px)]">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-xs tracking-[0.2em] uppercase">Live — {roundDisplay}</span>
          </div>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white">How are you playing?</h2>
        </div>

        <button
          onClick={() => { setMode("solo"); setStep("setup") }}
          className="w-full max-w-xs py-5 border border-[#C9A84C]/50 text-[#C9A84C] tracking-[0.2em] uppercase text-sm hover:bg-[#C9A84C]/10 transition-colors"
        >
          Solo
          <div className="text-[10px] text-white/40 normal-case tracking-normal mt-1 font-normal">One player</div>
        </button>

        <button
          onClick={() => { setMode("group"); setStep("setup") }}
          className="w-full max-w-xs py-5 border border-white/20 text-white/60 tracking-[0.2em] uppercase text-sm hover:border-white/40 hover:text-white/80 transition-colors"
        >
          Group
          <div className="text-[10px] text-white/40 normal-case tracking-normal mt-1 font-normal">2–4 players</div>
        </button>

        <button onClick={() => setCloseConfirm(true)} className="text-white/20 text-xs tracking-widest uppercase hover:text-red-400/60 transition-colors mt-4">
          Close Live Round
        </button>
      </div>
    )
  }

  // ─── Setup step ───────────────────────────────────────────

  if (step === "setup") {
    const courseTees = tees.filter(t => t.course_id === courseId)

    function togglePlayer(pid: string) {
      const isSelected = selectedPlayerIds.includes(pid)
      if (mode === "solo") {
        setSelectedPlayerIds([pid])
        setPlayerTeeIds({})
      } else {
        if (isSelected) {
          if (selectedPlayerIds.length > 1) {
            setSelectedPlayerIds(prev => prev.filter(id => id !== pid))
            setPlayerTeeIds(prev => { const n = { ...prev }; delete n[pid]; return n })
          }
        } else if (selectedPlayerIds.length < 4) {
          setSelectedPlayerIds(prev => [...prev, pid])
        }
      }
    }

    function setTeeForPlayer(pid: string, tid: string) {
      setPlayerTeeIds(prev => ({ ...prev, [pid]: tid }))
    }

    return (
      <div className="max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("mode")} className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase">
            ← Back
          </button>
          <span className="text-white/20 text-xs">|</span>
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase">
            {mode === "solo" ? "Solo" : "Group"}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-white/50 text-xs tracking-[0.15em] uppercase">
            {mode === "solo" ? "Select Player" : "Select Players (2–4)"}
          </label>

          {players.map(player => {
            const isSelected = selectedPlayerIds.includes(player.id)
            const isLocked = lockedPlayerIds.includes(player.id)
            const playerCourseTees = courseTees.filter(t => t.gender === player.gender)
            const selectedTeeId = playerTeeIds[player.id] ?? ""
            const selectedTee = tees.find(t => t.id === selectedTeeId)
            const playingHcp = selectedTee
              ? calcPlayingHandicap(player.handicap, selectedTee.slope, selectedTee.course_rating, selectedTee.par)
              : null

            return (
              <div key={player.id}>
                {/* Player toggle */}
                <button
                  onClick={() => !isLocked && togglePlayer(player.id)}
                  disabled={isLocked && !isSelected}
                  className={`w-full flex items-center justify-between px-4 py-3 border text-sm transition-colors
                    ${isLocked && !isSelected
                      ? "border-white/10 text-white/25 cursor-not-allowed bg-white/[0.02]"
                      : isSelected
                        ? "border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10"
                        : "border-white/20 text-white/60 hover:border-white/40"}`}
                >
                  <div className="flex items-center gap-2">
                    {player.teams && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.teams.color }} />
                    )}
                    <span>{player.name}</span>
                    {isLocked && !isSelected && (
                      <span className="text-[10px] text-white/20 tracking-wider uppercase">In session</span>
                    )}
                  </div>
                  <span className="text-xs opacity-50">HCP {player.handicap}</span>
                </button>

                {/* Tee selector — only for selected players */}
                {isSelected && (
                  <div className="bg-[#0d1f14] border-x border-b border-[#C9A84C]/20 px-4 py-3">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {playerCourseTees.length === 0 ? (
                        <span className="text-white/30 text-xs">No tees for this course</span>
                      ) : (
                        playerCourseTees.map(tee => {
                          const style = TEE_STYLES[tee.name] ?? { dot: "bg-white/40", active: "border-white/40 text-white/60" }
                          const isActive = selectedTeeId === tee.id
                          return (
                            <button
                              key={tee.id}
                              onClick={() => setTeeForPlayer(player.id, tee.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs tracking-wider uppercase transition-colors
                                ${isActive ? style.active + " bg-white/5" : "border-white/20 text-white/40 hover:border-white/40"}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                              {tee.name}
                            </button>
                          )
                        })
                      )}
                    </div>
                    {playingHcp !== null && (
                      <p className="text-white/40 text-xs">
                        Playing HC: <span className="text-[#C9A84C] font-semibold">{playingHcp}</span>
                      </p>
                    )}
                    {!selectedTeeId && playerCourseTees.length > 0 && (
                      <p className="text-orange-400/60 text-xs">Select a tee to continue</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={async () => {
            setScores({}); setHoleIdx(0)
            await lockPlayers()
            setStep("holes")
            window.scrollTo({ top: 0, behavior: "instant" })
          }}
          disabled={!canStart}
          className={`w-full py-4 text-sm tracking-[0.2em] uppercase transition-colors
            ${canStart ? "bg-[#C9A84C] text-black hover:bg-[#d4b05a]" : "bg-white/10 text-white/30 cursor-not-allowed"}`}
        >
          Start Round →
        </button>

        <button onClick={() => setCloseConfirm(true)} className="text-center text-white/20 text-xs tracking-widest uppercase hover:text-red-400/60 transition-colors">
          Close Live Round
        </button>
      </div>
    )
  }

  // ─── Hole by hole ─────────────────────────────────────────

  if (step === "holes" && courseHoles.length > 0) {
    const hole = courseHoles[holeIdx]
    const existingHoleScores = scores[holeIdx] ?? {}

    function handleHoleBack() {
      if (holeIdx === 0) { setStep("setup"); return }
      setHoleIdx(holeIdx - 1)
      window.scrollTo({ top: 0, behavior: "instant" })
    }

    async function handleHoleSubmit(holeScores: Record<string, HoleScore>) {
      // Save to live_scores (non-blocking)
      const rows = playerSetups
        .map(({ player, playingHcp }) => {
          const hs = holeScores[player.id]
          if (!hs?.gross) return null
          const p = effectivePar(hole, player.gender, courseId)
          const si = effectiveSI(hole, player.gender, courseId)
          return {
            player_id: player.id, round_id: roundId, hole_number: hole.hole_number,
            gross_score: hs.gross,
            stableford_points: calcStableford(hs.gross, p, si, playingHcp),
            fairway_hit: hs.fairway ?? null, putts: hs.putts ?? null, committed: false,
          }
        }).filter(Boolean)
      if (rows.length > 0) {
        supabase.from("live_scores").upsert(rows as any, { onConflict: "player_id,round_id,hole_number" })
          .then(() => {}) // fire and forget
      }

      const updated: Record<string, HoleScore> = {}
      for (const { player, playingHcp } of playerSetups) {
        const hs = holeScores[player.id]
        const p = effectivePar(hole, player.gender, courseId)
        const si = effectiveSI(hole, player.gender, courseId)
        updated[player.id] = {
          ...hs,
          stableford: hs.gross !== null ? calcStableford(hs.gross, p, si, playingHcp) : null,
        }
      }
      setScores(prev => ({ ...prev, [holeIdx]: updated }))

      if (holeIdx < courseHoles.length - 1) {
        setHoleIdx(holeIdx + 1)
        window.scrollTo({ top: 0, behavior: "instant" })
      } else {
        setStep("confirm")
        window.scrollTo({ top: 0, behavior: "instant" })
      }
    }

    return (
      <div
        className="overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const delta = e.changedTouches[0].clientX - touchStartX.current
          touchStartX.current = null
          if (delta > 60 && !showLeaderboard) { onLeaderboardChange(true); return }
          if (delta < -60 && showLeaderboard) { onLeaderboardChange(false); return }
        }}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ width: "200%", transform: showLeaderboard ? "translateX(0)" : "translateX(-50%)" }}
        >
          {/* Left panel: live leaderboard */}
          <div style={{ width: "50%" }}>
            {liveRound && (
              <LiveLeaderboardPanel
                liveRound={liveRound}
                players={players}
                holes={holes}
                roundHandicaps={roundHandicaps}
              />
            )}
          </div>
          {/* Right panel: hole score entry */}
          <div style={{ width: "50%" }}>
            <HoleCard
              hole={hole}
              holeIdx={holeIdx}
              totalHoles={courseHoles.length}
              playerSetups={playerSetups}
              courseId={courseId}
              existingScores={existingHoleScores}
              onSubmit={handleHoleSubmit}
              onBack={handleHoleBack}
            />
          </div>
        </div>
      </div>
    )
  }

  // ─── Confirm ──────────────────────────────────────────────

  if (step === "confirm") {
    const totals = playerSetups.map(({ player, playingHcp }) => {
      let pts = 0
      for (const [hIdxStr, hs] of Object.entries(scores)) {
        const hole = courseHoles[Number(hIdxStr)]
        if (!hole) continue
        const entry = hs[player.id]
        if (entry?.gross != null) {
          pts += calcStableford(entry.gross,
            effectivePar(hole, player.gender, courseId),
            effectiveSI(hole, player.gender, courseId),
            playingHcp)
        }
      }
      return { player, pts }
    })

    return (
      <div className="max-w-lg mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div className="text-center">
          <div className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase mb-2">Round Complete</div>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white mb-1">Commit to Leaderboard?</h2>
          <p className="text-white/40 text-sm">Saves as official scores. Replaces any previous entry for this round.</p>
        </div>

        <div className="border border-[#1e3d28] divide-y divide-[#1e3d28]">
          {totals.map(({ player, pts }) => (
            <div key={player.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {player.teams && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.teams.color }} />}
                <span className="text-sm text-white/80">{player.name}</span>
              </div>
              <div><span className="text-[#C9A84C] font-bold">{pts}</span><span className="text-white/40 text-xs ml-1">pts</span></div>
            </div>
          ))}
          <div className="px-4 py-2 text-xs text-white/30">{Object.keys(scores).length}/{courseHoles.length} holes entered</div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div className="flex gap-3">
          <button onClick={() => { setStep("holes"); setHoleIdx(courseHoles.length - 1) }}
            className="flex-1 py-4 border border-white/20 text-white/60 text-sm tracking-[0.15em] uppercase hover:border-white/40 transition-colors">
            ← Review
          </button>
          <button onClick={handleCommit} disabled={saving}
            className="flex-[2] py-4 bg-[#C9A84C] text-black text-sm tracking-[0.2em] uppercase font-bold hover:bg-[#d4b05a] disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Commit Scores"}
          </button>
        </div>
      </div>
    )
  }

  // ─── Committed ────────────────────────────────────────────

  if (step === "committed") {
    return (
      <div className="flex flex-col items-center justify-center px-6 gap-6 text-center min-h-[calc(100dvh-113px)]">
        <div className="w-16 h-16 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] text-3xl">✓</div>
        <div>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white mb-2">Scores Committed</h2>
          <p className="text-white/40 text-sm">Saved to the official leaderboard.</p>
        </div>
        <button
          onClick={() => { setSelectedPlayerIds([]); setPlayerTeeIds({}); setScores({}); setHoleIdx(0); setStep("mode") }}
          className="mt-4 px-8 py-3 border border-[#C9A84C]/50 text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:bg-[#C9A84C]/10 transition-colors"
        >
          Score Another Player
        </button>
        <button onClick={() => setCloseConfirm(true)} className="text-white/20 text-xs tracking-widest uppercase hover:text-red-400/60 transition-colors">
          Close Live Round
        </button>
      </div>
    )
  }

  return null
}

// ─── HoleCard ─────────────────────────────────────────────

function HoleCard({
  hole, holeIdx, totalHoles, playerSetups, courseId,
  existingScores, onSubmit, onBack
}: {
  hole: Hole; holeIdx: number; totalHoles: number
  playerSetups: PlayerSetup[]; courseId: string
  existingScores: Record<string, HoleScore>
  onSubmit: (scores: Record<string, HoleScore>) => void
  onBack: () => void
}) {
  const [holeScores, setHoleScores] = useState<Record<string, HoleScore>>(() => {
    const init: Record<string, HoleScore> = {}
    for (const { player } of playerSetups) {
      init[player.id] = existingScores[player.id] ?? { gross: null, fairway: null, putts: null, stableford: null }
    }
    return init
  })

  useEffect(() => {
    const init: Record<string, HoleScore> = {}
    for (const { player } of playerSetups) {
      init[player.id] = existingScores[player.id] ?? { gross: null, fairway: null, putts: null, stableford: null }
    }
    setHoleScores(init)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeIdx])

  const allHaveGross = playerSetups.every(({ player }) => holeScores[player.id]?.gross !== null)

  function set(pid: string, update: Partial<HoleScore>) {
    setHoleScores(prev => ({ ...prev, [pid]: { ...prev[pid], ...update } }))
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-5">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase">← Back</button>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: totalHoles }).map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i < holeIdx ? "w-3 bg-[#C9A84C]" : i === holeIdx ? "w-4 bg-[#C9A84C]" : "w-2 bg-white/15"}`} />
          ))}
        </div>
        <span className="text-white/40 text-xs">{holeIdx + 1}/{totalHoles}</span>
      </div>

      {/* Hole info — use men's par for display; per-player effective par shown in their section */}
      <div className="border border-[#1e3d28] px-5 py-4 flex items-center justify-between bg-[#0d2015]">
        <div>
          <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase">Hole</div>
          <div className="font-[family-name:var(--font-playfair)] text-4xl text-white leading-none">{hole.hole_number}</div>
        </div>
        <div className="text-center">
          <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase">Par</div>
          <div className="text-2xl font-bold text-[#C9A84C]">{hole.par}</div>
        </div>
        <div className="text-center">
          <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase">SI</div>
          <div className="text-2xl font-bold text-white/70">{hole.stroke_index}</div>
        </div>
      </div>

      {/* Per-player scoring sections */}
      <div className="flex flex-col gap-4">
        {playerSetups.map(({ player, playingHcp, tee }) => {
          const hs = holeScores[player.id] ?? { gross: null, fairway: null, putts: null, stableford: null }
          const par = effectivePar(hole, player.gender, courseId)
          const si = effectiveSI(hole, player.gender, courseId)
          const shots = shotsReceived(si, playingHcp)
          const stableford = hs.gross !== null ? calcStableford(hs.gross, par, si, playingHcp) : null
          const showFairway = par === 4 || par === 5
          const yardage = yardageForTee(hole, tee.name)

          return (
            <div key={player.id} className="border border-[#1e3d28] bg-[#0d2015] px-4 py-4">
              {/* Name + stats */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {player.teams && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.teams.color }} />}
                  <span className="text-sm text-white/80">{player.name}</span>
                  {yardage && <span className="text-white/30 text-xs">{yardage}y</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <span>+{shots} shots</span>
                  {stableford !== null && (
                    <span className={`font-bold ${stableford >= 3 ? "text-[#C9A84C]" : stableford === 0 ? "text-red-400/70" : "text-white/60"}`}>
                      {stableford}pts
                    </span>
                  )}
                </div>
              </div>

              {/* Gross */}
              <div className="flex items-center justify-center gap-6 mb-4">
                <button onClick={() => set(player.id, { gross: Math.max(1, (hs.gross ?? par) - 1) })}
                  className="w-12 h-12 rounded-full border border-white/20 text-white/60 text-xl hover:border-white/50 hover:text-white transition-colors active:bg-white/10">−</button>
                <div className="text-center min-w-[3rem]">
                  <div className="text-5xl font-bold text-white leading-none">{hs.gross ?? "—"}</div>
                  {hs.gross !== null && (
                    <div className={`text-xs mt-1 ${hs.gross - par <= -2 ? "text-[#C9A84C]" : hs.gross - par === -1 ? "text-emerald-400" : hs.gross - par === 0 ? "text-white/40" : hs.gross - par === 1 ? "text-orange-400/70" : "text-red-400/70"}`}>
                      {hs.gross - par <= -2 ? "Eagle" : hs.gross - par === -1 ? "Birdie" : hs.gross - par === 0 ? "Par" : hs.gross - par === 1 ? "Bogey" : `+${hs.gross - par}`}
                    </div>
                  )}
                </div>
                <button onClick={() => set(player.id, { gross: (hs.gross ?? par) + 1 })}
                  className="w-12 h-12 rounded-full border border-white/20 text-white/60 text-xl hover:border-white/50 hover:text-white transition-colors active:bg-white/10">+</button>
              </div>

              {/* Fairway */}
              {showFairway && (
                <div className="mb-3">
                  <div className="text-white/30 text-[10px] tracking-[0.15em] uppercase mb-2">Fairway</div>
                  <div className="flex gap-2">
                    {(["left", "fairway", "right"] as const).map(fw => (
                      <button key={fw} onClick={() => set(player.id, { fairway: hs.fairway === fw ? null : fw })}
                        className={`flex-1 py-2 text-xs tracking-wider uppercase border transition-colors
                          ${hs.fairway === fw ? "border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10" : "border-white/15 text-white/40 hover:border-white/30"}`}>
                        {fw === "fairway" ? "FW" : fw === "left" ? "← L" : "R →"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Putts */}
              <div>
                <div className="text-white/30 text-[10px] tracking-[0.15em] uppercase mb-2">Putts</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => set(player.id, { putts: Math.max(0, (hs.putts ?? 2) - 1) })}
                    className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:border-white/30 transition-colors">−</button>
                  <span className="text-lg font-semibold text-white/70 min-w-[1.5rem] text-center">{hs.putts ?? "—"}</span>
                  <button onClick={() => set(player.id, { putts: (hs.putts ?? 1) + 1 })}
                    className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:border-white/30 transition-colors">+</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => onSubmit(holeScores)}
        disabled={!allHaveGross}
        className={`w-full py-4 text-sm tracking-[0.2em] uppercase font-semibold transition-colors
          ${allHaveGross ? "bg-[#C9A84C] text-black hover:bg-[#d4b05a]" : "bg-white/10 text-white/30 cursor-not-allowed"}`}
      >
        {holeIdx < totalHoles - 1 ? `Next Hole (${holeIdx + 2}) →` : "Finish Round →"}
      </button>
    </div>
  )
}
