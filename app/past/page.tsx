import { supabase } from "@/lib/supabase"
import Link from "next/link"
import BackButton from "@/app/components/BackButton"

export const dynamic = "force-dynamic"

type TeamRow    = { id: string; name: string; color: string; edition_year: number }
type PlayerRow  = { id: string; team_id: string | null; edition_year: number }
type ScoreRow   = { player_id: string; hole_id: string; stableford_points: number; round_id: string; edition_year: number }
type HoleRow    = { id: string; course_id: string }
type RoundRow   = { id: string; edition_year: number; round_number: number; courses: { id: string; name: string } | null }

function computeWinner(
  teams: TeamRow[],
  players: PlayerRow[],
  scores: ScoreRow[],
  holes: HoleRow[],
  rounds: RoundRow[],
) {
  if (!teams.length || !scores.length) return null
  const teamsWithPlayers = teams.map(t => ({
    ...t,
    players: players.filter(p => p.team_id === t.id),
  }))
  const rows = teamsWithPlayers.map(team => {
    const total = rounds.reduce((sum, r) => {
      const courseHoles = holes.filter(h => h.course_id === r.courses?.id)
      const roundPts = courseHoles.reduce((hSum, hole) => {
        const pts = team.players
          .map(p => scores.find(s => s.player_id === p.id && s.hole_id === hole.id && s.round_id === r.id))
          .filter(Boolean)
          .map(s => s!.stableford_points)
          .sort((a, b) => b - a)
          .slice(0, 2)
          .reduce((s, v) => s + v, 0)
        return hSum + pts
      }, 0)
      return sum + roundPts
    }, 0)
    return { team, total }
  }).sort((a, b) => b.total - a.total)

  if (!rows.length || rows[0].total === 0) return null
  const topScore = rows[0].total
  const winners = rows.filter(r => r.total === topScore)
  return { teams: winners.map(r => r.team), total: topScore }
}

export default async function PastPage() {
  const [roundsRes, teamsRes, playersRes, scoresRes, holesRes] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, edition_year, round_number, courses(id, name)")
      .order("edition_year", { ascending: false })
      .order("round_number"),
    supabase.from("teams").select("id, name, color, edition_year").order("name"),
    supabase.from("players").select("id, team_id, edition_year"),
    supabase.from("scores").select("player_id, hole_id, stableford_points, round_id, edition_year"),
    supabase.from("holes").select("id, course_id"),
  ])

  const allRounds  = (roundsRes.data ?? []) as unknown as RoundRow[]
  const allTeams   = (teamsRes.data ?? []) as TeamRow[]
  const allPlayers = (playersRes.data ?? []) as PlayerRow[]
  const allScores  = (scoresRes.data ?? []) as ScoreRow[]
  const allHoles   = (holesRes.data ?? []) as HoleRow[]

  // Group rounds by year, deduplicate years
  const roundsByYear = new Map<number, RoundRow[]>()
  for (const r of allRounds) {
    if (!roundsByYear.has(r.edition_year)) roundsByYear.set(r.edition_year, [])
    roundsByYear.get(r.edition_year)!.push(r)
  }
  const years = Array.from(roundsByYear.keys()).sort((a, b) => b - a)

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28]">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-white tracking-wide">
            Past Tournaments
          </h1>
          <div className="w-11" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {years.length === 0 ? (
          <p className="text-white/30 text-center py-20">No archived tournaments yet.</p>
        ) : (
          <div className="space-y-3">
            {years.map(year => {
              const yearRounds  = roundsByYear.get(year) ?? []
              const courseNames = yearRounds.map(r => r.courses?.name).filter(Boolean) as string[]
              const yearTeams   = allTeams.filter(t => t.edition_year === year)
              const yearPlayers = allPlayers.filter(p => p.edition_year === year)
              const yearScores  = allScores.filter(s => s.edition_year === year)
              const winner      = computeWinner(yearTeams, yearPlayers, yearScores, allHoles, yearRounds)

              return (
                <Link
                  key={year}
                  href={`/past/${year}`}
                  className="block border border-[#1e3d28] bg-[#0f2418] rounded-sm px-5 py-5 hover:bg-[#142e1f] hover:border-[#C9A84C]/30 transition-colors active:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-playfair)] text-2xl text-white mb-1">{year}</p>

                      {courseNames.length > 0 && (
                        <p className="text-white/35 text-sm mb-2">
                          {courseNames.join(" · ")}
                        </p>
                      )}

                      {winner && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white/25 text-xs tracking-widest uppercase">
                            {winner.teams.length > 1 ? "Co-Champions" : "Champions"}
                          </span>
                          {winner.teams.map(t => (
                            <span key={t.id} className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                              <span className="text-white/60 text-sm">{t.name}</span>
                            </span>
                          ))}
                          <span className="text-white/20 text-xs">· {winner.total} pts</span>
                        </div>
                      )}
                    </div>

                    <span className="text-[#C9A84C]/40 text-2xl leading-none flex-shrink-0 mt-1">›</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
