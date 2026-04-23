import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BackButton from "@/app/components/BackButton"
import PastTournamentClient from "./PastTournamentClient"

export const dynamic = "force-dynamic"

export default async function PastYearPage({ params }: { params: { year: string } }) {
  const year = parseInt(params.year, 10)
  if (isNaN(year) || year < 2026) notFound()

  const [roundsRes, teamsRes, playersRes, holesRes, scoresRes, hcpsRes, teesRes, compositeHolesRes] = await Promise.all([
    supabase.from("rounds").select("id, round_number, status, played_on, courses(id, name)").eq("edition_year", year).order("round_number"),
    supabase.from("teams").select("id, name, color").eq("edition_year", year).order("name"),
    supabase.from("players").select("id, name, role, handicap, is_composite, gender, team_id").eq("edition_year", year).order("name"),
    supabase.from("holes").select("id, hole_number, par, stroke_index, course_id").order("hole_number"),
    supabase.from("scores").select("player_id, hole_id, gross_score, stableford_points, no_return, round_id").eq("edition_year", year),
    supabase.from("round_handicaps").select("round_id, player_id, playing_handicap").eq("edition_year", year),
    supabase.from("tees").select("id, course_id, name, gender, par"),
    supabase.from("composite_holes").select("composite_player_id, round_id, hole_id, source_player_id, source_player_name").eq("edition_year", year),
  ])

  const rounds    = roundsRes.data ?? []
  const allPlayers = playersRes.data ?? []
  const teamsRaw  = teamsRes.data ?? []

  if (rounds.length === 0) {
    return (
      <div className="min-h-dvh bg-[#0a1a0e] text-white">
        <div className="sticky top-0 z-50 bg-[#0a1a0e]">
          <div className="bg-[#181408] border-b border-[#C9A84C]/20 px-4 py-2 text-center">
            <span className="text-[#C9A84C]/50 text-xs tracking-[0.2em] uppercase">Archived results — read only</span>
          </div>
          <div className="border-b border-[#1e3d28]">
            <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
              <BackButton href="/past" />
              <h1 className="font-[family-name:var(--font-playfair)] text-xl text-white tracking-wide">
                Donegal Masters {year}
              </h1>
              <div className="w-11" />
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-white/30">No tournament data for {year}.</p>
        </div>
      </div>
    )
  }

  // Build team objects with player lists (for LeaderboardClient)
  const teams = teamsRaw.map(team => ({
    ...team,
    players: allPlayers.filter(p => p.team_id === team.id),
  }))

  // Build player objects with team join (for IndividualClient)
  const playersWithTeams = allPlayers.map(p => ({
    ...p,
    teams: teamsRaw.find(t => t.id === p.team_id) ?? null,
  }))

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">

      {/* Sticky header: archive banner + nav */}
      <div className="sticky top-0 z-50 bg-[#0a1a0e]">
        <div className="bg-[#181408] border-b border-[#C9A84C]/20 px-4 py-2 text-center">
          <span className="text-[#C9A84C]/50 text-xs tracking-[0.2em] uppercase">Archived results — read only</span>
        </div>
        <div className="border-b border-[#1e3d28]">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <BackButton href="/past" />
            <h1 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-white tracking-wide">
              Donegal Masters {year}
            </h1>
            <div className="w-11" />
          </div>
        </div>
      </div>

      <PastTournamentClient
        year={year}
        rounds={rounds as any}
        teams={teams as any}
        players={playersWithTeams as any}
        holes={(holesRes.data ?? []) as any}
        scores={(scoresRes.data ?? []) as any}
        roundHandicaps={(hcpsRes.data ?? []) as any}
        tees={(teesRes.data ?? []) as any}
        compositeHoles={(compositeHolesRes.data ?? []) as any}
      />
    </div>
  )
}
