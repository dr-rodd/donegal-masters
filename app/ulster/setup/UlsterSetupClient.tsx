"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createMatch, deleteMatch, type CreateMatchInput } from "./actions"

// ── Types ──────────────────────────────────────────────────────

type Course = { id: string; slug: string; name: string }
type Tee = {
  id: string; course_id: string; tee_name: string; gender: string
  total_yards: number; course_rating: number; slope_rating: number; pars: number[]
}
type UlsterPlayer = { id: string; player_id: string; handicap_index: number; players: { name: string } }
type Match = {
  id: string; name: string | null; match_date: string; format: string
  hcp_allowance: number; agg_holes: number | null
  team_a_players: string[]; team_b_players: string[]
  status: string
  ulster_courses: { name: string } | null
  ulster_course_tees: { tee_name: string } | null
}

type Format = "4bbb_matchplay" | "strokeplay_cumulative" | "bbb_agg"

const FORMAT_LABELS: Record<Format, string> = {
  "4bbb_matchplay": "4BBB Matchplay",
  "strokeplay_cumulative": "Strokeplay Cumulative",
  "bbb_agg": "BBB Aggregate",
}

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

// ── Shared styles ──────────────────────────────────────────────

const inp = "w-full bg-[#0a1a0e] border border-[#2a5438] rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C]/60 min-h-[44px]"
const lbl = "text-white/40 text-[11px] uppercase tracking-wide block mb-1.5"

// ── PlayerChip ─────────────────────────────────────────────────

