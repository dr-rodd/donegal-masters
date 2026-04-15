"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from "@dnd-kit/core"
import { supabase } from "@/lib/supabase"
import Poller from "@/app/components/Poller"

// ─── Types ─────────────────────────────────────────────────────

interface Team   { id: string; name: string; color: string }
interface Player { id: string; name: string; role: string; handicap: number; team_id: string | null; gender: string; is_composite: boolean }
type PlayerUpdate = { name?: string; handicap?: number; gender?: string; is_composite?: boolean }

const ROLE_ORDER: Record<string, number> = { dad: 0, mum: 1, son: 2 }
const displayName = (p: Player) => p.is_composite ? p.name.replace(/^Composite\s+/i, "") : p.name
function sortByRole(p: Player[]) {
  return [...p].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
}

// ─── Error toast ───────────────────────────────────────────────

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
      <div className="bg-red-950 border border-red-700/60 text-red-200 text-sm px-5 py-3 rounded-sm shadow-xl max-w-sm w-full text-center pointer-events-auto">
        {message}
      </div>
    </div>
  )
}

// ─── Padlock icons ─────────────────────────────────────────────

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
    </svg>
  )
}

function UnlockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
    </svg>
  )
}

// ─── Display tile ──────────────────────────────────────────────

function PlayerTile({ player, faded = false }: { player: Player; faded?: boolean }) {
  return (
    <div className={`border border-[#1e3d28] rounded-sm px-4 py-3 flex items-center justify-between gap-3 bg-[#152a1e] transition-opacity
      ${faded ? "opacity-25" : "opacity-100"}`}>
      <span className="text-white font-bold text-base tracking-wide leading-tight flex-1 min-w-0 truncate flex items-center gap-1">
        {displayName(player)}
        {player.is_composite && (
          <span className="text-[9px] font-bold text-[#C9A84C] border border-[#C9A84C]/40 px-0.5 rounded-sm leading-tight flex-shrink-0">C</span>
        )}
      </span>
      <div className="border border-[#C9A84C]/50 bg-[#C9A84C]/10 px-2.5 py-1 rounded-sm flex-shrink-0">
        <span className="font-[family-name:var(--font-playfair)] text-[#C9A84C] text-xl font-semibold leading-none">
          {player.handicap}
        </span>
      </div>
    </div>
  )
}

// ─── Editable tile ─────────────────────────────────────────────

function EditPlayerTile({ player, onUpdate }: {
  player: Player
  onUpdate: (id: string, changes: PlayerUpdate) => void
}) {
  const [name, setName]         = useState(player.name)
  const [handicap, setHandicap] = useState(String(player.handicap))
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress   = useRef(false)

  function saveName() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== player.name) onUpdate(player.id, { name: trimmed })
    else setName(player.name)
  }

  function saveHandicap() {
    const val = parseFloat(handicap)
    if (!isNaN(val) && val >= 0 && val <= 54 && val !== player.handicap) {
      onUpdate(player.id, { handicap: val })
    } else {
      setHandicap(String(player.handicap))
    }
  }

  function handleGenderPointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      if (!player.is_composite) {
        const newName = "Composite " + player.name
        setName(newName)
        onUpdate(player.id, { name: newName, is_composite: true })
      }
    }, 600)
  }

  function handleGenderPointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleGenderClick() {
    if (didLongPress.current) return
    if (player.is_composite) {
      const newName = player.name.replace(/^Composite\s+/i, "")
      setName(newName)
      onUpdate(player.id, { name: newName, is_composite: false })
    } else {
      onUpdate(player.id, { gender: player.gender === "M" ? "F" : "M" })
    }
  }

  return (
    <div className="border border-[#C9A84C]/20 rounded-sm bg-[#152a1e] px-3 py-2.5 space-y-2">
      <input
        value={player.is_composite ? displayName(player) : name}
        onChange={e => !player.is_composite && setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        readOnly={player.is_composite}
        className={`bg-transparent text-white font-bold text-base w-full outline-none border-b transition-colors pb-0.5
          ${player.is_composite
            ? "border-[#C9A84C]/30 text-[#C9A84C]/70 cursor-default"
            : "border-white/15 focus:border-[#C9A84C]/50"}`}
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={handicap}
          onChange={e => setHandicap(e.target.value)}
          onBlur={saveHandicap}
          onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          min={0} max={54} step={0.1}
          className="border border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C] font-[family-name:var(--font-playfair)] text-xl text-center w-16 outline-none rounded-sm py-0.5 leading-none"
        />
        <button
          onPointerDown={handleGenderPointerDown}
          onPointerUp={handleGenderPointerUp}
          onPointerLeave={handleGenderPointerUp}
          onClick={handleGenderClick}
          className={`flex-1 py-1.5 rounded-sm text-sm font-bold border transition-colors select-none
            ${player.is_composite
              ? "bg-[#C9A84C]/20 border-[#C9A84C] text-[#C9A84C] shadow-[0_0_8px_rgba(201,168,76,0.4)]"
              : player.gender === "M"
                ? "bg-blue-900/50 border-blue-400/50 text-blue-300 hover:bg-blue-900/70"
                : "bg-rose-900/50 border-rose-400/50 text-rose-300 hover:bg-rose-900/70"}`}
        >
          {player.is_composite ? "◈ Composite" : player.gender === "M" ? "♂ Male" : "♀ Female"}
        </button>
      </div>
    </div>
  )
}

