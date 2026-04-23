"use client"

import LeaderboardClient from "@/app/leaderboard/LeaderboardClient"
import IndividualClient from "@/app/leaderboard/individual/IndividualClient"

// ─── Types ─────────────────────────────────────────────────────

type Course       = { id: string; name: string }
type Round        = { id: string; round_number: number; status?: string; played_on?: string | null; courses: Course | null }
type Player       = { id: string; name: string; role: string; handicap: number; is_composite?: boolean; gender?: string; team_id?: string | null; teams: { name: string; color: string } | null }
type Team         = { id: string; name: string; color: string; players: Player[] }
type Hole         = { id: string; hole_number: number; par: number; stroke_index: number; course_id: string }
type Score        = { player_id: string; hole_id: string; gross_score: number; stableford_points: number; no_return: boolean; round_id: string }
type RoundHcp     = { round_id: string; player_id: string; playing_handicap: number }
type CompHole     = { composite_player_id: string; round_id: string; hole_id: string; source_player_id?: string; source_player_name?: string }

interface Props {
  year:           number
  rounds:         Round[]
  teams:          Team[]
  players:        Player[]
  holes:          Hole[]
  scores:         Score[]
  roundHandicaps: RoundHcp[]
  tees:           unknown[]
  compositeHoles: CompHole[]
}

// ─── Date helpers ──────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// Fallback dates for years where played_on was not populated
const KNOWN_DATES: Record<number, string> = {
  2026: "16–18 Apr 2026",
}

function formatDateRange(rounds: Round[]): string | null {
  const dates = rounds
    .map(r => r.played_on)
    .filter((d): d is string => !!d)
    .map(d => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime())

  if (!dates.length) return null

  const first = dates[0]
  const last  = dates[dates.length - 1]
  const month = MONTHS[first.getMonth()]
  const year  = first.getFullYear()

  if (first.toDateString() === last.toDateString()) {
    return `${first.getDate()} ${month} ${year}`
  }
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${first.getDate()}–${last.getDate()} ${month} ${year}`
  }
  return `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
}

// ─── Winner computation ────────────────────────────────────────

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

function computeWinner(teams: Team[], rounds: Round[], holes: Hole[], scores: Score[]) {
  if (!teams.length || !scores.length) return null
  const rows = teams.map(team => {
    const total = rounds.reduce((sum, r) => {
      const courseHoles = holes.filter(h => h.course_id === r.courses?.id)
      return sum + teamRoundPts(team, courseHoles, scores, r.id)
    }, 0)
    return { team, total }
  }).sort((a, b) => b.total - a.total)

  if (!rows.length || rows[0].total === 0) return null
  const topScore = rows[0].total
  const winners  = rows.filter(r => r.total === topScore)
  return { teams: winners.map(r => r.team), total: topScore }
}

// ─── Sticky offset for archive header ─────────────────────────
// Archive header = banner (py-2 + text-xs + border ≈ 33px) + nav (py-4 + h-11 + border ≈ 77px) = 110px
const ARCHIVE_STICKY_OFFSET = "110px"

// ─── Component ─────────────────────────────────────────────────

export default function PastTournamentClient({ year, rounds, teams, players, holes, scores, roundHandicaps, tees, compositeHoles }: Props) {
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number)
  const courseNames  = sortedRounds.map(r => r.courses?.name).filter(Boolean) as string[]
  const winner       = computeWinner(teams, sortedRounds, holes, scores)
  const dateRange    = formatDateRange(sortedRounds) ?? KNOWN_DATES[year] ?? null

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="py-8 space-y-3">

        {/* Venue + courses */}
        {courseNames.length > 0 && (
          <p className="text-white/35 text-sm tracking-wide">
            Rosapenna Hotel &amp; Golf Resort
            <span className="text-white/20 mx-2">—</span>
            {courseNames.join(" · ")}
          </p>
        )}

        {/* Date range */}
        {dateRange && (
          <p className="text-white/25 text-xs tracking-[0.15em] uppercase">{dateRange}</p>
        )}

        {/* Champion badge */}
        {winner && (
          <div
            className="border rounded-sm px-5 py-4 mt-1"
            style={{
              borderColor: `${winner.teams[0].color}50`,
              background:  `${winner.teams[0].color}12`,
            }}
          >
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 mb-1.5">
              {winner.teams.length > 1 ? "Co-Champions" : "Champions"}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {winner.teams.map(t => (
                  <span key={t.id} className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                ))}
              </div>
              <span className="font-[family-name:var(--font-playfair)] text-xl text-white">
                {winner.teams.map(t => t.name).join(" & ")}
              </span>
              <span className="text-white/25 text-sm ml-auto">{winner.total} pts</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Team Leaderboard ──────────────────────────────── */}
      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white mb-4">Team Leaderboard</h2>
        <LeaderboardClient
          rounds={sortedRounds}
          teams={teams}
          holes={holes}
          scores={scores}
          roundHandicaps={roundHandicaps}
          tees={tees}
          compositeHoles={compositeHoles as any}
          activeRoundIds={[]}
          currentYear={year}
          readOnly
          stickyTopOffset={ARCHIVE_STICKY_OFFSET}
        />
      </section>

      {/* ── Individual Standings ──────────────────────────── */}
      <section>
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-white mb-4">Individual Standings</h2>
        <IndividualClient
          rounds={sortedRounds}
          players={players}
          holes={holes}
          scores={scores}
          roundHandicaps={roundHandicaps}
          tees={tees as any}
          compositeHoles={compositeHoles as any}
          readOnly
          stickyTopOffset={ARCHIVE_STICKY_OFFSET}
        />
      </section>

    </div>
  )
}
