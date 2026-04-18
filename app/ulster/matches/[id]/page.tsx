import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import MatchDetailClient from "./MatchDetailClient"

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [matchRes, scoresRes] = await Promise.all([
    supabase
      .from("ulster_matches")
      .select(`
        id, name, match_date, format, status, hcp_allowance,
        agg_holes, team_a_players, team_b_players, conceded_holes,
        ulster_courses(id, name, slug),
        ulster_course_tees(
          id, tee_name, gender,
          course_rating, slope_rating,
          par_total, par_front, par_back,
          pars, yardages, stroke_index
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("ulster_scores")
      .select("player_id, hole, gross")
      .eq("match_id", id),
  ])

  if (matchRes.error || !matchRes.data) notFound()
  const match = matchRes.data as any
  const scores = (scoresRes.data ?? []) as { player_id: string; hole: number; gross: number }[]

  const allPlayerIds = [...match.team_a_players, ...match.team_b_players]
  const { data: ulsterPlayers } = await supabase
    .from("ulster_players")
    .select("id, handicap_index, players(id, name)")
    .in("id", allPlayerIds)

  return (
    <MatchDetailClient
      match={match}
      ulsterPlayers={(ulsterPlayers ?? []) as any[]}
      scores={scores}
    />
  )
}
