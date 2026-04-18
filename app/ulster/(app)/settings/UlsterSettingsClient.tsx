"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  updateUlsterPlayerHandicap,
  removeUlsterPlayer,
  addUlsterPlayer,
  updateUlsterTee,
  addUlsterTee,
  updateRevealAt,
  resetRevealAt,
  type TeePayload,
} from "./actions"

// ── Types ─────────────────────────────────────────────────────

type Player = { id: string; name: string; handicap: number }
type UlsterPlayer = { id: string; player_id: string; handicap_index: number; players: Player }
type Tee = {
  id: string; course_id: string; tee_name: string; gender: string
  total_yards: number; course_rating: number; slope_rating: number
  par_front: number; par_back: number; par_total: number
  yardages: number[]; pars: number[]; stroke_index: number[]
}
type Course = { id: string; slug: string; name: string; tees: Tee[] }
type Trip = { id: string; reveal_at: string }

type TeeForm = {
  tee_name: string; gender: "men" | "women"
  total_yards: string; course_rating: string; slope_rating: string
  par_front: string; par_back: string; par_total: string
  yardages: string; pars: string; stroke_index: string
}

// ── Helpers ───────────────────────────────────────────────────

function teeToForm(t: Tee): TeeForm {
  return {
    tee_name: t.tee_name, gender: t.gender as "men" | "women",
    total_yards: String(t.total_yards), course_rating: String(t.course_rating),
    slope_rating: String(t.slope_rating), par_front: String(t.par_front),
    par_back: String(t.par_back), par_total: String(t.par_total),
    yardages: t.yardages.join(", "), pars: t.pars.join(", "),
    stroke_index: t.stroke_index.join(", "),
  }
}

const EMPTY_FORM: TeeForm = {
  tee_name: "", gender: "men", total_yards: "", course_rating: "",
  slope_rating: "", par_front: "", par_back: "", par_total: "",
  yardages: "", pars: "", stroke_index: "",
}

function parseArr(s: string): number[] {
  return s.split(",").map(v => v.trim()).filter(Boolean).map(Number).filter(v => !isNaN(v))
}

function validateTeeForm(f: TeeForm): string[] {
  const errs: string[] = []
  const yds = parseArr(f.yardages)
  const pars = parseArr(f.pars)
  const si = parseArr(f.stroke_index)
  if (!f.tee_name.trim()) errs.push("Tee name is required")
  if (yds.length === 0) errs.push("Yardages must not be empty")
  if (pars.length === 0) errs.push("Pars must not be empty")
  if (si.length === 0) errs.push("Stroke Index must not be empty")
  if (yds.length > 0 && pars.length > 0 && si.length > 0) {
    if (yds.length !== pars.length || pars.length !== si.length)
      errs.push(`Array lengths must match — yardages: ${yds.length}, pars: ${pars.length}, SI: ${si.length}`)
    const parsSum = pars.reduce((a, b) => a + b, 0)
    const pt = parseInt(f.par_total), pf = parseInt(f.par_front), pb = parseInt(f.par_back)
    if (!isNaN(pt) && parsSum !== pt) errs.push(`par_total (${pt}) ≠ sum of pars array (${parsSum})`)
    if (!isNaN(pf) && !isNaN(pb) && !isNaN(pt) && pf + pb !== pt)
      errs.push(`par_front (${pf}) + par_back (${pb}) ≠ par_total (${pt})`)
  }
  return errs
}

function formToPayload(f: TeeForm): TeePayload {
  return {
    tee_name: f.tee_name.trim(), gender: f.gender,
    total_yards: parseInt(f.total_yards) || 0,
    course_rating: parseFloat(f.course_rating) || 0,
    slope_rating: parseInt(f.slope_rating) || 0,
    par_front: parseInt(f.par_front) || 0,
    par_back: parseInt(f.par_back) || 0,
    par_total: parseInt(f.par_total) || 0,
    yardages: parseArr(f.yardages), pars: parseArr(f.pars), stroke_index: parseArr(f.stroke_index),
  }
}