function PlayerChip({ player, isSelected, disabled, onToggle, teamIdx }: {
  player: UlsterPlayer
  isSelected: boolean
  disabled: boolean
  onToggle: () => void
  teamIdx: 0 | 1
}) {
  // Team A = gold, Team B = sky blue
  const activeClass = teamIdx === 0
    ? "bg-[#C9A84C]/15 border-[#C9A84C]/50 text-[#C9A84C]"
    : "bg-[#60a5fa]/15 border-[#60a5fa]/50 text-[#60a5fa]"

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`
        flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors
        min-h-[52px] flex-1 basis-[calc(50%-4px)]
        ${isSelected ? activeClass : "border-[#1e3d28] text-white/60 hover:border-[#2a5438] hover:text-white/80"}
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span className="text-sm font-[family-name:var(--font-playfair)] leading-tight">
        {player.players.name}
      </span>
      <span className="text-[11px] opacity-60 mt-0.5">HI {player.handicap_index}</span>
    </button>
  )
}

// ── TeamPicker ─────────────────────────────────────────────────

function TeamPicker({ label, teamIdx, selected, otherSelected, players, onChange }: {
  label: string; teamIdx: 0 | 1
  selected: string[]; otherSelected: string[]
  players: UlsterPlayer[]; onChange: (ids: string[]) => void
}) {
  const accentColor = teamIdx === 0 ? "text-[#C9A84C]" : "text-[#60a5fa]"
  const dotClass = teamIdx === 0 ? "bg-[#C9A84C]" : "bg-[#60a5fa]"

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else if (selected.length < 2) {
      onChange([...selected, id])
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className={`text-sm font-[family-name:var(--font-playfair)] ${accentColor}`}>{label}</span>
        <span className="text-white/30 text-xs ml-auto">{selected.length}/2</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {players.map(p => (
          <PlayerChip
            key={p.id}
            player={p}
            isSelected={selected.includes(p.id)}
            disabled={otherSelected.includes(p.id) || (selected.length >= 2 && !selected.includes(p.id))}
            onToggle={() => toggle(p.id)}
            teamIdx={teamIdx}
          />
        ))}
      </div>
    </div>
  )
}

// ── CreateMatchForm ────────────────────────────────────────────

function CreateMatchForm({ courses, tees, ulsterPlayers, defaultDate, onCreated }: {
  courses: Course[]; tees: Tee[]; ulsterPlayers: UlsterPlayer[]
  defaultDate: string; onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "")
  const [teeId, setTeeId] = useState(() => tees.find(t => t.course_id === courses[0]?.id)?.id ?? "")
  const [format, setFormat] = useState<Format>("4bbb_matchplay")
  const [hcpAllowance, setHcpAllowance] = useState<85 | 100>(100)
  const [aggHoles, setAggHoles] = useState("9")
  const [teamA, setTeamA] = useState<string[]>([])
  const [teamB, setTeamB] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const filteredTees = tees.filter(t => t.course_id === courseId)
  const selectedTee = tees.find(t => t.id === teeId)
  const maxAggHoles = selectedTee?.pars.length ?? 18

  function handleCourseChange(id: string) {
    setCourseId(id)
    const firstTee = tees.find(t => t.course_id === id)
    setTeeId(firstTee?.id ?? "")
  }

  const showHcp = format === "4bbb_matchplay" || format === "bbb_agg"
  const showAgg = format === "bbb_agg"

  function validate(): string[] {
    const errs: string[] = []
    if (!date) errs.push("Date is required")
    if (!courseId) errs.push("Course is required")
    if (!teeId) errs.push("Tee is required")
    if (teamA.length !== 2) errs.push("Team A must have exactly 2 players")
    if (teamB.length !== 2) errs.push("Team B must have exactly 2 players")
    const overlap = teamA.filter(id => teamB.includes(id))
    if (overlap.length > 0) errs.push("Teams cannot share players")
    if (showAgg) {
      const n = parseInt(aggHoles)
      if (isNaN(n) || n < 1 || n > maxAggHoles) errs.push(`Agg holes must be 1–${maxAggHoles}`)
    }
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setErrors([]); setSaving(true); setSaveErr(null)

    const input: CreateMatchInput = {
      name,
      match_date: date,
      course_id: courseId,
      tee_id: teeId,
      format,
      hcp_allowance: showHcp ? hcpAllowance : 100,
      agg_holes: showAgg ? parseInt(aggHoles) : null,
      team_a_players: teamA,
      team_b_players: teamB,
    }

    const res = await createMatch(input)
    setSaving(false)
    if (res.error) { setSaveErr(res.error) }
    else onCreated()
  }

  return (
    <div className="border border-[#1e3d28] rounded-xl overflow-hidden">
      <div className="px-4 py-4 bg-[#0d2415]">
        <h2 className="font-[family-name:var(--font-playfair)] text-white text-base">Create Match</h2>
      </div>

      <div className="border-t border-[#1e3d28] px-4 py-5 flex flex-col gap-5">

        {/* Name */}
        <div>
          <label className={lbl}>Match Name <span className="text-white/20 normal-case">(optional)</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className={inp} placeholder="e.g. Portstewart 4BBB" />
        </div>

        {/* Date */}
        <div>
          <label className={lbl}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
        </div>

        {/* Course */}
        <div>
          <label className={lbl}>Course</label>
          <select value={courseId} onChange={e => handleCourseChange(e.target.value)} className={inp}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Tee */}
        <div>
          <label className={lbl}>Tee</label>
          <select value={teeId} onChange={e => setTeeId(e.target.value)} className={inp}
            disabled={filteredTees.length === 0}>
            {filteredTees.length === 0
              ? <option value="">No tees for this course</option>
              : filteredTees.map(t => (
                <option key={t.id} value={t.id}>
                  {t.tee_name} — {t.gender === "men" ? "Men" : "Women"} · {t.total_yards}y · CR {t.course_rating}/{t.slope_rating} · {t.pars.length} holes
                </option>
              ))
            }
          </select>
        </div>

        {/* Format */}
        <div>
          <label className={lbl}>Format</label>
          <div className="flex flex-col gap-1">
            {(["4bbb_matchplay", "strokeplay_cumulative", "bbb_agg"] as Format[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex items-center gap-3 px-3 py-3.5 rounded-lg border text-sm text-left transition-colors min-h-[44px]
                  ${format === f
                    ? "bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]"
                    : "border-[#1e3d28] text-white/60 hover:border-[#2a5438]"
                  }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                  ${format === f ? "border-[#C9A84C]" : "border-white/25"}`}>
                  {format === f && <span className="w-2 h-2 rounded-full bg-[#C9A84C]" />}
                </span>
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* HCP Allowance (4bbb + bbb_agg only) */}
        {showHcp && (
          <div>
            <label className={lbl}>Handicap Allowance</label>
            <div className="flex gap-2">
              {([85, 100] as const).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setHcpAllowance(val)}
                  className={`flex-1 py-3 rounded-lg border text-sm font-[family-name:var(--font-playfair)] transition-colors min-h-[44px]
                    ${hcpAllowance === val
                      ? "bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]"
                      : "border-[#1e3d28] text-white/50 hover:border-[#2a5438]"
                    }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agg holes (bbb_agg only) */}
        {showAgg && (
          <div>
            <label className={lbl}>Count last N holes</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={maxAggHoles}
                value={aggHoles}
                onChange={e => setAggHoles(e.target.value)}
                className="w-20 bg-[#0a1a0e] border border-[#2a5438] rounded-lg px-3 py-3 text-white text-sm text-center focus:outline-none focus:border-[#C9A84C]/60 min-h-[44px]"
              />
              <span className="text-white/40 text-sm">holes count all scores</span>
              <span className="text-white/25 text-xs">(max {maxAggHoles})</span>
            </div>
          </div>
        )}

        {/* Team A */}
        <TeamPicker
          label="Team A"
          teamIdx={0}
          selected={teamA}
          otherSelected={teamB}
          players={ulsterPlayers}
          onChange={setTeamA}
        />

        {/* Team B */}
        <TeamPicker
          label="Team B"
          teamIdx={1}
          selected={teamB}
          otherSelected={teamA}
          players={ulsterPlayers}
          onChange={setTeamB}
        />

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2.5 flex flex-col gap-1">
            {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
          </div>
        )}
        {saveErr && <p className="text-red-400 text-xs">{saveErr}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 bg-[#1a3d20] border border-[#2a5438] text-white text-sm rounded-xl hover:bg-[#1e4a26] transition-colors disabled:opacity-50 font-[family-name:var(--font-playfair)] tracking-widest uppercase min-h-[44px]"
        >
          {saving ? "Creating…" : "Create Match"}
        </button>
      </div>
    </div>
  )
}

// ── MatchCard ──────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:  "border-[#1e3d28] text-white/35",
  live:     "border-green-500/40 text-green-400",
  complete: "border-[#C9A84C]/40 text-[#C9A84C]",
}

function MatchCard({ match, playerMap, onDelete }: {
  match: Match
  playerMap: Record<string, string>
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${match.name ?? "this match"}"? This cannot be undone.`)) return
    setDeleting(true)
    await deleteMatch(match.id)
    onDelete()
  }

  const teamANames = match.team_a_players.map(id => playerMap[id] ?? "?").join(" & ")
  const teamBNames = match.team_b_players.map(id => playerMap[id] ?? "?").join(" & ")

  return (
    <div className="border-b border-[#1e3d28] last:border-b-0">
      <Link
        href={`/ulster/matches/${match.id}`}
        className="block px-4 py-4 hover:bg-[#0d2415] transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-[family-name:var(--font-playfair)] text-white text-sm leading-snug">
              {match.name ?? FORMAT_LABELS[match.format as Format] ?? match.format}
            </p>
            <p className="text-white/35 text-xs mt-0.5">
              {formatDate(match.match_date)} · {match.ulster_courses?.name?.split("—")[1]?.trim() ?? match.ulster_courses?.name} · {match.ulster_course_tees?.tee_name}
            </p>
          </div>
          <span className={`text-[10px] border px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wide ${STATUS_STYLES[match.status] ?? STATUS_STYLES.pending}`}>
            {match.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#C9A84C]/70">{teamANames}</span>
          <span className="text-white/20">vs</span>
          <span className="text-[#60a5fa]/70">{teamBNames}</span>
          <span className="text-white/20 ml-auto text-[10px] uppercase tracking-wide">{FORMAT_LABELS[match.format as Format]?.split(" ")[0]}</span>
        </div>
      </Link>
      <div className="px-4 pb-3 flex justify-end">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-white/20 hover:text-red-400 text-xs transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────

export default function UlsterSetupClient({ courses, tees, ulsterPlayers, matches, defaultDate }: {
  courses: Course[]
  tees: Tee[]
  ulsterPlayers: UlsterPlayer[]
  matches: Match[]
  defaultDate: string
}) {
  const router = useRouter()

  const playerMap: Record<string, string> = Object.fromEntries(
    ulsterPlayers.map(p => [p.id, p.players.name])
  )

  return (
    <div className="flex flex-col gap-6">
      <CreateMatchForm
        courses={courses}
        tees={tees}
        ulsterPlayers={ulsterPlayers}
        defaultDate={defaultDate}
        onCreated={() => router.push("/ulster/matches")}
      />

      {/* Existing matches */}
      <div>
        <p className="text-white/30 text-[11px] uppercase tracking-[0.2em] mb-3 px-1">
          Existing Matches ({matches.length})
        </p>
        {matches.length === 0 ? (
          <p className="text-white/20 text-sm px-1">No matches yet.</p>
        ) : (
          <div className="border border-[#1e3d28] rounded-xl overflow-hidden">
            {matches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                playerMap={playerMap}
                onDelete={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