// ─── Draggable wrapper ─────────────────────────────────────────

function DraggablePlayer({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="touch-none cursor-grab active:cursor-grabbing">
      <PlayerTile player={player} faded={isDragging} />
    </div>
  )
}

// ─── Team column ───────────────────────────────────────────────

function TeamColumn({
  team, players, editMode, locked,
  isEditing, editName, onEditStart, onEditChange, onEditSave, onEditKeyDown,
  onUpdatePlayer,
}: {
  team: Team
  players: Player[]
  editMode: boolean
  locked: boolean
  isEditing: boolean
  editName: string
  onEditStart: () => void
  onEditChange: (v: string) => void
  onEditSave: () => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  onUpdatePlayer: (id: string, changes: PlayerUpdate) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: team.id })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-sm flex flex-col min-h-[160px] transition-all duration-150
        ${isOver && !editMode && !locked
          ? "border border-[#C9A84C]/50 bg-[#C9A84C]/5"
          : "border border-[#1e3d28] bg-[#0f2418]"}`}
    >
      <div className="px-3 py-3 border-b border-[#1e3d28] flex items-center gap-2 min-h-[48px]">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
        {isEditing && !locked ? (
          <input
            value={editName}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={onEditKeyDown}
            className="bg-transparent text-white text-sm font-semibold outline-none border-b border-[#C9A84C] flex-1 min-w-0"
            autoFocus
          />
        ) : (
          <button
            onClick={locked ? undefined : onEditStart}
            className={`text-white text-sm font-semibold transition-colors text-left flex-1 min-w-0 truncate
              ${locked ? "cursor-default" : "hover:text-[#C9A84C]"}`}
            title={locked ? undefined : "Click to rename"}
          >
            {team.name}
          </button>
        )}
        <span className="text-white/20 text-xs flex-shrink-0">{players.length}</span>
      </div>

      <div className="p-2 space-y-2 flex-1">
        {players.map(p =>
          editMode && !locked
            ? <EditPlayerTile key={p.id} player={p} onUpdate={onUpdatePlayer} />
            : locked
            ? <PlayerTile key={p.id} player={p} />
            : <DraggablePlayer key={p.id} player={p} />
        )}
        {players.length === 0 && !locked && (
          <p className="text-white/15 text-sm text-center py-6 select-none">Drop here</p>
        )}
      </div>
    </div>
  )
}

// ─── Bowl constants ────────────────────────────────────────────

const BOWLS: { role: string; label: string; accent: string; hover: string }[] = [
  { role: "dad", label: "Daddy Bowl", accent: "border-blue-400/30 text-blue-300/60",  hover: "border-blue-400/50 bg-blue-900/10" },
  { role: "mum", label: "Mommy Bowl", accent: "border-rose-400/30 text-rose-300/60",  hover: "border-rose-400/50 bg-rose-900/10" },
  { role: "son", label: "Kiddie Bowl", accent: "border-emerald-400/30 text-emerald-300/60", hover: "border-emerald-400/50 bg-emerald-900/10" },
]
export const BOWL_ID = (role: string) => `unassigned-${role}`
export const BOWL_ROLE: Record<string, string> = { "unassigned-dad": "dad", "unassigned-mum": "mum", "unassigned-son": "son" }

// ─── Bowl zone ─────────────────────────────────────────────────

function BowlZone({ bowl, players, editMode, locked, onUpdatePlayer }: {
  bowl: typeof BOWLS[number]
  players: Player[]
  editMode: boolean
  locked: boolean
  onUpdatePlayer: (id: string, changes: PlayerUpdate) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: BOWL_ID(bowl.role) })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-sm transition-all duration-150 border
        ${isOver && !editMode && !locked ? bowl.hover : "border-[#1e3d28] bg-[#0f2418]"}`}
    >
      <div className="px-4 py-3 border-b border-[#1e3d28]">
        <span className={`font-[family-name:var(--font-playfair)] text-lg font-semibold ${bowl.accent.split(" ")[1]}`}>
          {bowl.label}
        </span>
      </div>
      <div className="p-3 flex flex-wrap gap-2 min-h-[56px]">
        {players.map(p =>
          editMode && !locked
            ? <div key={p.id} className="w-full sm:w-56"><EditPlayerTile player={p} onUpdate={onUpdatePlayer} /></div>
            : locked
            ? <div key={p.id} className="w-full sm:w-56"><PlayerTile player={p} /></div>
            : <DraggablePlayer key={p.id} player={p} />
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

export default function TeamsClient({
  teams: initialTeams,
  players: initialPlayers,
  initialLocked,
  isActive,
}: {
  teams: Team[]
  players: Player[]
  initialLocked: boolean
  isActive: boolean
}) {
  const router = useRouter()

  const [teams, setTeams]               = useState<Team[]>(initialTeams)
  const [players, setPlayers]           = useState<Player[]>(initialPlayers)
  const [activePlayer, setActivePlayer] = useState<Player | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editName, setEditName]         = useState("")
  const [editMode, setEditMode]         = useState(false)
  const [isLocked, setIsLocked]         = useState(initialLocked)
  const [isDragging, setIsDragging]     = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Poller is paused while unlocked (editing mode) or during an active drag
  const pollerPaused = !isLocked || isDragging

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,  { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // ── DnD ───────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    if (editMode || isLocked) return
    setIsDragging(true)
    setActivePlayer(players.find(p => p.id === active.id) ?? null)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setIsDragging(false)
    setActivePlayer(null)
    if (!over || editMode || isLocked) return

    const playerId    = active.id as string
    const overId      = over.id as string
    const isBowl      = overId in BOWL_ROLE
    const dragged     = players.find(p => p.id === playerId)
    if (!dragged) return

    if (isBowl && BOWL_ROLE[overId] !== dragged.role) return

    const targetTeamId   = isBowl ? null : overId
    if (dragged.team_id === targetTeamId) return

    const displaced    = targetTeamId
      ? players.find(p => p.team_id === targetTeamId && p.role === dragged.role)
      : null
    const originalTeamId = dragged.team_id

    // Capture state for potential rollback
    const prevPlayers = players

    if (displaced) {
      setPlayers(prev => prev.map(p => {
        if (p.id === dragged.id)   return { ...p, team_id: targetTeamId }
        if (p.id === displaced.id) return { ...p, team_id: originalTeamId }
        return p
      }))
      // Three-step write to satisfy the partial unique index (one dad/mum per team).
      // The index is WHERE team_id IS NOT NULL, so nulling the displaced player
      // temporarily removes them from the constraint, allowing the dragged player
      // to land without a conflict. Sons have no such index so parallel would work,
      // but this sequence is safe for all roles.
      const r1 = await supabase.from("players").update({ team_id: null }).eq("id", displaced.id)
      if (r1.error) {
        setPlayers(prevPlayers)
        setError("Failed to save — try again")
        console.error("Team swap failed (clear displaced):", r1.error)
        return
      }
      const r2 = await supabase.from("players").update({ team_id: targetTeamId }).eq("id", dragged.id)
      if (r2.error) {
        await supabase.from("players").update({ team_id: displaced.team_id }).eq("id", displaced.id)
        setPlayers(prevPlayers)
        setError("Failed to save — try again")
        console.error("Team swap failed (move dragged):", r2.error)
        return
      }
      const r3 = await supabase.from("players").update({ team_id: originalTeamId }).eq("id", displaced.id)
      if (r3.error) {
        setPlayers(prevPlayers)
        setError("Failed to save — try again")
        console.error("Team swap failed (place displaced):", r3.error)
      }
    } else {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team_id: targetTeamId } : p))
      const { error: writeError } = await supabase.from("players").update({ team_id: targetTeamId }).eq("id", playerId)
      if (writeError) {
        setPlayers(prevPlayers)
        setError("Failed to save — try again")
        console.error("Team assignment write failed:", writeError)
      }
    }
  }

  // ── Lock / Unlock ─────────────────────────────────────────────

  async function handleToggleLock() {
    if (saving) return
    setSaving(true)
    setError(null)

    if (isLocked) {
      // Unlock — just update the setting
      const { error: settingsError } = await supabase
        .from("settings")
        .upsert({ key: "teams_locked", value: false })
      if (settingsError) {
        setError("Failed to unlock — try again")
        console.error("Unlock failed:", settingsError)
        setSaving(false)
        return
      }
      setIsLocked(false)
    } else {
      // Lock — definitive save of all current assignments, then persist lock state
      const results = await Promise.all(
        players.map(p =>
          supabase.from("players").update({ team_id: p.team_id }).eq("id", p.id)
        )
      )
      const writeError = results.find(r => r.error)?.error
      if (writeError) {
        setError("Failed to save team assignments — try again")
        console.error("Lock save failed:", writeError)
        setSaving(false)
        return
      }
      const { error: settingsError } = await supabase
        .from("settings")
        .upsert({ key: "teams_locked", value: true })
      if (settingsError) {
        setError("Failed to lock — try again")
        console.error("Lock settings write failed:", settingsError)
        setSaving(false)
        return
      }
      setIsLocked(true)
      setEditMode(false)
      router.refresh() // Propagate fresh team data to tee times, leaderboard, scoring
    }

    setSaving(false)
  }

  // ── Team name editing ─────────────────────────────────────────

  function startEdit(team: Team) {
    if (isLocked) return
    setEditingTeamId(team.id)
    setEditName(team.name)
  }

  async function saveEdit(teamId: string) {
    const trimmed = editName.trim()
    setEditingTeamId(null)
    if (!trimmed) return
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name: trimmed } : t))
    await supabase.from("teams").update({ name: trimmed }).eq("id", teamId)
  }

  // ── Player editing ────────────────────────────────────────────

  async function updatePlayer(id: string, changes: PlayerUpdate) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))
    await supabase.from("players").update(changes).eq("id", id)
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <Poller isActive={isActive} isPaused={pollerPaused} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-6">

          {/* Lock toggle + Edit players */}
          <div className="flex items-center justify-between gap-3">
            {/* Lock / Unlock button */}
            <button
              onClick={handleToggleLock}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 border text-sm tracking-[0.15em] uppercase transition-colors rounded-sm disabled:opacity-50
                ${isLocked
                  ? "border-[#C9A84C]/40 text-[#C9A84C]/70 hover:border-[#C9A84C] hover:text-[#C9A84C]"
                  : "border-amber-400/60 text-amber-300 bg-amber-900/20 hover:bg-amber-900/30"}`}
            >
              {isLocked ? <LockIcon /> : <UnlockIcon />}
              <span>{saving ? "Saving…" : isLocked ? "Locked" : "Unlocked"}</span>
            </button>

            {/* Edit players — hidden when locked */}
            {!isLocked && (
              <button
                onClick={() => setEditMode(e => !e)}
                className={`px-5 py-2 border text-sm tracking-[0.2em] uppercase transition-colors rounded-sm
                  ${editMode
                    ? "border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10"
                    : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"}`}
              >
                {editMode ? "Done" : "Edit Players"}
              </button>
            )}
          </div>

          {/* Unlocked banner */}
          {!isLocked && (
            <div className="flex items-center gap-3 px-4 py-3 border border-amber-500/30 bg-amber-900/10 rounded-sm">
              <UnlockIcon />
              <p className="text-amber-300/80 text-xs tracking-wide flex-1">
                {editMode
                  ? "Edit mode — modify player names and handicaps."
                  : "Teams unlocked — drag players between teams. Tap the padlock to save and lock."}
              </p>
            </div>
          )}

          {/* Hint text */}
          {isLocked && (
            <p className="text-white/30 text-xs tracking-widest uppercase text-center">
              Tap the padlock to unlock and edit teams
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BOWLS.map(bowl => (
              <BowlZone
                key={bowl.role}
                bowl={bowl}
                players={players.filter(p => !p.team_id && p.role === bowl.role)}
                editMode={editMode}
                locked={isLocked}
                onUpdatePlayer={updatePlayer}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map(team => (
              <TeamColumn
                key={team.id}
                team={team}
                players={sortByRole(players.filter(p => p.team_id === team.id))}
                editMode={editMode}
                locked={isLocked}
                isEditing={editingTeamId === team.id}
                editName={editName}
                onEditStart={() => startEdit(team)}
                onEditChange={setEditName}
                onEditSave={() => saveEdit(team.id)}
                onEditKeyDown={e => {
                  if (e.key === "Enter")  saveEdit(team.id)
                  if (e.key === "Escape") setEditingTeamId(null)
                }}
                onUpdatePlayer={updatePlayer}
              />
            ))}
          </div>

        </div>

        {!editMode && !isLocked && (
          <DragOverlay dropAnimation={null}>
            {activePlayer && (
              <div className="rotate-1 scale-105 shadow-xl shadow-black/60 w-52">
                <PlayerTile player={activePlayer} />
              </div>
            )}
          </DragOverlay>
        )}
      </DndContext>

      {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
    </>
  )
}
