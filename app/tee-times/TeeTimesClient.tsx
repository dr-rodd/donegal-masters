"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team { id: string; name: string; color: string }
interface Player { id: string; name: string; role: "dad" | "mum" | "son"; team_id: string; is_composite?: boolean; teams: Team | null }
interface TeeTimeRow { day_number: number; group_number: number; player_id: string }

// ─── Day config ───────────────────────────────────────────────────────────────

const DAYS = [
  { day: 1, label: "Thursday", date: "Thu 16 Apr", course: "Old Tom Morris",    times: ["13:00", "13:10", "13:20"] },
  { day: 2, label: "Friday",   date: "Fri 17 Apr", course: "St Patricks Links", times: ["12:00", "12:15", "12:30"] },
  { day: 3, label: "Saturday", date: "Sat 18 Apr", course: "Sandy Hills Links", times: ["11:00", "11:10", "11:20"] },
] as const

// ─── Utilities ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Generation algorithms ────────────────────────────────────────────────────

/**
 * Thursday (day 1):
 * Each group must have ≥1 dad, ≥1 mum, ≥1 son; no more than 2 from same team.
 * Retries up to 500 times.
 * Returns array of 3 groups, each group is array of player IDs, or null on failure.
 */
function generateThursday(players: Player[]): string[][] | null {
  // Exclude composite players — they don't physically tee off
  const dads = players.filter(p => p.role === "dad" && !p.is_composite).map(p => p.id)
  const mums = players.filter(p => p.role === "mum" && !p.is_composite).map(p => p.id)
  const sons = players.filter(p => p.role === "son" && !p.is_composite).map(p => p.id)

  // Need at least 3 of each role to fill the 3 groups
  if (dads.length < 3 || mums.length < 3 || sons.length < 3) return null

  const playerById = new Map(players.map(p => [p.id, p]))

  for (let attempt = 0; attempt < 500; attempt++) {
    const sDads = shuffle(dads)
    const sMums = shuffle(mums)
    const sSons = shuffle(sons)

    // Assign 1 of each role to each of the 3 groups (base threeball)
    const groups: string[][] = [
      [sDads[0], sMums[0], sSons[0]],
      [sDads[1], sMums[1], sSons[1]],
      [sDads[2], sMums[2], sSons[2]],
    ]

    // Extras: any players beyond the first 3 of each role (0–3 extras depending on composites)
    const extras = shuffle([...sDads.slice(3), ...sMums.slice(3), ...sSons.slice(3)])

    // Distribute extras across groups (at most 1 extra per group)
    for (let i = 0; i < extras.length; i++) {
      groups[i].push(extras[i])
    }

    // Check constraint: max 2 from same team per group
    let valid = true
    for (const group of groups) {
      const teamCounts = new Map<string, number>()
      for (const pid of group) {
        const p = playerById.get(pid)
        if (!p) continue
        teamCounts.set(p.team_id, (teamCounts.get(p.team_id) ?? 0) + 1)
      }
      for (const count of teamCounts.values()) {
        if (count > 2) { valid = false; break }
      }
      if (!valid) break
    }

    if (valid) return groups
  }

  return null
}

/**
 * Friday (day 2):
 * Group 0 (11:00): all 4 mums (shuffled)
 * Group 1 (11:15): all 4 dads (shuffled)
 * Group 2 (11:30): all 4 sons (shuffled)
 */
function generateFriday(players: Player[]): string[][] {
  // Exclude composite players — threeball where a role has only 3 non-composites
  const mums = shuffle(players.filter(p => p.role === "mum" && !p.is_composite).map(p => p.id))
  const dads = shuffle(players.filter(p => p.role === "dad" && !p.is_composite).map(p => p.id))
  const sons = shuffle(players.filter(p => p.role === "son" && !p.is_composite).map(p => p.id))
  return [mums, dads, sons]
}