// ── Section wrapper ────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-[#1e3d28] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 text-left bg-[#0d2415] hover:bg-[#0f2918] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-playfair)] text-white text-base">{title}</span>
          {badge !== undefined && (
            <span className="text-[11px] text-white/40 border border-[#1e3d28] px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </div>
        {/* No transform — conditional render avoids iOS overflow-hidden + transform issue */}
        {open
          ? <svg className="w-4 h-4 text-white/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          : <svg className="w-4 h-4 text-white/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        }
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 260ms ease" }}>
        <div className="overflow-hidden">
          <div className="border-t border-[#1e3d28]">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── Shared input styles ────────────────────────────────────────

const inp = "w-full bg-[#0a1a0e] border border-[#2a5438] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#C9A84C]/60 min-h-[44px]"
const lbl = "text-white/40 text-[11px] uppercase tracking-wide block mb-1"

// ── PlayerRow ──────────────────────────────────────────────────

function PlayerRow({ up, onRefresh }: { up: UlsterPlayer; onRefresh: () => void }) {
  const [localHcp, setLocalHcp] = useState(up.handicap_index)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { setLocalHcp(up.handicap_index) }, [up.handicap_index])

  async function handleBlur() {
    const val = Math.round(localHcp * 10) / 10
    if (val === up.handicap_index) return
    setSaving(true); setErr(null)
    const res = await updateUlsterPlayerHandicap(up.id, val)
    setSaving(false)
    if (res.error) { setErr(res.error); setLocalHcp(up.handicap_index) }
    else onRefresh()
  }

  async function handleRemove() {
    if (!confirm(`Remove ${up.players.name} from the Ports roster?`)) return
    const res = await removeUlsterPlayer(up.id)
    if (!res.error) onRefresh()
  }

  return (
    <div className="border-b border-[#1e3d28] last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-white text-sm font-[family-name:var(--font-playfair)]">{up.players.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs">HI</span>
          <input
            type="number" step="0.1" min="0" max="54"
            value={localHcp}
            onChange={e => setLocalHcp(parseFloat(e.target.value) || 0)}
            onBlur={handleBlur}
            className={`w-16 bg-[#0a1a0e] border rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none min-h-[44px] ${err ? "border-red-500/60" : "border-[#2a5438] focus:border-[#C9A84C]/60"}`}
          />
          {saving && <span className="text-[#C9A84C]/50 text-xs">…</span>}
        </div>
        <button
          onClick={handleRemove}
          className="text-white/20 hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={`Remove ${up.players.name}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
        </button>
      </div>
      {err && <p className="px-4 pb-2 text-red-400 text-xs">{err}</p>}
    </div>
  )
}

// ── AddPlayerForm ──────────────────────────────────────────────

function AddPlayerForm({ available, onDone, onCancel }: {
  available: Player[]; onDone: () => void; onCancel: () => void
}) {
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "")
  const [hcp, setHcp] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const p = available.find(p => p.id === selectedId)
    setHcp(p ? String(p.handicap ?? 0) : "")
  }, [selectedId, available])

  if (available.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-[#1e3d28] flex items-center justify-between">
        <p className="text-white/30 text-sm">All players are already in the roster.</p>
        <button onClick={onCancel} className="text-white/40 hover:text-white/60 text-sm min-h-[44px] px-2">Cancel</button>
      </div>
    )
  }

  async function handleAdd() {
    if (!selectedId) return
    setSaving(true); setErr(null)
    const res = await addUlsterPlayer(selectedId, parseFloat(hcp) || 0)
    setSaving(false)
    if (res.error) setErr(res.error)
    else onDone()
  }

  return (
    <div className="px-4 py-3 border-t border-[#1e3d28] flex flex-col gap-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className={lbl}>Player</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className={inp}
          >
            {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="w-20">
          <label className={lbl}>HI</label>
          <input
            type="number" step="0.1" min="0" max="54"
            value={hcp}
            onChange={e => setHcp(e.target.value)}
            className={inp}
          />
        </div>
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={saving || !selectedId}
          className="flex-1 py-3 bg-[#1a3d20] border border-[#2a5438] text-white text-sm rounded-xl hover:bg-[#1e4a26] transition-colors disabled:opacity-50 min-h-[44px]">
          {saving ? "Adding…" : "Add to roster"}
        </button>
        <button onClick={onCancel}
          className="px-4 py-3 border border-[#1e3d28] text-white/50 text-sm rounded-xl hover:text-white/70 transition-colors min-h-[44px]">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── PlayersSection ─────────────────────────────────────────────

function PlayersSection({ ulsterPlayers, availablePlayers, onRefresh }: {
  ulsterPlayers: UlsterPlayer[]; availablePlayers: Player[]; onRefresh: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <Section title="Players" badge={String(ulsterPlayers.length)}>
      {ulsterPlayers.length === 0 && !showAdd && (
        <p className="px-4 py-4 text-white/30 text-sm">No players yet.</p>
      )}
      {ulsterPlayers.map(up => <PlayerRow key={up.id} up={up} onRefresh={onRefresh} />)}
      {showAdd
        ? <AddPlayerForm available={availablePlayers} onDone={() => { setShowAdd(false); onRefresh() }} onCancel={() => setShowAdd(false)} />
        : (
          <div className="px-4 py-3">
            <button onClick={() => setShowAdd(true)}
              className="text-[#C9A84C]/70 hover:text-[#C9A84C] text-sm tracking-wide transition-colors flex items-center gap-2 min-h-[44px]">
              <span className="text-base leading-none font-light">+</span> Add player
            </button>
          </div>
        )
      }
    </Section>
  )
}

// ── TeeDrawer ──────────────────────────────────────────────────

function TeeDrawer({ tee, courseId, onClose, onSaved }: {
  tee: Tee | null; courseId: string; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState<TeeForm>(tee ? teeToForm(tee) : EMPTY_FORM)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function set(key: keyof TeeForm, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const ydsLen = parseArr(form.yardages).length
  const parsLen = parseArr(form.pars).length
  const siLen = parseArr(form.stroke_index).length

  async function handleSave() {
    const errs = validateTeeForm(form)
    if (errs.length) { setErrors(errs); return }
    setErrors([]); setSaving(true); setSaveErr(null)
    const payload = formToPayload(form)
    const res = tee ? await updateUlsterTee(tee.id, payload) : await addUlsterTee(courseId, payload)
    setSaving(false)
    if (res.error) setSaveErr(res.error)
    else onSaved()
  }

  const ta = "w-full bg-[#0a1a0e] border border-[#2a5438] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#C9A84C]/60 font-mono resize-none"

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-[#0d2415] border-t border-[#1e3d28] rounded-t-2xl max-h-[88dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-playfair)] text-white text-lg">
            {tee ? `Edit — ${tee.tee_name}` : "New Tee"}
          </h2>
          <button onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-4 pb-8 flex flex-col gap-4">
          {/* Tee name + gender */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={lbl}>Tee Name</label>
              <input type="text" value={form.tee_name} onChange={e => set("tee_name", e.target.value)}
                className={inp} placeholder="e.g. Blue" />
            </div>
            <div className="w-28">
              <label className={lbl}>Gender</label>
              <select value={form.gender} onChange={e => set("gender", e.target.value as "men" | "women")} className={inp}>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </div>
          </div>

          {/* Yards + CR + Slope */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={lbl}>Yards</label>
              <input type="number" value={form.total_yards} onChange={e => set("total_yards", e.target.value)} className={inp} />
            </div>
            <div className="w-[72px]">
              <label className={lbl}>CR</label>
              <input type="number" step="0.1" value={form.course_rating} onChange={e => set("course_rating", e.target.value)} className={inp} />
            </div>
            <div className="w-[72px]">
              <label className={lbl}>Slope</label>
              <input type="number" value={form.slope_rating} onChange={e => set("slope_rating", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Par front + back + total */}
          <div className="flex gap-2">
            {(["par_front", "par_back", "par_total"] as const).map(key => (
              <div key={key} className="flex-1">
                <label className={lbl}>{key.replace("par_", "Par ").replace("_", " ")}</label>
                <input type="number" value={form[key]} onChange={e => set(key, e.target.value)} className={inp} />
              </div>
            ))}
          </div>

          {/* Array editors */}
          {([
            { key: "yardages" as const, label: "Yardages", len: ydsLen, ph: "427, 366, 218, …" },
            { key: "pars" as const, label: "Pars", len: parsLen, ph: "4, 4, 3, 5, …" },
            { key: "stroke_index" as const, label: "Stroke Index", len: siLen, ph: "11, 7, 13, …" },
          ]).map(({ key, label, len, ph }) => (
            <div key={key}>
              <label className={lbl}>
                {label}
                {len > 0 && <span className="text-white/25 ml-2 normal-case font-normal">{len} holes</span>}
              </label>
              <textarea
                rows={2}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className={ta}
                placeholder={ph}
              />
            </div>
          ))}

          {errors.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2.5 flex flex-col gap-1">
              {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
            </div>
          )}
          {saveErr && <p className="text-red-400 text-xs">{saveErr}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3.5 bg-[#1a3d20] border border-[#2a5438] text-white text-sm rounded-xl hover:bg-[#1e4a26] transition-colors disabled:opacity-50 font-[family-name:var(--font-playfair)] tracking-wide min-h-[44px]">
              {saving ? "Saving…" : "Save Tee"}
            </button>
            <button onClick={onClose}
              className="px-5 py-3.5 border border-[#1e3d28] text-white/50 text-sm rounded-xl hover:text-white/70 transition-colors min-h-[44px]">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CoursesSection ─────────────────────────────────────────────

type DrawerState = { tee: Tee | null; courseId: string } | null

function CoursesSection({ courses, onRefresh }: { courses: Course[]; onRefresh: () => void }) {
  const [drawer, setDrawer] = useState<DrawerState>(null)

  return (
    <>
      <Section title="Courses & Tees">
        {courses.map((course, ci) => (
          <div key={course.id} className={ci < courses.length - 1 ? "border-b border-[#1e3d28]" : ""}>
            <div className="px-4 py-2.5 bg-[#0a1a0e]/40">
              <p className="text-white/50 text-[11px] uppercase tracking-[0.15em]">{course.name}</p>
            </div>
            {course.tees.length === 0 && (
              <p className="px-4 py-3 text-white/25 text-sm">No tees yet.</p>
            )}
            {course.tees.map(tee => (
              <div key={tee.id} className="flex items-center justify-between px-4 py-3 border-t border-[#1e3d28]">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-[family-name:var(--font-playfair)]">{tee.tee_name}</span>
                    <span className="text-white/35 text-xs capitalize">{tee.gender}</span>
                  </div>
                  <span className="text-white/25 text-xs">
                    {tee.pars.length} holes · par {tee.par_total} · {tee.total_yards}y · CR {tee.course_rating} / {tee.slope_rating}
                  </span>
                </div>
                <button
                  onClick={() => setDrawer({ tee, courseId: tee.course_id })}
                  className="text-[#C9A84C]/60 hover:text-[#C9A84C] text-xs tracking-widest uppercase transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
                >
                  Edit
                </button>
              </div>
            ))}
            <div className="px-4 py-3 border-t border-[#1e3d28]">
              <button
                onClick={() => setDrawer({ tee: null, courseId: course.id })}
                className="text-[#C9A84C]/70 hover:text-[#C9A84C] text-sm transition-colors flex items-center gap-2 min-h-[44px]"
              >
                <span className="text-base leading-none font-light">+</span> Add tee
              </button>
            </div>
          </div>
        ))}
      </Section>

      {drawer && (
        <TeeDrawer
          tee={drawer.tee}
          courseId={drawer.courseId}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); onRefresh() }}
        />
      )}
    </>
  )
}

// ── DevSection ─────────────────────────────────────────────────

function DevSection({ trip }: { trip: Trip }) {
  const router = useRouter()
  const toLocal = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [revealAt, setRevealAt] = useState(() => toLocal(trip.reveal_at))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { setRevealAt(toLocal(trip.reveal_at)) }, [trip.reveal_at])

  async function handleSave() {
    setSaving(true); setMsg(null)
    const res = await updateRevealAt(new Date(revealAt).toISOString())
    setSaving(false)
    if (res.error) setMsg(`Error: ${res.error}`)
    else { setMsg("Saved."); router.refresh() }
  }

  async function handleReset() {
    setSaving(true); setMsg(null)
    const res = await resetRevealAt()
    setSaving(false)
    if (res.error) setMsg(`Error: ${res.error}`)
    else { setMsg("Reset to 2026-04-19 15:00 IST"); router.refresh() }
  }

  return (
    <Section title="Dev">
      <div className="px-4 py-4 flex flex-col gap-4">
        <div>
          <label className={lbl}>reveal_at (browser local time)</label>
          <input
            type="datetime-local"
            value={revealAt}
            onChange={e => setRevealAt(e.target.value)}
            className={inp}
          />
          <p className="text-white/20 text-xs mt-1.5">DB: {trip.reveal_at}</p>
        </div>
        {msg && <p className="text-[#C9A84C]/80 text-xs">{msg}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-[#1a3d20] border border-[#2a5438] text-white text-sm rounded-xl hover:bg-[#1e4a26] transition-colors disabled:opacity-50 min-h-[44px]">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handleReset} disabled={saving}
            className="flex-1 py-3 border border-[#1e3d28] text-white/45 text-sm rounded-xl hover:text-white/65 transition-colors disabled:opacity-50 min-h-[44px]">
            Reset to 19 Apr 15:00
          </button>
        </div>
      </div>
    </Section>
  )
}

// ── Main export ────────────────────────────────────────────────

export default function UlsterSettingsClient({ ulsterPlayers, availablePlayers, courses, trip, isDev }: {
  ulsterPlayers: UlsterPlayer[]
  availablePlayers: Player[]
  courses: Course[]
  trip: Trip | null
  isDev: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="flex flex-col gap-4">
      <PlayersSection ulsterPlayers={ulsterPlayers} availablePlayers={availablePlayers} onRefresh={refresh} />
      <CoursesSection courses={courses} onRefresh={refresh} />
      {isDev && trip && <DevSection trip={trip} />}
    </div>
  )
}