/**
 * Saturday (day 3):
 * Async. Fetches leaderboard, sorts teams by total points desc, then assigns groups.
 * ranked[0]=1st, ranked[1]=2nd, ranked[2]=3rd, ranked[3]=4th
 * Group 0 (11:00): 3rd-place team + fourthPlayers[0]
 * Group 1 (11:10): 2nd-place team + fourthPlayers[1]
 * Group 2 (11:20): 1st-place team + fourthPlayers[2]
 * Throws a descriptive error rather than returning null so the UI can surface the reason.
 */
async function generateSaturday(players: Player[]): Promise<string[][]> {
  const realPlayers = players.filter(p => !p.is_composite && p.team_id)
  if (realPlayers.length === 0) throw new Error("No player data available.")

  const { data: leaderboard, error } = await supabase
    .from("leaderboard_summary")
    .select("team_id, total_team_points")

  if (error) throw new Error("Could not fetch leaderboard data. Check your connection.")
  if (!leaderboard || leaderboard.length === 0) {
    throw new Error("Saturday groups are drawn from the leaderboard — rounds 1 & 2 must have scores before Saturday tee times can be generated.")
  }

  // Sum total_team_points per team across all rounds
  const teamPoints = new Map<string, number>()
  for (const row of leaderboard) {
    teamPoints.set(row.team_id, (teamPoints.get(row.team_id) ?? 0) + (row.total_team_points ?? 0))
  }

  // Derive team IDs from non-composite players
  const teamIds = Array.from(new Set(realPlayers.map(p => p.team_id)))
  if (teamIds.length < 4) throw new Error("Need all 4 teams represented in player data.")

  // Sort teams by points desc, random tiebreak
  const ranked = [...teamIds].sort((a, b) => {
    const diff = (teamPoints.get(b) ?? 0) - (teamPoints.get(a) ?? 0)
    return diff !== 0 ? diff : Math.random() - 0.5
  })

  // Build per-team lists of non-composite player IDs
  const playersByTeam = new Map<string, string[]>()
  for (const tid of ranked) {
    playersByTeam.set(tid, realPlayers.filter(p => p.team_id === tid).map(p => p.id))
  }

  const firstTeamPlayers  = playersByTeam.get(ranked[0]) ?? []
  const secondTeamPlayers = playersByTeam.get(ranked[1]) ?? []
  const thirdTeamPlayers  = playersByTeam.get(ranked[2]) ?? []
  const fourthPlayers     = shuffle(playersByTeam.get(ranked[3]) ?? [])

  if (!firstTeamPlayers.length || !secondTeamPlayers.length || !thirdTeamPlayers.length) {
    throw new Error("One or more teams have no players — check player data.")
  }

  // Distribute 4th-team players 1 per group where available (fewer = threeball for that group)
  return [
    [...thirdTeamPlayers,  ...(fourthPlayers[0] ? [fourthPlayers[0]] : [])],
    [...secondTeamPlayers, ...(fourthPlayers[1] ? [fourthPlayers[1]] : [])],
    [...firstTeamPlayers,  ...(fourthPlayers[2] ? [fourthPlayers[2]] : [])],
  ]
}

// ─── Save function ────────────────────────────────────────────────────────────

async function saveGroups(day: number, groups: string[][]): Promise<void> {
  // Delete existing rows for that day
  const { error: deleteError } = await supabase
    .from("tee_times")
    .delete()
    .eq("day_number", day)

  if (deleteError) throw new Error(deleteError.message)

  // Insert new rows
  const rows = groups.flatMap((group, gi) =>
    group.map(player_id => ({
      day_number: day,
      group_number: gi + 1,
      player_id,
    }))
  )

  if (rows.length === 0) return
  const { error: insertError } = await supabase.from("tee_times").insert(rows)
  if (insertError) throw new Error(insertError.message)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function majorityTeam(playerIds: string[], allPlayers: Player[]): Team | undefined {
  if (!playerIds.length || !allPlayers.length) return undefined
  const teamCounts = new Map<string, number>()
  for (const pid of playerIds) {
    const p = allPlayers.find(pl => pl.id === pid)
    if (!p || !p.team_id) continue
    teamCounts.set(p.team_id, (teamCounts.get(p.team_id) ?? 0) + 1)
  }

  let maxCount = 0
  let majorityTeamId: string | undefined
  for (const [tid, count] of teamCounts.entries()) {
    if (count > maxCount) {
      maxCount = count
      majorityTeamId = tid
    }
  }

  if (!majorityTeamId) return undefined
  const player = allPlayers.find(p => p.team_id === majorityTeamId)
  return player?.teams ?? undefined
}

// ─── UI Sub-components ────────────────────────────────────────────────────────

function EditablePlayerRow({
  playerId,
  currentGroup,
  allPlayers,
  onMove,
}: {
  playerId: string
  currentGroup: number
  allPlayers: Player[]
  onMove: (toGroup: number) => void
}) {
  const player = allPlayers.find(p => p.id === playerId)
  if (!player) return null

  const team = player.teams
  const roleLabel = player.role === "dad" ? "Dad" : player.role === "mum" ? "Mum" : "Son"

  return (
    <div className="flex items-stretch bg-[#0f2418] border-t border-[#1a3020] first:border-t-0">
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: team?.color ?? "transparent" }} />
      <div className="flex items-center gap-2 px-3 py-3 flex-1 min-w-0">
        <span className="flex-1 text-sm text-white truncate">{player.name}</span>
        <span className="text-xs text-white/30 uppercase tracking-widest flex-shrink-0">{roleLabel}</span>
        <div className="flex gap-1 flex-shrink-0">
          {[0, 1, 2].map(gi => (
            <button
              key={gi}
              onClick={() => gi !== currentGroup && onMove(gi)}
              className={`w-8 h-8 text-xs rounded-sm transition-colors ${
                gi === currentGroup
                  ? "bg-[#C9A84C] text-black font-semibold"
                  : "border border-white/20 text-white/50 hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
              }`}
            >
              {gi + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EditableGroupCard({
  teeTime,
  label,
  groupIndex,
  playerIds,
  allPlayers,
  onMovePlayer,
}: {
  teeTime: string
  label?: string
  groupIndex: number
  playerIds: string[]
  allPlayers: Player[]
  onMovePlayer: (playerId: string, toGroup: number) => void
}) {
  return (
    <div className="border border-[#C9A84C]/30 overflow-hidden rounded-sm">
      <div className="bg-[#081510] border-b border-[#C9A84C]/20 px-4 py-3 flex items-baseline gap-3">
        <span className="font-[family-name:var(--font-playfair)] text-2xl text-[#C9A84C]">{teeTime}</span>
        {label && <span className="text-xs tracking-[0.2em] uppercase text-white/50">{label}</span>}
      </div>
      <div>
        {playerIds.map(pid => (
          <EditablePlayerRow
            key={pid}
            playerId={pid}
            currentGroup={groupIndex}
            allPlayers={allPlayers}
            onMove={toGroup => onMovePlayer(pid, toGroup)}
          />
        ))}
        {playerIds.length === 0 && (
          <div className="px-4 py-3 text-white/30 text-sm italic">Empty group</div>
        )}
      </div>
    </div>
  )
}

function PlayerRow({ playerId, allPlayers }: { playerId: string; allPlayers: Player[] }) {
  const player = allPlayers.find(p => p.id === playerId)
  if (!player) return null

  const team = player.teams
  const roleLabel = player.role === "dad" ? "Dad" : player.role === "mum" ? "Mum" : "Son"

  return (
    <div className="flex items-stretch bg-[#0f2418] border-t border-[#1a3020] first:border-t-0">
      {/* Left color bar */}
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: team?.color ?? "transparent" }} />
      <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
        <span className="flex-1 text-sm text-white truncate">{player.name}</span>
        <span className="text-xs text-white/30 uppercase tracking-widest flex-shrink-0">
          {roleLabel}
        </span>
        {team && (
          <span
            className="text-xs px-2 py-0.5 rounded-sm flex-shrink-0"
            style={{
              backgroundColor: team.color + "38",
              color: team.color,
            }}
          >
            {team.name}
          </span>
        )}
      </div>
    </div>
  )
}

function GroupCard({
  teeTime,
  label,
  playerIds,
  allPlayers,
}: {
  teeTime: string
  label?: string
  playerIds: string[]
  allPlayers: Player[]
}) {
  return (
    <div className="border border-[#1e3d28] overflow-hidden rounded-sm">
      {/* Header */}
      <div className="bg-[#081510] border-b border-[#1e3d28] px-4 py-3 flex items-baseline gap-3">
        <span className="font-[family-name:var(--font-playfair)] text-2xl text-[#C9A84C]">
          {teeTime}
        </span>
        {label && (
          <span className="text-xs tracking-[0.2em] uppercase text-white/50">{label}</span>
        )}
      </div>
      {/* Players */}
      <div>
        {playerIds.map(pid => (
          <PlayerRow key={pid} playerId={pid} allPlayers={allPlayers} />
        ))}
        {playerIds.length === 0 && (
          <div className="px-4 py-3 text-white/30 text-sm">No players assigned</div>
        )}
      </div>
    </div>
  )
}

function ConfirmModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
      <div className="bg-[#0a1a0e] border border-[#C9A84C]/50 rounded-sm max-w-sm w-full p-6">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl text-white mb-3">
          Generate Tee Times
        </h2>
        <p className="text-white/70 text-sm mb-6">
          Tee times cannot be reversed once generated — are you sure?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 border border-white/20 text-white/60 text-sm tracking-[0.15em] uppercase transition-colors hover:border-white/40 hover:text-white/80 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 border border-[#C9A84C] text-[#C9A84C] text-sm tracking-[0.15em] uppercase transition-colors hover:bg-[#C9A84C] hover:text-black disabled:opacity-40"
          >
            {busy ? "Generating…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeeTimesClient({
  players,
  teeTimes: initialTeeTimes,
}: {
  players: Player[]
  teeTimes: TeeTimeRow[]
}) {
  const [activeDay, setActiveDay] = useState<1 | 2 | 3>(1)
  const [teeTimes, setTeeTimes] = useState<TeeTimeRow[]>(initialTeeTimes)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editGroups, setEditGroups] = useState<string[][]>([[], [], []])

  const cfg = DAYS.find(d => d.day === activeDay)!

  const dayRows = teeTimes.filter(r => r.day_number === activeDay)
  const groups = [1, 2, 3].map(g =>
    dayRows.filter(r => r.group_number === g).map(r => r.player_id)
  )
  const hasGroups = dayRows.length > 0

  function groupLabel(gi: number): string | undefined {
    if (activeDay === 1) return undefined
    if (activeDay === 2) return (["Mums", "Dads", "Sons"] as const)[gi]
    // Saturday
    if (!hasGroups) return undefined
    return majorityTeam(groups[gi], players)?.name
  }

  function startEditing() {
    setEditGroups(groups.map(g => [...g]))
    setError(null)
    setEditMode(true)
  }

  function cancelEditing() {
    setEditMode(false)
    setError(null)
  }

  function movePlayer(playerId: string, toGroup: number) {
    setEditGroups(prev => {
      const next = prev.map(g => [...g])
      // Remove from whichever group currently holds the player
      for (let i = 0; i < next.length; i++) {
        next[i] = next[i].filter(id => id !== playerId)
      }
      next[toGroup] = [...next[toGroup], playerId]
      return next
    })
  }

  async function saveEdits() {
    setBusy(true)
    setError(null)
    try {
      await saveGroups(activeDay, editGroups)
      const newRows: TeeTimeRow[] = editGroups.flatMap((group, gi) =>
        group.map(player_id => ({
          day_number: activeDay,
          group_number: gi + 1,
          player_id,
        }))
      )
      setTeeTimes(prev => [
        ...prev.filter(r => r.day_number !== activeDay),
        ...newRows,
      ])
      setEditMode(false)
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.")
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerate() {
    setBusy(true)
    setError(null)
    try {
      let newGroups: string[][] | null = null

      if (activeDay === 1) {
        newGroups = generateThursday(players)
        if (!newGroups) throw new Error("Could not generate valid Thursday groups after 500 attempts. Check player data.")
      } else if (activeDay === 2) {
        newGroups = generateFriday(players)
      } else {
        newGroups = await generateSaturday(players)
      }

      await saveGroups(activeDay, newGroups)

      // Update local state: remove old rows for this day, add new ones
      const newRows: TeeTimeRow[] = newGroups.flatMap((group, gi) =>
        group.map(player_id => ({
          day_number: activeDay,
          group_number: gi + 1,
          player_id,
        }))
      )

      setTeeTimes(prev => [
        ...prev.filter(r => r.day_number !== activeDay),
        ...newRows,
      ])
      setConfirming(false)
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.")
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 pb-16 pt-2">
      {/* Day tabs */}
      <div className="flex border-b border-[#1e3d28] mb-6">
        {DAYS.map(d => {
          const isActive = d.day === activeDay
          return (
            <button
              key={d.day}
              onClick={() => { setActiveDay(d.day as 1 | 2 | 3); setError(null); setEditMode(false) }}
              className={`flex-1 py-3 text-sm tracking-[0.15em] uppercase transition-colors relative ${
                isActive
                  ? "text-[#C9A84C]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {d.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A84C]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Day meta bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#C9A84C]/25" />
        <span className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C]/80 flex-shrink-0">
          {cfg.date}
        </span>
        <span className="text-white/20 flex-shrink-0">·</span>
        <span className="text-[11px] tracking-[0.2em] uppercase text-white/50 flex-shrink-0">
          {cfg.course}
        </span>
        <div className="flex-1 h-px bg-[#C9A84C]/25" />
      </div>

      {/* Groups area */}
      {editMode ? (
        <div className="space-y-3 mb-6">
          <p className="text-xs text-white/40 tracking-[0.15em] uppercase text-center mb-4">
            Tap a group number to move a player
          </p>
          {editGroups.map((group, gi) => (
            <EditableGroupCard
              key={gi}
              teeTime={cfg.times[gi]}
              groupIndex={gi}
              playerIds={group}
              allPlayers={players}
              onMovePlayer={(pid, toGroup) => movePlayer(pid, toGroup)}
            />
          ))}
        </div>
      ) : hasGroups ? (
        <div className="space-y-3 mb-6">
          {groups.map((group, gi) => (
            <GroupCard
              key={gi}
              teeTime={cfg.times[gi]}
              label={groupLabel(gi)}
              playerIds={group}
              allPlayers={players}
            />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-[#1e3d28] py-14 text-center mb-6">
          <p className="text-white/25 text-sm">No tee times generated yet</p>
        </div>
      )}

      {/* Action buttons */}
      {editMode ? (
        <div className="flex gap-3">
          <button
            onClick={cancelEditing}
            disabled={busy}
            className="flex-1 py-4 border border-white/20 text-white/60 text-sm tracking-[0.2em] uppercase hover:border-white/40 hover:text-white/80 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={saveEdits}
            disabled={busy}
            className="flex-1 py-4 border border-[#C9A84C] text-[#C9A84C] text-sm tracking-[0.2em] uppercase hover:bg-[#C9A84C] hover:text-black transition-colors disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {hasGroups && (
            <button
              onClick={startEditing}
              className="w-full py-4 border border-white/25 text-white/60 text-sm tracking-[0.25em] uppercase hover:border-white/50 hover:text-white/80 transition-colors"
            >
              Modify Tee Times
            </button>
          )}
          <button
            onClick={() => { setError(null); setConfirming(true) }}
            className="w-full py-4 border border-[#C9A84C] text-[#C9A84C] text-sm tracking-[0.25em] uppercase hover:bg-[#C9A84C] hover:text-black transition-colors"
          >
            {hasGroups ? "Regenerate Tee Times" : "Generate Tee Times"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs mt-3 text-center">{error}</p>
      )}

      {/* Confirm modal */}
      {confirming && (
        <ConfirmModal
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={handleGenerate}
        />
      )}
    </div>
  )
}
